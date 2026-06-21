-- ============================================================
-- BuxHub - Create support-attachments storage bucket + policies
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read attachments
DROP POLICY IF EXISTS "support_attachments_read" ON storage.objects;
CREATE POLICY "support_attachments_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'support-attachments');

-- Allow authenticated users to upload to support-attachments
DROP POLICY IF EXISTS "support_attachments_upload" ON storage.objects;
CREATE POLICY "support_attachments_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'support-attachments'
    AND auth.role() = 'authenticated'
  );
