-- Create the site-photos storage bucket (public for getPublicUrl)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-photos', 'site-photos', true);

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload site photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'site-photos');

-- Authenticated users can update
CREATE POLICY "Authenticated users can update site photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'site-photos');

-- Public read access (needed for getPublicUrl)
CREATE POLICY "Anyone can view site photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'site-photos');

-- Authenticated users can delete
CREATE POLICY "Authenticated users can delete site photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'site-photos');
