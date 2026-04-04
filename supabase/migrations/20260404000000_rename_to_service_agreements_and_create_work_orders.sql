-- ============================================================
-- STEP 1: Drop the old empty service_agreements table cleanly
-- ============================================================
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_service_agreement_id_fkey;
DROP TABLE IF EXISTS public.service_agreements CASCADE;

-- ============================================================
-- STEP 2: Rename work_orders → service_agreements
-- ============================================================
ALTER TABLE public.work_orders RENAME TO service_agreements;
ALTER TABLE public.service_agreements RENAME COLUMN work_order_number TO agreement_number;

-- Add agreement-level fields that were missing
ALTER TABLE public.service_agreements
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS contract_value numeric,
  ADD COLUMN IF NOT EXISTS billing_method text CHECK (billing_method IN ('upfront','per_visit','net_30')),
  ADD COLUMN IF NOT EXISTS agreement_status text NOT NULL DEFAULT 'active'
    CHECK (agreement_status IN ('draft','active','completed','cancelled'));

-- Map old status values to agreement_status
UPDATE public.service_agreements SET agreement_status =
  CASE WHEN status = 'draft' THEN 'draft' ELSE 'active' END;
ALTER TABLE public.service_agreements DROP COLUMN status;

-- Remove execution fields from agreements (they belong on work orders)
ALTER TABLE public.service_agreements
  DROP COLUMN IF EXISTS actual_start_date,
  DROP COLUMN IF EXISTS actual_start_time,
  DROP COLUMN IF EXISTS completion_date,
  DROP COLUMN IF EXISTS completion_time,
  DROP COLUMN IF EXISTS wind_speed_mph,
  DROP COLUMN IF EXISTS wind_direction,
  DROP COLUMN IF EXISTS air_temp_f,
  DROP COLUMN IF EXISTS tanks_used,
  DROP COLUMN IF EXISTS signature_url,
  DROP COLUMN IF EXISTS visit_number;

-- ============================================================
-- STEP 3: Rename work_order_charges → service_agreement_line_items
--         and add frequency fields
-- ============================================================
ALTER TABLE public.work_order_charges RENAME TO service_agreement_line_items;
ALTER TABLE public.service_agreement_line_items
  RENAME COLUMN work_order_id TO agreement_id;

-- Update the FK
ALTER TABLE public.service_agreement_line_items
  DROP CONSTRAINT IF EXISTS work_order_charges_work_order_id_fkey;
ALTER TABLE public.service_agreement_line_items
  ADD CONSTRAINT sal_agreement_id_fkey
    FOREIGN KEY (agreement_id) REFERENCES public.service_agreements(id) ON DELETE CASCADE;

