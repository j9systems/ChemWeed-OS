-- Fix: submitted_at was NOT NULL DEFAULT now(), which caused every draft
-- field_completion record (created when uploading a photo) to auto-populate
-- submitted_at, making the UI think the job was already completed.
-- Now submitted_at is only set explicitly when the user clicks "Mark Complete".

ALTER TABLE public.field_completions ALTER COLUMN submitted_at DROP NOT NULL;
ALTER TABLE public.field_completions ALTER COLUMN submitted_at DROP DEFAULT;

-- Clear submitted_at on existing draft records where the work order isn't completed
UPDATE public.field_completions fc
SET submitted_at = NULL
FROM public.work_orders wo
WHERE fc.work_order_id = wo.id
  AND wo.status != 'completed';
