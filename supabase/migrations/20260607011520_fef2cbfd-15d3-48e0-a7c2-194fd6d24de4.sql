
-- Add mode column to detection_area
ALTER TABLE public.detection_area
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'address',
  ADD COLUMN IF NOT EXISTS address text;

-- Create response_area (mirrors detection_area, single row)
CREATE TABLE IF NOT EXISTS public.response_area (
  id boolean PRIMARY KEY DEFAULT true,
  mode text NOT NULL DEFAULT 'address',
  address text,
  center_lat numeric NOT NULL DEFAULT 37.5,
  center_lng numeric NOT NULL DEFAULT -120.0,
  radius_mi numeric NOT NULL DEFAULT 150,
  states text[] NOT NULL DEFAULT '{CA}',
  counties text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT response_area_singleton CHECK (id = true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.response_area TO authenticated;
GRANT ALL ON public.response_area TO service_role;

ALTER TABLE public.response_area ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read response area" ON public.response_area;
CREATE POLICY "Auth read response area" ON public.response_area FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins write response area" ON public.response_area;
CREATE POLICY "Admins write response area" ON public.response_area FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.response_area (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
