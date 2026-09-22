UPDATE public.vehicle_integrations vi
SET last_error_message = COALESCE(NULLIF(
      concat_ws('; ',
        CASE WHEN v.version IS NULL OR btrim(v.version) = '' THEN 'Versão do veículo (atributo TRIM) não preenchida' END,
        CASE WHEN v.fuel IS NULL OR btrim(v.fuel) = '' THEN 'Combustível (atributo FUEL_TYPE) não preenchido' END,
        CASE WHEN v.doors IS NULL THEN 'Quantidade de portas (atributo DOORS) não preenchida' END
      ), ''), 'Pronto para reenviar ao Mercado Livre')
FROM public.vehicles v
WHERE v.id = vi.vehicle_id
  AND vi.sync_status = 'FAILED'
  AND vi.external_id IS NULL;