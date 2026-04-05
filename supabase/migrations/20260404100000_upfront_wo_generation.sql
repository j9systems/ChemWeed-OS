-- ============================================================
-- Drop the old monthly generation function
-- ============================================================
DROP FUNCTION IF EXISTS public.generate_work_orders_for_next_month();

-- ============================================================
-- New function: generate all WOs for a single agreement
-- Call this when an agreement is saved or reactivated
-- Safe to call multiple times -- ON CONFLICT DO NOTHING
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_work_orders_for_agreement(p_agreement_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  sa record;
  li record;
  gen_year integer;
  gen_month smallint;
  gen_week smallint;
  start_year integer;
  end_year integer;
  wo_count integer := 0;
BEGIN
  -- Load the agreement
  SELECT * INTO sa FROM public.service_agreements WHERE id = p_agreement_id;
  IF NOT FOUND OR sa.agreement_status NOT IN ('active', 'draft') THEN
    RETURN jsonb_build_object('work_orders_generated', 0, 'reason', 'agreement not found or inactive');
  END IF;

  -- Determine generation window
  -- start_year: year of contract_start_date, or current year if null
  start_year := COALESCE(
    EXTRACT(YEAR FROM sa.contract_start_date)::integer,
    EXTRACT(YEAR FROM CURRENT_DATE)::integer
  );

  -- end_year: year of contract_end_date, or next calendar year if open-ended
  -- Open-ended agreements generate through end of next year (rolling)
  end_year := COALESCE(
    EXTRACT(YEAR FROM sa.contract_end_date)::integer,
    EXTRACT(YEAR FROM CURRENT_DATE)::integer + 1
  );

  -- Loop each line item
  FOR li IN
    SELECT * FROM public.service_agreement_line_items
    WHERE agreement_id = p_agreement_id
  LOOP

    IF li.frequency = 'one_time' THEN
      -- Single WO, no period
      INSERT INTO public.work_orders (
        service_agreement_id, agreement_line_item_id,
        client_id, site_id, service_type_id,
        pca_id, po_number, status
      ) VALUES (
        sa.id, li.id,
        sa.client_id, sa.site_id, li.service_type_id,
        sa.pca_id, sa.po_number, 'unscheduled'
      )
      ON CONFLICT DO NOTHING;
      wo_count := wo_count + 1;

    ELSIF li.frequency = 'annual' THEN
      -- One WO per year in the window
      FOR gen_year IN start_year..end_year LOOP
        INSERT INTO public.work_orders (
          service_agreement_id, agreement_line_item_id,
          client_id, site_id, service_type_id,
          period_year, pca_id, po_number, status
        ) VALUES (
          sa.id, li.id,
          sa.client_id, sa.site_id, li.service_type_id,
          gen_year, sa.pca_id, sa.po_number, 'unscheduled'
        )
        ON CONFLICT DO NOTHING;
        wo_count := wo_count + 1;
      END LOOP;

    ELSIF li.frequency = 'monthly_seasonal' THEN
      -- Validate season window
      IF li.season_start_month IS NULL OR li.season_end_month IS NULL THEN
        CONTINUE;
      END IF;
      FOR gen_year IN start_year..end_year LOOP
        FOR gen_month IN li.season_start_month..li.season_end_month LOOP
          INSERT INTO public.work_orders (
            service_agreement_id, agreement_line_item_id,
            client_id, site_id, service_type_id,
            period_year, period_month,
            pca_id, po_number, status
          ) VALUES (
            sa.id, li.id,
            sa.client_id, sa.site_id, li.service_type_id,
            gen_year, gen_month,
            sa.pca_id, sa.po_number, 'unscheduled'
          )
          ON CONFLICT DO NOTHING;
          wo_count := wo_count + 1;
        END LOOP;
      END LOOP;

    ELSIF li.frequency = 'weekly_seasonal' THEN
      IF li.season_start_month IS NULL OR li.season_end_month IS NULL THEN
        CONTINUE;
      END IF;
      FOR gen_year IN start_year..end_year LOOP
        FOR gen_month IN li.season_start_month..li.season_end_month LOOP
          FOR gen_week IN 1..4 LOOP
            INSERT INTO public.work_orders (
              service_agreement_id, agreement_line_item_id,
              client_id, site_id, service_type_id,
              period_year, period_month, period_week,
              pca_id, po_number, status
            ) VALUES (
              sa.id, li.id,
              sa.client_id, sa.site_id, li.service_type_id,
              gen_year, gen_month, gen_week,
              sa.pca_id, sa.po_number, 'unscheduled'
            )
            ON CONFLICT DO NOTHING;
            wo_count := wo_count + 1;
          END LOOP;
        END LOOP;
      END LOOP;
    END IF;

  END LOOP;

  RETURN jsonb_build_object('work_orders_generated', wo_count);
END;
$$;

-- ============================================================
-- Safety-net function: re-run generation for ALL active
-- agreements. Used by the manual "Generate" button and
-- optionally by a once-yearly cron on Jan 1 to extend
-- open-ended agreements into the new year.
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_work_orders_all_active()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  sa_id uuid;
  total integer := 0;
  result jsonb;
BEGIN
  FOR sa_id IN
    SELECT id FROM public.service_agreements
    WHERE agreement_status = 'active'
  LOOP
    result := public.generate_work_orders_for_agreement(sa_id);
    total := total + (result->>'work_orders_generated')::integer;
  END LOOP;
  RETURN jsonb_build_object('work_orders_generated', total);
END;
$$;
