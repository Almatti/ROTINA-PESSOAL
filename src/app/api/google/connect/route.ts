import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getUser } from "@/lib/supabase/server";
import { authUrl, isGoogleConfigured } from "@/lib/google/calendar";

export const runtime = "nodejs";

export async function GET() {
  const { user } = await getUser();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (!user) return NextResponse.redirect(new URL("/entrar", site));
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/configuracao", site));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("g_oauth_state", `${state}.${user.id}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/google" });
  return res;
}
