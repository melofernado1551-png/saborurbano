
-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-receipts', 'payment-receipts', true);

-- Customers can upload receipts to their folder
CREATE POLICY "Customers upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-receipts' AND
  auth.uid() IS NOT NULL
);

-- Public read access for receipts
CREATE POLICY "Public read receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-receipts');

-- Customers can delete their own receipts
CREATE POLICY "Customers delete own receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-receipts' AND
  auth.uid() IS NOT NULL
);
