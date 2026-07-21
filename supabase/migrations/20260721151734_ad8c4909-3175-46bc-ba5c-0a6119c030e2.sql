ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seller profiles publicly readable"
  ON public.seller_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);
