INSERT INTO public.platforms (id, name, connector_version, capabilities, active)
VALUES (
  'mercadolivre',
  'Mercado Livre',
  '1.0.0',
  '{"auth":"OAUTH2","operations":["CREATE","READ","UPDATE","DELETE","PAUSE","ACTIVATE","SYNC","UPLOAD_PHOTO"],"site":"MLB","category":"MLB1744","notes":"Publicacao exige pacote silver contratado; fotos obrigatorias na criacao e atualizacao; seller_contact.phone2 obrigatorio para car_dealer a partir de 01/10/2026"}'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    connector_version = EXCLUDED.connector_version,
    capabilities = EXCLUDED.capabilities,
    active = true;