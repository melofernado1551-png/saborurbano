
-- Create system_configs table for global settings
CREATE TABLE public.system_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  favicon_url text,
  site_title text NOT NULL DEFAULT 'Sabor Urbano',
  site_subtitle text NOT NULL DEFAULT 'Descubra os melhores sabores da sua cidade',
  active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

-- Public read (everyone needs to see title/favicon)
CREATE POLICY "Public read system_configs"
  ON public.system_configs FOR SELECT
  USING (active = true);

-- Only superadmin can insert
CREATE POLICY "Superadmin insert system_configs"
  ON public.system_configs FOR INSERT
  WITH CHECK (is_superadmin(auth.uid()));

-- Only superadmin can update
CREATE POLICY "Superadmin update system_configs"
  ON public.system_configs FOR UPDATE
  USING (is_superadmin(auth.uid()));

-- Only superadmin can delete
CREATE POLICY "Superadmin delete system_configs"
  ON public.system_configs FOR DELETE
  USING (is_superadmin(auth.uid()));

-- Insert default row
INSERT INTO public.system_configs (site_title, site_subtitle) 
VALUES ('Sabor Urbano', 'Descubra os melhores sabores da sua cidade');

-- Create storage bucket for favicon
INSERT INTO storage.buckets (id, name, public) VALUES ('system-assets', 'system-assets', true);

-- Public read for system assets
CREATE POLICY "Public read system assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'system-assets');

-- Superadmin upload system assets
CREATE POLICY "Superadmin upload system assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'system-assets' AND is_superadmin(auth.uid()));

-- Superadmin update system assets
CREATE POLICY "Superadmin update system assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'system-assets' AND is_superadmin(auth.uid()));

-- Superadmin delete system assets
CREATE POLICY "Superadmin delete system assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'system-assets' AND is_superadmin(auth.uid()));
