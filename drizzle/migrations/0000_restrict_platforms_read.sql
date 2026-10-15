DROP POLICY IF EXISTS "Authenticated users read platforms" ON public.platforms;
CREATE POLICY "Store members read platforms" ON public.platforms
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));