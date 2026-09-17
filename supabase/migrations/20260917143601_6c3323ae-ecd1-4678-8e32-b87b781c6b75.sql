CREATE POLICY "Credentials are server only" ON public.integration_credentials AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.has_store_role(_user_id uuid, _store_id uuid, _roles public.app_role[] DEFAULT ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'seller'::public.app_role, 'integration_operator'::public.app_role])
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (store_id = _store_id OR (store_id IS NULL AND organization_id = (SELECT organization_id FROM public.stores WHERE id = _store_id)))
      AND role = ANY(_roles)
  )
$$;
REVOKE ALL ON FUNCTION public.has_store_role(uuid, uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_store_role(uuid, uuid, public.app_role[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.enqueue_vehicle_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_vehicle_sync() TO service_role;