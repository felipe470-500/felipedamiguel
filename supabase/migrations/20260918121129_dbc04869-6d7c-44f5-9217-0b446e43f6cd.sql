CREATE POLICY "Sem acesso publico as sugestoes de placa"
ON public.plate_suggestions
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);