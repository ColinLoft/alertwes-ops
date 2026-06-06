
CREATE TYPE public.maint_kind AS ENUM ('scheduled', 'unscheduled', 'inspection');

CREATE TABLE public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id UUID NOT NULL REFERENCES public.drones(id) ON DELETE CASCADE,
  kind public.maint_kind NOT NULL DEFAULT 'scheduled',
  description TEXT NOT NULL,
  hours_at NUMERIC,
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX maintenance_logs_drone_idx ON public.maintenance_logs (drone_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_logs TO authenticated;
GRANT ALL ON public.maintenance_logs TO service_role;

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All signed-in users can read maintenance logs"
  ON public.maintenance_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Maintenance/admin can insert logs"
  ON public.maintenance_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'maintenance') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Maintenance/admin can update logs"
  ON public.maintenance_logs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'maintenance') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete logs"
  ON public.maintenance_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
