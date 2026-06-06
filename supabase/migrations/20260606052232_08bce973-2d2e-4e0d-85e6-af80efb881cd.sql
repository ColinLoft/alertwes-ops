
CREATE TABLE public.user_branding (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT,
  logo_data_url TEXT,
  primary_color TEXT,
  accent_color TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_branding TO authenticated;
GRANT ALL ON public.user_branding TO service_role;

ALTER TABLE public.user_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own branding" ON public.user_branding
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own branding" ON public.user_branding
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own branding" ON public.user_branding
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own branding" ON public.user_branding
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER user_branding_touch BEFORE UPDATE ON public.user_branding
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
