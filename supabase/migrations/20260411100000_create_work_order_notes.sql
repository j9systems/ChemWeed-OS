-- Create work_order_notes table for user-created notes on work orders.

CREATE TABLE public.work_order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.team(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_order_notes_wo_id ON public.work_order_notes(work_order_id);

ALTER TABLE public.work_order_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read work_order_notes"
  ON public.work_order_notes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert work_order_notes"
  ON public.work_order_notes FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete work_order_notes"
  ON public.work_order_notes FOR DELETE
  TO authenticated USING (true);
