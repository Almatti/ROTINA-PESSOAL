import { NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/google/calendar";

export const dynamic = "force-dynamic";

/** A interface só oferece "Conectar" quando o servidor tem as credenciais do Google. */
export function GET() {
  return NextResponse.json({ configured: isGoogleConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
