-- Fix: A trigger on the clients table references NEW.updated_at, but the column
-- doesn't exist, causing "record 'new' has no field 'updated_at'" on any update.
-- Add the missing column and backfill it from created_at.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.clients SET updated_at = created_at WHERE updated_at = now();

-- Ensure the trigger function exists (auto-set updated_at on every UPDATE)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate trigger (idempotent: drop first if exists)
DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
