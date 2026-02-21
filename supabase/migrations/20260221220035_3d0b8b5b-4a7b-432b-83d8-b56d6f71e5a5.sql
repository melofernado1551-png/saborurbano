
-- Add cnpj column to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cnpj text;

-- Change category to support multiple (store as comma-separated or use text[] - we'll use text for simplicity with existing data)
-- category already exists as text, we'll store comma-separated values
