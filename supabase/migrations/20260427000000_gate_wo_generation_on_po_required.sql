-- Apr 20 2026 ChemWeed review: when a client has po_required = true and the
-- agreement does not yet have a po_number, generate_work_orders_for_agreement
-- must skip insertion and signal the gate via reason = 'po_required'.
CREATE OR REPLACE FUNCTION public.generate_work_orders_for_agreement(p_agreement_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  sa record;
  client_po_required boolean;
  li record;
  gen_year integer;
  gen_month smallint;
  gen_week smallint;
  start_year integer;
  end_year integer;
  contract_start_month smallint;
  contract_end_month smallint;
  effective_season_start smallint;
  effective_season_end smallint;
  current_year integer;
  current_month smallint;
  wo_count integer := 0;
  deleted_count integer := 0;
BEGIN
  SELECT * INTO sa FROM public.service_agreements WHERE id = p_agreement_id;
  IF NOT FOUND OR sa.agreement_status NOT IN ('active', 'draft') THEN
    RETURN jsonb_build_object('work_orders_generated', 0, 'reason', 'agreement not found or inactive');
  END IF;

  SELECT po_required INTO client_po_required FROM public.clients WHERE id = sa.client_id;
  IF COALESCE(client_po_required, false) = true
     AND (sa.po_number IS NULL OR btrim(sa.po_number) = '') THEN
    RETURN jsonb_build_object(
      'work_orders_generated', 0,
      'work_orders_cleaned_up', 0,
      'reason', 'po_required'
    );
  END IF;

  current_year  := EXTRACT(YEAR  FROM CURRENT_DATE)::integer;
  current_month := EXTRACT(MONTH FROM CURRENT_DATE)::smallint;

  start_year := COALESCE(EXTRACT(YEAR FROM sa.contract_start_date)::integer, current_year);
  contract_start_month := COALESCE(EXTRACT(MONTH FROM sa.contract_start_date)::smallint, 1);
  end_year := COALESCE(EXTRACT(YEAR FROM sa.contract_end_date)::integer, current_year);
  contract_end_month := COALESCE(EXTRACT(MONTH FROM sa.contract_end_date)::smallint, 12);

  DELETE FROM public.work_orders
  WHERE service_agreement_id = p_agreement_id
    AND status = 'unscheduled'
    AND period_year IS NOT NULL
    AND (
      period_year < start_year
      OR period_year > end_year
      OR (period_year = end_year   AND period_month IS NOT NULL AND period_month > contract_end_month)
      OR (period_year = start_year AND period_month IS NOT NULL AND period_month < contract_start_month)
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  FOR li IN
    SELECT * FROM public.service_agreement_line_items
    WHERE agreement_id = p_agreement_id
  LOOP

    IF li.frequency = 'one_time' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.work_orders
        WHERE agreement_line_item_id = li.id AND status != 'cancelled'
      ) THEN
        INSERT INTO public.work_orders (
          service_agreement_id, agreement_line_item_id,
          client_id, site_id, service_type_id,
          pca_id, po_number, status
        ) VALUES (
          sa.id, li.id,
          sa.client_id, sa.site_id, li.service_type_id,
          sa.pca_id, sa.po_number, 'unscheduled'
        );
        wo_count := wo_count + 1;
      END IF;

    ELSIF li.frequency = 'annual' THEN
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
      IF li.season_start_month IS NULL OR li.season_end_month IS NULL THEN
        CONTINUE;
      END IF;
      FOR gen_year IN start_year..end_year LOOP
        effective_season_start := li.season_start_month;
        IF gen_year = start_year THEN
          effective_season_start := GREATEST(effective_season_start, contract_start_month);
        END IF;
        IF gen_year = current_year THEN
          effective_season_start := GREATEST(effective_season_start, current_month);
        END IF;
        effective_season_end := li.season_end_month;
        IF gen_year = end_year THEN
          effective_season_end := LEAST(effective_season_end, contract_end_month);
        END IF;
        IF effective_season_start > effective_season_end THEN
          CONTINUE;
        END IF;
        FOR gen_month IN effective_season_start..effective_season_end LOOP
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
        effective_season_start := li.season_start_month;
        IF gen_year = start_year THEN
          effective_season_start := GREATEST(effective_season_start, contract_start_month);
        END IF;
        IF gen_year = current_year THEN
          effective_season_start := GREATEST(effective_season_start, current_month);
        END IF;
        effective_season_end := li.season_end_month;
        IF gen_year = end_year THEN
          effective_season_end := LEAST(effective_season_end, contract_end_month);
        END IF;
        IF effective_season_start > effective_season_end THEN
          CONTINUE;
        END IF;
        FOR gen_month IN effective_season_start..effective_season_end LOOP
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

  RETURN jsonb_build_object(
    'work_orders_generated', wo_count,
    'work_orders_cleaned_up', deleted_count
  );
END;
$function$;
