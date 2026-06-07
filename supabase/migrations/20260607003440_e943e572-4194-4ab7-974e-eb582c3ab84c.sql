
-- ============ USER PROFILES (approval gate) ============
CREATE TYPE public.profile_status AS ENUM ('pending','approved','denied');

CREATE TABLE public.user_profiles (
  user_id uuid PRIMARY KEY,
  status public.profile_status NOT NULL DEFAULT 'pending',
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all profiles" ON public.user_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update profiles" ON public.user_profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own profile" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tr_user_profiles_updated BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)), 'pending')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users
INSERT INTO public.user_profiles (user_id, email, status)
SELECT u.id, u.email, 'approved'::profile_status
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- Approved checker
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = _user_id AND status = 'approved')
$$;

-- Update claim_first_admin to also approve self
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  admin_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT count(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count > 0 THEN RAISE EXCEPTION 'Admin already exists'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin');
  UPDATE public.user_profiles SET status='approved', approved_at=now(), approved_by=uid WHERE user_id=uid;
END $$;

-- Admin approve helper
CREATE OR REPLACE FUNCTION public.approve_user(_user_id uuid, _role public.app_role DEFAULT 'dispatcher')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.user_profiles SET status='approved', approved_at=now(), approved_by=auth.uid() WHERE user_id=_user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.deny_user(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.user_profiles SET status='denied' WHERE user_id=_user_id;
  DELETE FROM public.user_roles WHERE user_id=_user_id;
END $$;

-- ============ DETECTION AREA (singleton) ============
CREATE TABLE public.detection_area (
  id boolean PRIMARY KEY DEFAULT true,
  center_lat numeric NOT NULL DEFAULT 37.5,
  center_lng numeric NOT NULL DEFAULT -120.0,
  radius_mi numeric NOT NULL DEFAULT 150,
  states text[] NOT NULL DEFAULT '{CA}',
  counties text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT singleton CHECK (id = true)
);
GRANT SELECT, INSERT, UPDATE ON public.detection_area TO authenticated;
GRANT ALL ON public.detection_area TO service_role;
ALTER TABLE public.detection_area ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read area" ON public.detection_area FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write area" ON public.detection_area FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.detection_area (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ============ INCIDENT SUGGESTIONS (AI triage) ============
CREATE TYPE public.suggestion_status AS ENUM ('pending','promoted','dismissed');
CREATE TYPE public.suggestion_label AS ENUM ('smoke','fire','clear');

CREATE TABLE public.incident_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  camera_id text,
  camera_name text,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  state text,
  county text,
  label public.suggestion_label NOT NULL,
  confidence smallint NOT NULL,
  reasoning text,
  image_url text,
  image_time timestamptz,
  status public.suggestion_status NOT NULL DEFAULT 'pending',
  incident_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.incident_suggestions TO authenticated;
GRANT ALL ON public.incident_suggestions TO service_role;
ALTER TABLE public.incident_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read suggestions" ON public.incident_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert suggestions" ON public.incident_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Ops update suggestions" ON public.incident_suggestions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'));

CREATE INDEX idx_suggestions_pending ON public.incident_suggestions(status, created_at DESC);
CREATE UNIQUE INDEX idx_suggestions_recent_camera
  ON public.incident_suggestions(camera_id, image_time)
  WHERE camera_id IS NOT NULL AND image_time IS NOT NULL;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_suggestions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.detection_area;

-- Drop unused tables (maintenance/personnel pages removed)
DROP TABLE IF EXISTS public.maintenance_logs;
