INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('feedback-attachments', 'feedback-attachments', true, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "feedback_attachments_bucket_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'feedback-attachments');

CREATE POLICY "feedback_attachments_bucket_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-attachments');

CREATE POLICY "feedback_attachments_bucket_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feedback-attachments' AND owner = auth.uid());
