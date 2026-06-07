CREATE TABLE public.muted_cameras (
  camera_id text PRIMARY KEY,
  camera_name text,
  reason text,
  muted_until timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  muted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.muted_cameras TO authenticated;
GRANT ALL ON public.muted_cameras TO service_role;
ALTER TABLE public.muted_cameras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read muted" ON public.muted_cameras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Ops manage muted" ON public.muted_cameras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.muted_cameras;