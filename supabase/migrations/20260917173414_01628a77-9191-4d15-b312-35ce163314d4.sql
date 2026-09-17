DROP POLICY IF EXISTS "Leads are never readable by public roles" ON public.leads;
GRANT SELECT, UPDATE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;