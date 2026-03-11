
-- Fix: INSERT policy only uses WITH CHECK, not USING
CREATE POLICY "Admins can upload sponsor images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sponsors');
