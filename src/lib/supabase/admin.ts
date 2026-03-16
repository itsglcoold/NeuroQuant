import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client with service role key.
 * Bypasses RLS — use ONLY in server-side contexts without user sessions
 * (e.g., cron jobs, webhooks).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
