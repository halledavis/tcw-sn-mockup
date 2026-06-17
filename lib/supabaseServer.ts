import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Server-only Supabase client. Uses the service-role key (never shipped to the
// browser). RLS is OFF in this dev mockup, so this is full read/write access —
// only ever import this from server actions / server components.
export function supabaseAdmin() {
  // Prefer the non-public SUPABASE_URL: NEXT_PUBLIC_* is inlined at build time
  // by Next, so on Cloudflare (where the build has no .env) it bakes in as
  // undefined and a runtime var can't fix it. SUPABASE_URL is read at runtime
  // from the Worker env. NEXT_PUBLIC_SUPABASE_URL stays as a local fallback.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean).join(" + ");
    throw new Error(
      `Missing Supabase server env: ${missing}. Locally set them in .env.local; on Cloudflare set SUPABASE_URL as a Worker var and SUPABASE_SERVICE_ROLE_KEY as a secret, then redeploy.`,
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
