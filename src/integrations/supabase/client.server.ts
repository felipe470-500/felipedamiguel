// Server-only Supabase client using the service role key (bypasses RLS).
// Falls back to the anon client if the service role key is missing so imports
// don't crash in environments without admin keys.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { supabase } from "./client";

function createAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.warn(
      "[Supabase] SUPABASE_SERVICE_ROLE_KEY missing — falling back to anon client. Admin writes will fail RLS.",
    );
    return supabase;
  }

  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _admin: ReturnType<typeof createAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get(_, prop, receiver) {
    if (!_admin) _admin = createAdminClient();
    return Reflect.get(_admin as object, prop, receiver);
  },
});
