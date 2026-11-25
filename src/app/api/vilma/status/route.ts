import { NextResponse } from "next/server";
import { aiProvider } from "@/lib/vilma/client";

export const dynamic = "force-dynamic";

/** Informa à interface qual provedor de IA está ativo (nenhum segredo é exposto). */
export function GET() {
  return NextResponse.json({ provider: aiProvider() }, { headers: { "Cache-Control": "no-store" } });
}
