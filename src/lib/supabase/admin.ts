import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Cliente com service_role: ignora RLS. Usar SOMENTE no servidor, depois de
 * validar a usuária, e sempre filtrando por user_id explicitamente.
 */
export function getAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv.supabaseUrl || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(publicEnv.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const isAdminConfigured = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && publicEnv.supabaseUrl);
