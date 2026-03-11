
INSERT INTO storage.buckets (id, name, public) VALUES ('sponsors', 'sponsors', true);

CREATE POLICY "Public read sponsor images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sponsors');

CREATE POLICY "Admins can delete sponsor images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'sponsors');
