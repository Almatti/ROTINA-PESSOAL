"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, isSupabaseConfigured, isLocalMode } from "@/lib/env";
import { createLocalClient } from "@/lib/local/client";

let client: SupabaseClient | null = null;

/**
 * Cliente de dados do navegador.
 * - Versão online: Supabase com a chave anon; o acesso é limitado pelo RLS.
 * - Modo local (NEXT_PUBLIC_LOCAL_MODE=1): dados guardados no próprio aparelho.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (isLocalMode) {
    client = createLocalClient() as unknown as SupabaseClient;
    return client;
  }
  if (!isSupabaseConfigured) throw new Error("Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  client = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return client;
}
