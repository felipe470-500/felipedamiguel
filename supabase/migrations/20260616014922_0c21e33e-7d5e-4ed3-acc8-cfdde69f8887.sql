ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS desired_car text;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_check;

ALTER TABLE public.leads ADD CONSTRAINT leads_check CHECK (
  length(name) >= 1 AND length(name) <= 120
  AND length(whatsapp) >= 6 AND length(whatsapp) <= 30
  AND payment_type = ANY (ARRAY['avista'::text, 'parcelado'::text])
  AND (payment_value IS NULL OR length(payment_value) <= 60)
  AND (desired_car IS NULL OR length(desired_car) <= 120)
);