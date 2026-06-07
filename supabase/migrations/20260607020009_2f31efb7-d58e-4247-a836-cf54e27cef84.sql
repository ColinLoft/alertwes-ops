
CREATE OR REPLACE FUNCTION public.auto_create_incident_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.incident_reports (incident_id, title, body, status, author)
  VALUES (
    NEW.id,
    'Incident Report: ' || NEW.title,
    '',
    'draft',
    NEW.created_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_incident_report ON public.incidents;
CREATE TRIGGER trg_auto_create_incident_report
AFTER INSERT ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_incident_report();
