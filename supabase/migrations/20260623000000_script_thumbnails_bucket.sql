-- Script thumbnails storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('script-thumbnails', 'script-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Everyone can read script thumbnails
DROP POLICY IF EXISTS "script_thumbnails_public_read" ON storage.objects;
CREATE POLICY "script_thumbnails_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'script-thumbnails');

-- Admins/staff can upload thumbnails
DROP POLICY IF EXISTS "script_thumbnails_staff_upload" ON storage.objects;
CREATE POLICY "script_thumbnails_staff_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'script-thumbnails'
    AND auth.role() = 'authenticated'
  );

-- Admins/staff can update
DROP POLICY IF EXISTS "script_thumbnails_staff_update" ON storage.objects;
CREATE POLICY "script_thumbnails_staff_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'script-thumbnails'
    AND auth.role() = 'authenticated'
  );
