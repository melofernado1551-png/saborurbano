
-- Create storage bucket for tenant logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for tenant logos
CREATE POLICY "Public read tenant logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-logos');

-- Authenticated users can upload tenant logos
CREATE POLICY "Authenticated users upload tenant logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tenant-logos' AND auth.role() = 'authenticated');

-- Authenticated users can update tenant logos
CREATE POLICY "Authenticated users update tenant logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tenant-logos' AND auth.role() = 'authenticated');

-- Authenticated users can delete tenant logos
CREATE POLICY "Authenticated users delete tenant logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'tenant-logos' AND auth.role() = 'authenticated');
