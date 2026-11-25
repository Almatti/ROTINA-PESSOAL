import { LogoMark } from "@/components/brand/logo";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Configuração necessária" };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  const checks = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL, required: true },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", ok: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, required: true },
    { name: "SUPABASE_SERVICE_ROLE_KEY", ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY, required: false, note: "exclusão de conta, Google Agenda e automações agendadas" },
    { name: "ANTHROPIC_API_KEY", ok: !!process.env.ANTHROPIC_API_KEY, required: false, note: "assistente Vilma" },
    { name: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET", ok: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), required: false, note: "Google Agenda" },
    { name: "INTEGRATIONS_ENCRYPTION_KEY", ok: !!process.env.INTEGRATIONS_ENCRYPTION_KEY, required: false, note: "criptografia de tokens do Google" },
    { name: "CRON_SECRET", ok: !!process.env.CRON_SECRET, required: false, note: "automações agendadas" },
  ];
  return (
    <main id="conteudo" className="mx-auto max-w-xl px-5 py-12">
      <LogoMark size={48} />
      <h1 className="mt-6 font-display text-3xl font-semibold">{isSupabaseConfigured ? "Configuração" : "Quase lá!"}</h1>
      <p className="mt-2 text-ink-soft">
        {isSupabaseConfigured
          ? "O banco de dados está conectado. Itens opcionais ausentes desativam apenas os recursos indicados."
          : "Para usar a Vilma é preciso conectar um projeto Supabase. Preencha as variáveis de ambiente (veja o arquivo .env.example e o README) e reinicie o servidor."}
      </p>
      <ul className="mt-6 space-y-2">
        {checks.map((c) => (
          <li key={c.name} className="card flex items-start justify-between gap-3 p-3 text-sm">
            <div><code className="font-semibold">{c.name}</code>{c.note && <p className="text-xs text-muted">{c.note}</p>}</div>
            <span className={c.ok ? "text-success" : c.required ? "text-error" : "text-warning"}>{c.ok ? "configurada" : c.required ? "obrigatória" : "opcional"}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
