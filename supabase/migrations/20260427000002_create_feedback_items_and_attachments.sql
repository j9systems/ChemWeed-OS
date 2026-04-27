-- Bug reports + feature requests submitted by app users.
CREATE TABLE public.feedback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('bug', 'feature')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notify_on_resolve boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feedback_items_status_idx ON public.feedback_items(status);
CREATE INDEX feedback_items_type_idx ON public.feedback_items(type);
CREATE INDEX feedback_items_submitted_by_idx ON public.feedback_items(submitted_by);

CREATE TABLE public.feedback_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_item_id uuid NOT NULL REFERENCES public.feedback_items(id) ON DELETE CASCADE,
  url text NOT NULL,
  filename text,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feedback_attachments_feedback_item_id_idx
  ON public.feedback_attachments(feedback_item_id);

CREATE OR REPLACE FUNCTION public.feedback_items_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    NEW.resolved_at := now();
    IF NEW.resolved_by IS NULL THEN
      NEW.resolved_by := auth.uid();
    END IF;
  ELSIF NEW.status <> 'resolved' THEN
    NEW.resolved_at := NULL;
    NEW.resolved_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER feedback_items_touch_trg
  BEFORE UPDATE ON public.feedback_items
  FOR EACH ROW EXECUTE FUNCTION public.feedback_items_touch();

ALTER TABLE public.feedback_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_items_select_authenticated"
  ON public.feedback_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "feedback_items_insert_authenticated"
  ON public.feedback_items FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "feedback_items_update_authenticated"
  ON public.feedback_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "feedback_items_delete_submitter"
  ON public.feedback_items FOR DELETE TO authenticated
  USING (submitted_by = auth.uid());

CREATE POLICY "feedback_attachments_select_authenticated"
  ON public.feedback_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "feedback_attachments_insert_authenticated"
  ON public.feedback_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "feedback_attachments_delete_uploader"
  ON public.feedback_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());
