import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAdminSupabase, isAdminConfigured } from "@/lib/supabase/admin";
import { revokeGoogle } from "@/lib/google/calendar";

export const runtime = "nodejs";

/** Exclusão de conta (LGPD art. 18, VI): apaga arquivos, revoga integrações e remove o usuário (cascade). */
export async function POST(req: NextRequest) {
  const { user } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autenticada." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "EXCLUIR") return NextResponse.json({ error: "Confirmação inválida." }, { status: 400 });
  if (!isAdminConfigured()) return NextResponse.json({ error: "Exclusão indisponível: SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." }, { status: 503 });
  const admin = getAdminSupabase();
  try {
    await revokeGoogle(admin, user.id).catch(() => undefined);
    // remove arquivos do Storage (pasta da usuária). Falhas são registradas, sem bloquear a exclusão dos dados.
    for (const folder of ["avatar", "notas", "vision"]) {
      try {
        const { data: files } = await admin.storage.from("user-files").list(`${user.id}/${folder}`, { limit: 1000 });
        if (files?.length) await admin.storage.from("user-files").remove(files.map((f) => `${user.id}/${folder}/${f.name}`));
      } catch (err) {
        console.error("[conta] falha ao limpar storage:", (err as Error).message);
      }
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[conta] falha na exclusão:", (err as Error).message);
    return NextResponse.json({ error: "Não foi possível excluir a conta agora. Tente novamente." }, { status: 500 });
  }
}
