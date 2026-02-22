
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'false'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Superadmin update settings" ON public.app_settings FOR UPDATE USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin insert settings" ON public.app_settings FOR INSERT WITH CHECK (is_superadmin(auth.uid()));

INSERT INTO public.app_settings (key, value) VALUES ('weather_banner_active', 'false');
