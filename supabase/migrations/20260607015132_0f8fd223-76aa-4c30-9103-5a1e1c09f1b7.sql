
CREATE TABLE public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  author uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_reports TO authenticated;
GRANT ALL ON public.incident_reports TO service_role;

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read reports" ON public.incident_reports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Ops create reports" ON public.incident_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Ops update reports" ON public.incident_reports
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher') OR author = auth.uid())
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher') OR author = auth.uid());
CREATE POLICY "Admins delete reports" ON public.incident_reports
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_incident_reports_touch
  BEFORE UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_incident_reports_incident ON public.incident_reports(incident_id);
CREATE INDEX idx_incident_reports_created ON public.incident_reports(created_at DESC);
