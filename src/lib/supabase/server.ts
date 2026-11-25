import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/** Cliente no servidor com a sessão da usuária (cookies) — respeita o RLS. */
export async function getServerSupabase() {
  const store = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // chamado a partir de Server Component: o middleware cuida da renovação
        }
      },
    },
  });
}

/** Retorna a usuária autenticada (validada no servidor do Supabase) ou null. */
export async function getUser() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}
