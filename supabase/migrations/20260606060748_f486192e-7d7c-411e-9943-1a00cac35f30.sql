CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  admin_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT count(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count > 0 THEN RAISE EXCEPTION 'Admin already exists'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin');
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;