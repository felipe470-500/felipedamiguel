CREATE TABLE IF NOT EXISTS seller_profiles (
  seller_id TEXT PRIMARY KEY,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);