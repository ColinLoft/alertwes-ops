
-- Enums
CREATE TYPE public.incident_status AS ENUM ('new','triaging','dispatched','onscene','contained','closed','false_positive');
CREATE TYPE public.incident_priority AS ENUM ('p1','p2','p3','p4');
CREATE TYPE public.incident_source AS ENUM ('alertwest','firms','nws','user','manual','other');

-- Incidents
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text,
  title text NOT NULL,
  source public.incident_source NOT NULL DEFAULT 'manual',
  status public.incident_status NOT NULL DEFAULT 'new',
  priority public.incident_priority NOT NULL DEFAULT 'p3',
  confidence smallint,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  county text,
  state text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  acreage numeric,
  frp numeric,
  assigned_drone_id uuid REFERENCES public.drones(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX idx_incidents_status ON public.incidents(status);
CREATE INDEX idx_incidents_discovered_at ON public.incidents(discovered_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read incidents" ON public.incidents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Dispatchers and admins create incidents" ON public.incidents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  );

CREATE POLICY "Ops update incidents" ON public.incidents
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'pilot')
    OR public.has_role(auth.uid(), 'maintenance')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'pilot')
    OR public.has_role(auth.uid(), 'maintenance')
  );

CREATE POLICY "Admins delete incidents" ON public.incidents
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Incident events (audit/timeline)
CREATE TABLE public.incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text,
  payload jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_events_incident ON public.incident_events(incident_id, created_at DESC);

GRANT SELECT, INSERT ON public.incident_events TO authenticated;
GRANT ALL ON public.incident_events TO service_role;

ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read incident events" ON public.incident_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth append incident events" ON public.incident_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_events;
