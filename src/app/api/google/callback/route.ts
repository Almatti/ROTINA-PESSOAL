import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getUser } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { exchangeCode, saveTokens } from "@/lib/google/calendar";
import { syncAllGoogle } from "@/lib/google/run";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const fail = () => NextResponse.redirect(new URL("/configuracoes?google=erro#integracoes", site));
  const { supabase: sb, user } = await getUser();
  if (!user) return NextResponse.redirect(new URL("/entrar", site));
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const cookie = req.cookies.get("g_oauth_state")?.value ?? "";
  const [expected, uid] = cookie.split(".");
  const ok = !!expected && expected.length === state.length && timingSafeEqual(Buffer.from(expected), Buffer.from(state)) && uid === user.id;
  if (!code || !ok) return fail();
  try {
    const tokens = await exchangeCode(code);
    const admin = getAdminSupabase();
    await saveTokens(admin, user.id, tokens);
    await sb.from("consents").insert({ kind: "google_agenda", granted: true });
    await syncAllGoogle(admin, user.id).catch(() => undefined);
    const res = NextResponse.redirect(new URL("/configuracoes?google=ok#integracoes", site));
    res.cookies.delete({ name: "g_oauth_state", path: "/api/google" });
    return res;
  } catch {
    return fail();
  }
}
