import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Registra (ou atualiza) a inscrição de push deste dispositivo. */
export async function POST(req: NextRequest) {
  const { supabase: sb, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autenticada." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  // remove o mesmo endpoint de outra conta neste aparelho é impossível via RLS; atualizamos apenas o da usuária
  await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await sb.from("push_subscriptions").insert({ endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null });
  if (error) return NextResponse.json({ error: "Não foi possível ativar as notificações." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { supabase: sb, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autenticada." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body?.endpoint === "string") await sb.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}
