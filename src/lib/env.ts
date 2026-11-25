/** Variáveis públicas (seguras para o navegador). */
export const isLocalMode = process.env.NEXT_PUBLIC_LOCAL_MODE === "1";
/** Prefixo de caminho quando publicado em subpasta (ex.: GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const withBase = (path: string) => `${BASE_PATH}${path}`;

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const isSupabaseConfigured = isLocalMode || Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
