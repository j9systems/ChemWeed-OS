-- Apr 27 meeting updates: per_visit pricing, sort_order, recommendation_notes,
-- service type cleanup, and feedback status updates.

-- 1. Add per_visit to service_types pricing_model CHECK constraint
ALTER TABLE public.service_types
  DROP CONSTRAINT IF EXISTS service_types_pricing_model_check;
ALTER TABLE public.service_types
  ADD CONSTRAINT service_types_pricing_model_check
  CHECK (pricing_model IN ('per_acre', 'per_hour', 'flat_rate', 'per_visit'));

-- 2. Add sort_order column to service_types
ALTER TABLE public.service_types
  ADD COLUMN IF NOT EXISTS sort_order integer;

COMMENT ON COLUMN public.service_types.sort_order
  IS 'Fixed position number for internal sorting/reference';

-- 3. Add recommendation_notes to service_agreements
ALTER TABLE public.service_agreements
  ADD COLUMN IF NOT EXISTS recommendation_notes text;

COMMENT ON COLUMN public.service_agreements.recommendation_notes
  IS 'Recommendation/warning text shown on proposal above the signature block';

-- 4. Strip number prefixes from active service type names
UPDATE public.service_types SET name = 'POWER STRIKE TREATMENT'         WHERE name = '0 - POWER STRIKE TREATMENT';
UPDATE public.service_types SET name = 'FOUNDATION TREATMENT SERVICE'   WHERE name = '1 - FOUNDATION TREATMENT SERVICE';
UPDATE public.service_types SET name = 'KICK START PACKAGE'             WHERE name = '2 - KICK START PACKAGE';
UPDATE public.service_types SET name = 'QUALITY ASSURANCE PACKAGE(QAP)' WHERE name = '3 - QUALITY ASSURANCE PACKAGE(QAP)';
UPDATE public.service_types SET name = 'QUALITY PERFECTION PACKAGE(QPP)' WHERE name = '4 - QUALITY PERFECTION PACKAGE(QPP)';
UPDATE public.service_types SET name = 'MECHANICAL CONTROL MEASURE'     WHERE name = '5 - MECHANICAL CONTROL MEASURE';

-- 5. Set sort_order to match Christian's original numbering
UPDATE public.service_types SET sort_order = 0 WHERE name = 'POWER STRIKE TREATMENT';
UPDATE public.service_types SET sort_order = 1 WHERE name = 'FOUNDATION TREATMENT SERVICE';
UPDATE public.service_types SET sort_order = 2 WHERE name = 'KICK START PACKAGE';
UPDATE public.service_types SET sort_order = 3 WHERE name = 'QUALITY ASSURANCE PACKAGE(QAP)';
UPDATE public.service_types SET sort_order = 4 WHERE name = 'QUALITY PERFECTION PACKAGE(QPP)';
UPDATE public.service_types SET sort_order = 5 WHERE name = 'MECHANICAL CONTROL MEASURE';

-- 6. Update QAP and QPP pricing model to per_visit
UPDATE public.service_types SET pricing_model = 'per_visit'
  WHERE name IN ('QUALITY ASSURANCE PACKAGE(QAP)', 'QUALITY PERFECTION PACKAGE(QPP)');

-- 7. Hard-delete inactive service types (confirmed by Christian Apr 27)
DELETE FROM public.service_types WHERE is_active = false;

-- 8. Mark confirmed-fixed feedback items as resolved
UPDATE public.feedback_items SET status = 'resolved'
  WHERE title ILIKE '%resets progress%' OR title ILIKE '%still resets%';
UPDATE public.feedback_items SET status = 'resolved'
  WHERE title ILIKE '%crash%' AND type = 'bug';
