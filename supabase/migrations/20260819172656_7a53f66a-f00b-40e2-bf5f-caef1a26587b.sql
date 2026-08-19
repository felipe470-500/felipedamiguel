-- Harden privileges: writes only via server (service_role); leads never readable by public
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.vehicles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.site_settings FROM anon, authenticated;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.leads FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.seller_profiles FROM anon, authenticated;

GRANT SELECT ON public.vehicles TO anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT SELECT ON public.seller_profiles TO anon, authenticated;
GRANT INSERT ON public.leads TO anon, authenticated;

GRANT ALL ON public.vehicles TO service_role;
GRANT ALL ON public.site_settings TO service_role;
GRANT ALL ON public.leads TO service_role;
GRANT ALL ON public.seller_profiles TO service_role;

-- Explicit restrictive deny so no future permissive policy can expose leads to public roles
DROP POLICY IF EXISTS "Leads are never readable by public roles" ON public.leads;
CREATE POLICY "Leads are never readable by public roles"
ON public.leads AS RESTRICTIVE FOR SELECT
TO anon, authenticated
USING (false);

-- Explicit restrictive deny for catalog/settings writes by public roles
DROP POLICY IF EXISTS "No public writes to vehicles" ON public.vehicles;
CREATE POLICY "No public writes to vehicles"
ON public.vehicles AS RESTRICTIVE FOR ALL
TO anon, authenticated
USING (true) WITH CHECK (false);

DROP POLICY IF EXISTS "No public writes to site_settings" ON public.site_settings;
CREATE POLICY "No public writes to site_settings"
ON public.site_settings AS RESTRICTIVE FOR ALL
TO anon, authenticated
USING (true) WITH CHECK (false);