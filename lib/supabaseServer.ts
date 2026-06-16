import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Server-only Supabase client. Uses the service-role key (never shipped to the
// browser). RLS is OFF in this dev mockup, so this is full read/write access —
// only ever import this from server actions / server components.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — copy .env.local.example to .env.local and fill it in.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
