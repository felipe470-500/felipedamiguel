ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS body_type text,
  ADD COLUMN IF NOT EXISTS optional_features text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS videos text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.store_profiles (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  trade_name text NOT NULL DEFAULT '',
  legal_name text,
  tax_id text,
  phone text,
  whatsapp text,
  email text,
  postal_code text,
  street text,
  street_number text,
  complement text,
  neighborhood text,
  city text,
  state_code text,
  country_code text NOT NULL DEFAULT 'BR',
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.store_profiles TO authenticated;
GRANT ALL ON public.store_profiles TO service_role;

ALTER TABLE public.store_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store members manage store profile" ON public.store_profiles;
CREATE POLICY "Store members manage store profile"
  ON public.store_profiles FOR ALL
  TO authenticated
  USING (public.has_store_role(auth.uid(), store_id))
  WITH CHECK (public.has_store_role(auth.uid(), store_id));

DROP TRIGGER IF EXISTS store_profiles_touch ON public.store_profiles;
CREATE TRIGGER store_profiles_touch BEFORE UPDATE ON public.store_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill: preço, quilometragem e anos a partir dos campos de texto existentes.
UPDATE public.vehicles v
SET price_cents = COALESCE(
      v.price_cents,
      NULLIF(regexp_replace(split_part(v.price, ',', 1), '\D', '', 'g'), '')::bigint * 100
    ),
    mileage_km = COALESCE(
      v.mileage_km,
      NULLIF(NULLIF(regexp_replace(v.km, '\D', '', 'g'), '')::bigint, 0)::int
    ),
    manufacture_year = COALESCE(
      v.manufacture_year,
      NULLIF((regexp_match(v.year, '(\d{4})'))[1], '')::int
    ),
    model_year = COALESCE(
      v.model_year,
      CASE
        WHEN v.year ~ '\d{4}\s*/\s*\d{4}' THEN (regexp_match(v.year, '\d{4}\s*/\s*(\d{4})'))[1]::int
        WHEN v.year ~ '\d{4}\s*/\s*\d{2}\M' THEN
          ((regexp_match(v.year, '(\d{2})\d{2}\s*/\s*\d{2}'))[1] || (regexp_match(v.year, '\d{4}\s*/\s*(\d{2})'))[1])::int
        ELSE NULLIF((regexp_match(v.year, '(\d{4})'))[1], '')::int
      END
    )
WHERE TRUE;

-- Backfill: marca deduzida do nome; modelo recebe o nome quando ainda vazio.
UPDATE public.vehicles v
SET brand = COALESCE(v.brand, b.brand),
    model = COALESCE(NULLIF(trim(v.model), ''), NULLIF(trim(v.name), ''))
FROM (
  SELECT id,
    CASE
      WHEN name ILIKE ANY (ARRAY['%argo%','%toro%','%strada%','%mobi%','%cronos%','%uno%','%palio%','%siena%','%pulse%','%fastback%','%fiorino%','%doblo%','%punto%','%idea%','%linea%','%grand siena%']) THEN 'Fiat'
      WHEN name ILIKE ANY (ARRAY['%gol %','%gol','%saveiro%','%voyage%','%polo%','%virtus%','%t-cross%','%tcross%','%nivus%','%amarok%','%jetta%','%fox%','%up!%','%golf%','%tiguan%','%spacefox%','%crossfox%','%passat%']) THEN 'Volkswagen'
      WHEN name ILIKE ANY (ARRAY['%onix%','%prisma%','%tracker%','%s10%','%cruze%','%spin%','%cobalt%','%montana%','%celta%','%classic%','%captiva%','%equinox%','%trailblazer%','%agile%']) THEN 'Chevrolet'
      WHEN name ILIKE ANY (ARRAY['%ka %','%ka','%fiesta%','%ecosport%','%ranger%','%focus%','%fusion%','%edge%','%territory%','%courier%','%new fiesta%']) THEN 'Ford'
      WHEN name ILIKE ANY (ARRAY['%corolla%','%hilux%','%etios%','%yaris%','%sw4%','%rav4%','%camry%','%corolla cross%']) THEN 'Toyota'
      WHEN name ILIKE ANY (ARRAY['%hb20%','%creta%','%tucson%','%ix35%','%santa fe%','%azera%','%elantra%','%i30%','%hr%']) THEN 'Hyundai'
      WHEN name ILIKE ANY (ARRAY['%civic%','%fit%','%hr-v%','%hrv%','%wr-v%','%wrv%','%city%','%accord%','%cr-v%','%crv%']) THEN 'Honda'
      WHEN name ILIKE ANY (ARRAY['%sandero%','%logan%','%duster%','%kwid%','%captur%','%oroch%','%stepway%','%master%','%fluence%','%clio%']) THEN 'Renault'
      WHEN name ILIKE ANY (ARRAY['%versa%','%march%','%kicks%','%frontier%','%sentra%','%livina%','%tiida%']) THEN 'Nissan'
      WHEN name ILIKE ANY (ARRAY['%208%','%2008%','%3008%','%206%','%207%','%partner%','%308%']) THEN 'Peugeot'
      WHEN name ILIKE ANY (ARRAY['%c3%','%c4%','%aircross%','%berlingo%']) THEN 'Citroën'
      WHEN name ILIKE ANY (ARRAY['%l200%','%pajero%','%asx%','%outlander%','%eclipse cross%']) THEN 'Mitsubishi'
      WHEN name ILIKE ANY (ARRAY['%renegade%','%compass%','%commander%','%wrangler%']) THEN 'Jeep'
      WHEN name ILIKE ANY (ARRAY['%cerato%','%sportage%','%sorento%','%picanto%','%bongo%']) THEN 'Kia'
      WHEN name ILIKE ANY (ARRAY['%bmw%','%320i%','%x1%','%x3%','%x5%']) THEN 'BMW'
      WHEN name ILIKE ANY (ARRAY['%mercedes%','%classe %','%glc%','%c180%','%c200%']) THEN 'Mercedes-Benz'
      WHEN name ILIKE ANY (ARRAY['%audi%','%a3%','%a4%','%q3%','%q5%']) THEN 'Audi'
      WHEN name ILIKE '%chery%' OR name ILIKE '%tiggo%' THEN 'Chery'
      WHEN name ILIKE '%caoa%' THEN 'Caoa Chery'
      ELSE NULL
    END AS brand
  FROM public.vehicles
) b
WHERE b.id = v.id;