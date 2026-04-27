-- Apr 20 2026 ChemWeed review: track who gets commission for the sale
-- separately from who created the agreement record.
ALTER TABLE public.service_agreements
  ADD COLUMN sales_rep_id uuid REFERENCES public.team(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_agreements_sales_rep_id_idx
  ON public.service_agreements(sales_rep_id);

COMMENT ON COLUMN public.service_agreements.sales_rep_id IS
  'Team member credited with the sale (separate from created_by). Used for commission tracking. Apr 20 2026 ChemWeed review.';