-- Add frequency columns
ALTER TABLE public.service_agreement_line_items
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'one_time'
    CHECK (frequency IN ('one_time', 'annual', 'monthly_seasonal', 'weekly_seasonal')),
  ADD COLUMN IF NOT EXISTS season_start_month smallint CHECK (season_start_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS season_end_month smallint CHECK (season_end_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS sort_order smallint NOT NULL DEFAULT 0;

-- ============================================================
-- STEP 4: Rename other work_order_* tables
-- ============================================================
ALTER TABLE public.work_order_chemicals RENAME TO service_agreement_chemicals;
ALTER TABLE public.service_agreement_chemicals
  RENAME COLUMN work_order_id TO agreement_id;
ALTER TABLE public.service_agreement_chemicals
  DROP CONSTRAINT IF EXISTS work_order_chemicals_work_order_id_fkey;
ALTER TABLE public.service_agreement_chemicals
  ADD CONSTRAINT sac_agreement_id_fkey
    FOREIGN KEY (agreement_id) REFERENCES public.service_agreements(id) ON DELETE CASCADE;

ALTER TABLE public.work_order_materials RENAME TO service_agreement_materials;
ALTER TABLE public.service_agreement_materials
  RENAME COLUMN work_order_id TO agreement_id;
ALTER TABLE public.service_agreement_materials
  DROP CONSTRAINT IF EXISTS work_order_materials_work_order_id_fkey;
ALTER TABLE public.service_agreement_materials
  ADD CONSTRAINT sam_agreement_id_fkey
    FOREIGN KEY (agreement_id) REFERENCES public.service_agreements(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 5: Create new work_orders table (execution records)
-- ============================================================
CREATE TABLE public.work_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  work_order_number text UNIQUE,
  service_agreement_id uuid NOT NULL REFERENCES public.service_agreements(id) ON DELETE CASCADE,
  agreement_line_item_id uuid NOT NULL REFERENCES public.service_agreement_line_items(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  service_type_id uuid REFERENCES public.service_types(id),

  -- What period this WO covers (null for one-time)
  period_month smallint CHECK (period_month BETWEEN 1 AND 12),
  period_year smallint,
  -- For weekly: which week of the month (1-4)
  period_week smallint CHECK (period_week BETWEEN 1 AND 4),

  -- Scheduling
  status text NOT NULL DEFAULT 'unscheduled'
    CHECK (status IN ('unscheduled','tentative','scheduled','in_progress','completed','cancelled')),
  scheduled_date date,
  scheduled_time time without time zone,

  -- Priority tracking
  last_serviced_date date,
  days_since_last_service integer GENERATED ALWAYS AS (
    CASE WHEN last_serviced_date IS NOT NULL
         THEN (CURRENT_DATE - last_serviced_date)::integer
         ELSE NULL END
  ) STORED,

  -- Execution (field)
  actual_start_date date,
  actual_start_time time without time zone,
  completion_date date,
  completion_time time without time zone,
  wind_speed_mph numeric,
  wind_direction text,
  air_temp_f numeric,
  tanks_used smallint,

  -- People
  pca_id uuid REFERENCES public.team(id),
  pca_rec_url text,
  urgency_level_id uuid REFERENCES public.urgency_levels(id),
  created_by uuid REFERENCES public.team(id),

  -- Notes
  notes_client text,
  notes_internal text,
  notes_technician text,

  -- Other
  po_number text,
  signature_url text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_orders_pkey PRIMARY KEY (id)
);

-- Prevent duplicate WO generation for same line item + period
CREATE UNIQUE INDEX work_orders_no_duplicate_period
  ON public.work_orders (agreement_line_item_id, period_year, period_month, COALESCE(period_week, 0))
  WHERE status != 'cancelled';

-- ============================================================
-- STEP 6: work_order_crew and work_order_photos now reference work_orders
-- ============================================================
ALTER TABLE public.work_order_crew
  DROP CONSTRAINT IF EXISTS work_order_crew_work_order_id_fkey;
ALTER TABLE public.work_order_crew
  ADD CONSTRAINT work_order_crew_work_order_id_fkey
    FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;

ALTER TABLE public.work_order_photos
  DROP CONSTRAINT IF EXISTS work_order_photos_work_order_id_fkey;
ALTER TABLE public.work_order_photos
  ADD CONSTRAINT work_order_photos_work_order_id_fkey
    FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 7: Auto-number trigger for work_orders
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_work_order_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.work_order_number IS NULL THEN
    NEW.work_order_number := 'WO-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
      LPAD(nextval('work_order_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE SEQUENCE IF NOT EXISTS work_order_number_seq START 1;
CREATE TRIGGER trg_set_work_order_number
  BEFORE INSERT ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_work_order_number();

-- ============================================================
-- STEP 8: WO generation function (called by Edge Function / pg_cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_work_orders_for_next_month()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  target_month smallint;
  target_year smallint;
  sal record;
  wo_count integer := 0;
  week_num smallint;
BEGIN
  -- Target = next month from today
  target_month := EXTRACT(MONTH FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'))::smallint;
  target_year  := EXTRACT(YEAR  FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'))::smallint;

  FOR sal IN
    SELECT
      li.id AS line_item_id,
      li.agreement_id,
      li.frequency,
      li.season_start_month,
      li.season_end_month,
      li.service_type_id,
      sa.client_id,
      sa.site_id,
      sa.pca_id,
      sa.po_number,
      sa.agreement_status
    FROM public.service_agreement_line_items li
    JOIN public.service_agreements sa ON sa.id = li.agreement_id
    WHERE sa.agreement_status = 'active'
      AND li.frequency IN ('monthly_seasonal', 'weekly_seasonal', 'annual')
  LOOP
    -- Check if target month falls within seasonal window
    IF sal.frequency IN ('monthly_seasonal', 'weekly_seasonal') THEN
      IF sal.season_start_month IS NULL OR sal.season_end_month IS NULL THEN
        CONTINUE;
      END IF;
      IF target_month < sal.season_start_month OR target_month > sal.season_end_month THEN
        CONTINUE;
      END IF;
    END IF;

    IF sal.frequency = 'monthly_seasonal' THEN
      INSERT INTO public.work_orders (
        service_agreement_id, agreement_line_item_id, client_id, site_id,
        service_type_id, period_month, period_year, pca_id, po_number, status
      )
      VALUES (
        sal.agreement_id, sal.line_item_id, sal.client_id, sal.site_id,
        sal.service_type_id, target_month, target_year, sal.pca_id, sal.po_number, 'unscheduled'
      )
      ON CONFLICT DO NOTHING;
      wo_count := wo_count + 1;

    ELSIF sal.frequency = 'weekly_seasonal' THEN
      FOR week_num IN 1..4 LOOP
        INSERT INTO public.work_orders (
          service_agreement_id, agreement_line_item_id, client_id, site_id,
          service_type_id, period_month, period_year, period_week, pca_id, po_number, status
        )
        VALUES (
          sal.agreement_id, sal.line_item_id, sal.client_id, sal.site_id,
          sal.service_type_id, target_month, target_year, week_num, sal.pca_id, sal.po_number, 'unscheduled'
        )
        ON CONFLICT DO NOTHING;
        wo_count := wo_count + 1;
      END LOOP;

    ELSIF sal.frequency = 'annual' THEN
      INSERT INTO public.work_orders (
        service_agreement_id, agreement_line_item_id, client_id, site_id,
        service_type_id, period_year, pca_id, po_number, status
      )
      VALUES (
        sal.agreement_id, sal.line_item_id, sal.client_id, sal.site_id,
        sal.service_type_id, target_year, sal.pca_id, sal.po_number, 'unscheduled'
      )
      ON CONFLICT DO NOTHING;
      wo_count := wo_count + 1;
    END IF;
  END LOOP;

  -- Also handle one_time line items that have never had a WO generated
  INSERT INTO public.work_orders (
    service_agreement_id, agreement_line_item_id, client_id, site_id,
    service_type_id, pca_id, po_number, status
  )
  SELECT
    li.agreement_id, li.id, sa.client_id, sa.site_id,
    li.service_type_id, sa.pca_id, sa.po_number, 'unscheduled'
  FROM public.service_agreement_line_items li
  JOIN public.service_agreements sa ON sa.id = li.agreement_id
  WHERE li.frequency = 'one_time'
    AND sa.agreement_status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.agreement_line_item_id = li.id AND wo.status != 'cancelled'
    )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('work_orders_generated', wo_count);
END;
$$;
