-- Create field_completions table to store detailed field logs
-- (chemicals used, photos, signatures, crew, weather) for work orders.

CREATE TABLE public.field_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  completed_by uuid NOT NULL REFERENCES public.team(id),
  actual_start_at timestamptz,
  temperature_f numeric,
  wind_speed_mph numeric,
  wind_direction text,
  crew_ids uuid[] DEFAULT '{}',
  notes text,
  signature_data_url text,
  photo_urls text[] DEFAULT '{}',
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.field_completions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (matches pattern used by other tables)
CREATE POLICY "Authenticated users can read field_completions"
  ON public.field_completions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert field_completions"
  ON public.field_completions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update field_completions"
  ON public.field_completions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
