
CREATE POLICY "lm_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'listing-media');
CREATE POLICY "lm_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'listing-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "lm_owner_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'listing-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "lm_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'listing-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "kyc_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "kyc_owner_or_admin_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-docs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "ca_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "ca_owner_or_admin_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
