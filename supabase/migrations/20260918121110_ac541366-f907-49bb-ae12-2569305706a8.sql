CREATE TABLE public.plate_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  plate TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  photo_index INTEGER,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX plate_suggestions_vehicle_id_key ON public.plate_suggestions (vehicle_id);

GRANT ALL ON public.plate_suggestions TO service_role;
ALTER TABLE public.plate_suggestions ENABLE ROW LEVEL SECURITY;