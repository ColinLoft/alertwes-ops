
-- Tighten SELECT policies on operational tables to specific roles
DROP POLICY IF EXISTS "bolos read" ON public.bolos;
CREATE POLICY "bolos read authorized" ON public.bolos FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher') OR has_role(auth.uid(),'pilot'));

DROP POLICY IF EXISTS "citations read" ON public.citations;
CREATE POLICY "citations read authorized" ON public.citations FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR auth.uid() = officer);

DROP POLICY IF EXISTS "Auth read drones" ON public.drones;
CREATE POLICY "Drones read operational" ON public.drones FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher') OR has_role(auth.uid(),'pilot') OR has_role(auth.uid(),'maintenance'));

DROP POLICY IF EXISTS "Auth read incident events" ON public.incident_events;
CREATE POLICY "Incident events read ops" ON public.incident_events FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher') OR has_role(auth.uid(),'pilot'));

DROP POLICY IF EXISTS "Auth read reports" ON public.incident_reports;
CREATE POLICY "Incident reports read ops" ON public.incident_reports FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher') OR author = auth.uid());

DROP POLICY IF EXISTS "Auth read incidents" ON public.incidents;
CREATE POLICY "Incidents read ops" ON public.incidents FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher') OR has_role(auth.uid(),'pilot') OR has_role(auth.uid(),'maintenance'));

-- Lock down SECURITY DEFINER functions: revoke public/anon EXECUTE.
-- Trigger functions do not need EXECUTE grants; revoke from authenticated too.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_create_incident_report() FROM PUBLIC, anon, authenticated;

-- Helper functions used by RLS: revoke from anon; authenticated must retain EXECUTE for RLS.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;

-- Admin RPCs: revoke from anon; authenticated retained (internal role checks enforce authorization).
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_user(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.deny_user(uuid) FROM PUBLIC, anon;
