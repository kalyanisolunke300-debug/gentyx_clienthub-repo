// lib/supabase.ts
// Supabase client singletons for browser (anon) and server (admin/service role)

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");

/**
 * Browser-safe Supabase client (anon key, respects RLS).
 * Use in client components and public API routes.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Server-only admin client (service role key, bypasses RLS).
 * Use ONLY in Next.js API routes / server actions — never expose to the browser.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
