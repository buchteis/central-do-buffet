
CREATE POLICY "Owners can view own logos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'buffet-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners can upload own logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'buffet-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners can update own logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'buffet-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners can delete own logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'buffet-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
