CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year text NOT NULL DEFAULT '',
  km text NOT NULL DEFAULT '',
  price text NOT NULL DEFAULT '',
  tag text,
  images text[] NOT NULL DEFAULT '{}',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vehicles TO anon, authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vehicles are publicly readable" ON public.vehicles FOR SELECT TO anon, authenticated USING (true);