
CREATE TABLE public.bolos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bolo_type text NOT NULL DEFAULT 'person',
  last_name text,
  first_name text,
  dob date,
  race text,
  sex text,
  age int,
  height text,
  weight text,
  plate text,
  vehicle_desc text,
  reason text,
  details text,
  status text NOT NULL DEFAULT 'active',
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bolos TO authenticated;
GRANT ALL ON public.bolos TO service_role;
ALTER TABLE public.bolos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bolos read" ON public.bolos FOR SELECT TO authenticated USING (true);
CREATE POLICY "bolos insert" ON public.bolos FOR INSERT TO authenticated WITH CHECK (auth.uid() = issued_by);
CREATE POLICY "bolos update own/admin" ON public.bolos FOR UPDATE TO authenticated USING (auth.uid() = issued_by OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = issued_by OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "bolos delete own/admin" ON public.bolos FOR DELETE TO authenticated USING (auth.uid() = issued_by OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_bolos_updated BEFORE UPDATE ON public.bolos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_no text,
  violator jsonb NOT NULL DEFAULT '{}'::jsonb,
  vehicle jsonb NOT NULL DEFAULT '{}'::jsonb,
  violation jsonb NOT NULL DEFAULT '{}'::jsonb,
  fine_amount numeric,
  court_date date,
  court_location text,
  officer uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.citations TO authenticated;
GRANT ALL ON public.citations TO service_role;
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "citations read" ON public.citations FOR SELECT TO authenticated USING (true);
CREATE POLICY "citations insert" ON public.citations FOR INSERT TO authenticated WITH CHECK (auth.uid() = officer);
CREATE POLICY "citations update own/admin" ON public.citations FOR UPDATE TO authenticated USING (auth.uid() = officer OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = officer OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "citations delete own/admin" ON public.citations FOR DELETE TO authenticated USING (auth.uid() = officer OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_citations_updated BEFORE UPDATE ON public.citations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
