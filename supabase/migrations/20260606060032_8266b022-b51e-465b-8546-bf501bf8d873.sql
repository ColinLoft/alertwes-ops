
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'dispatcher', 'pilot', 'maintenance');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users read own role rows" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Airframes (drone model catalog)
CREATE TABLE public.airframes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL UNIQUE,
  manufacturer text,
  range_mi numeric NOT NULL DEFAULT 100,
  cruise_speed_mph numeric NOT NULL DEFAULT 90,
  retardant_capacity_l numeric NOT NULL DEFAULT 20,
  endurance_min integer NOT NULL DEFAULT 90,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.airframes TO authenticated;
GRANT ALL ON public.airframes TO service_role;
ALTER TABLE public.airframes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read airframes" ON public.airframes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage airframes" ON public.airframes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER airframes_touch BEFORE UPDATE ON public.airframes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Bases
CREATE TABLE public.bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  city text,
  state text,
  hangar_capacity integer NOT NULL DEFAULT 4,
  is_hq boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bases TO authenticated;
GRANT ALL ON public.bases TO service_role;
ALTER TABLE public.bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read bases" ON public.bases
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage bases" ON public.bases
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER bases_touch BEFORE UPDATE ON public.bases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Drones
CREATE TYPE public.drone_status AS ENUM (
  'ready','preflight','inflight','returning','charging','maintenance','offline'
);

CREATE TABLE public.drones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tail_number text NOT NULL UNIQUE,
  airframe_id uuid REFERENCES public.airframes(id) ON DELETE SET NULL,
  base_id uuid REFERENCES public.bases(id) ON DELETE SET NULL,
  status public.drone_status NOT NULL DEFAULT 'ready',
  battery_pct integer NOT NULL DEFAULT 100 CHECK (battery_pct BETWEEN 0 AND 100),
  retardant_l numeric NOT NULL DEFAULT 0,
  flight_hours numeric NOT NULL DEFAULT 0,
  last_lat numeric,
  last_lng numeric,
  heading_deg numeric,
  last_telemetry_at timestamptz,
  next_service_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.drones TO authenticated;
GRANT ALL ON public.drones TO service_role;
ALTER TABLE public.drones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read drones" ON public.drones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage drones" ON public.drones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Dispatchers and pilots update drone status" ON public.drones
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'pilot') OR public.has_role(auth.uid(), 'maintenance'))
  WITH CHECK (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'pilot') OR public.has_role(auth.uid(), 'maintenance'));

CREATE TRIGGER drones_touch BEFORE UPDATE ON public.drones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.drones;

-- 6. Seed data
INSERT INTO public.airframes (model, manufacturer, range_mi, cruise_speed_mph, retardant_capacity_l, endurance_min, notes)
VALUES
  ('Aegis-1 Scout', 'Aegis Aerospace', 90, 85, 18, 80, 'Initial production airframe — fixed wing, electric, autonomous wildfire response.'),
  ('Aegis-1X Extended', 'Aegis Aerospace', 110, 95, 22, 110, 'Extended-range variant for remote response.');

INSERT INTO public.bases (code, name, lat, lng, city, state, hangar_capacity, is_hq, notes)
VALUES
  ('FAT-HQ', 'Fresno HQ', 36.7762, -119.7181, 'Fresno', 'CA', 4, true, 'Initial company HQ and operational base.');

-- Seed 4 demo drones at Fresno HQ
WITH base AS (
  SELECT id FROM public.bases WHERE code = 'FAT-HQ'
),
af1 AS (SELECT id FROM public.airframes WHERE model = 'Aegis-1 Scout'),
af2 AS (SELECT id FROM public.airframes WHERE model = 'Aegis-1X Extended')
INSERT INTO public.drones (tail_number, airframe_id, base_id, status, battery_pct, retardant_l, flight_hours, last_lat, last_lng)
SELECT * FROM (
  VALUES
    ('N401AE', (SELECT id FROM af1), (SELECT id FROM base), 'ready'::public.drone_status, 100, 18, 12.4, 36.7762, -119.7181),
    ('N402AE', (SELECT id FROM af1), (SELECT id FROM base), 'charging'::public.drone_status, 62, 18, 41.1, 36.7762, -119.7181),
    ('N403AE', (SELECT id FROM af2), (SELECT id FROM base), 'ready'::public.drone_status, 98, 22, 7.8, 36.7762, -119.7181),
    ('N404AE', (SELECT id FROM af1), (SELECT id FROM base), 'maintenance'::public.drone_status, 0, 0, 188.2, 36.7762, -119.7181)
) AS v(tail_number, airframe_id, base_id, status, battery_pct, retardant_l, flight_hours, last_lat, last_lng);
