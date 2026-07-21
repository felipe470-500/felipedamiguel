CREATE POLICY "Public can view vehicle images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'vehicle-images');