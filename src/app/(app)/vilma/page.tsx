"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Send, Mic, MicOff, Plus, History, CheckCircle2, XCircle, AlertTriangle, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, cn, EmptyState } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { LogoMark } from "@/components/brand/logo";
import { Markdown } from "@/components/markdown";
import { useSession } from "@/lib/session";
import { useTable } from "@/lib/data/hooks";
import { invalidate, mutate, notifyMutated } from "@/lib/data/store";
import { getSupabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { isLocalMode } from "@/lib/env";
import { localAssistant } from "@/lib/local/vilma-local";

interface Msg { id?: string; role: "user" | "assistant"; content: string; actions?: { tool: string; ok?: boolean; summary?: string; error?: string; pending_id?: string }[]; error?: boolean }
interface Conv { id: string; title: string; updated_at: string }

const SUGGESTIONS = [
  "Organize minha semana",
  "Agende academia amanhã às 7h",
  "Adicione uma despesa de R$ 150 no mercado",
  "Quanto gastei este mês?",
  "Quais tarefas ainda estão pendentes?",
  "Registre que dormi oito horas",
  "Monte uma lista de compras",
  "Faça um resumo do meu mês",
];

type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void };

function VilmaInner() {
  const { displayName, profile, updateProfile, today, tz } = useSession();
  const toast = useToast();
  const params = useSearchParams();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [delConv, setDelConv] = useState<Conv | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const recRef = useRef<SR | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { data: conversations = [] } = useTable<Conv>("conversations", { order: "updated_at", ascending: false, limit: 50 });
  const speechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  // provedor de IA ativo no servidor: undefined = carregando, null = nenhum (Vilma básica)
  const [provider, setProvider] = useState<"anthropic" | "gemini" | null | undefined>(isLocalMode ? null : undefined);
  const [basicChoice, setBasicChoice] = useState(false);
  const consent = !!profile?.ai_consent_at && (profile.ai_consent_provider ?? "anthropic") === provider;
  const useAI = !isLocalMode && !!provider && consent && !basicChoice;

  useEffect(() => {
    if (isLocalMode) return;
    try { setBasicChoice(localStorage.getItem("vilma:basica") === "1"); } catch {}
    fetch("/api/vilma/status", { cache: "no-store" }).then((r) => r.json()).then((j) => setProvider(j.provider ?? null)).catch(() => setProvider(null));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    const p = params.get("pedido");
    if (p === "revisao-semana") setInput("Faça a revisão da minha semana: o que concluí, o que ficou pendente e sugestões para a próxima.");
  }, [params]);

  async function openConversation(id: string) {
    const { data } = await getSupabase().from("messages").select("id,role,content,actions").eq("conversation_id", id).order("created_at");
    setConversationId(id);
    setMessages((data ?? []) as Msg[]);
    const ids = (data ?? []).flatMap((m: Msg) => (m.actions ?? []).filter((a) => a.pending_id).map((a) => a.pending_id!));
    if (ids.length) {
      const { data: pa } = await getSupabase().from("pending_actions").select("id,status").in("id", ids);
      setResolved(Object.fromEntries((pa ?? []).filter((p) => p.status !== "pendente").map((p) => [p.id, p.status])));
    }
    setHistoryOpen(false);
  }

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    if (!isLocalMode && !navigator.onLine) return toast.show("A Vilma precisa de internet para responder.", "error");
    if (provider === undefined && !isLocalMode) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setBusy(true);
    if (!useAI) {
      await runBasic(msg);
      return;
    }
    try {
      // nunca deixar a tela carregando para sempre: após 65 s responde no modo básico
      const res = await fetch("/api/vilma", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, message: msg }), signal: AbortSignal.timeout(65_000) }).catch((e: unknown) => {
        if ((e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError") return new Response(JSON.stringify({ code: "provider_error" }), { status: 504 });
        throw e;
      });
      const j = await res.json().catch(() => ({ code: res.status >= 500 ? "provider_error" : undefined, error: "Algo deu errado." }));
      if (j.conversationId) setConversationId(j.conversationId);
      if (!res.ok && (j.code === "quota" || j.code === "provider_error" || j.code === "not_configured")) {
        // IA indisponível (ex.: limite gratuito do dia): responde com a Vilma básica
        await runBasic(msg, j.conversationId ?? conversationId, j.code === "quota" ? "_A IA gratuita atingiu o limite por agora, então respondi no modo básico._" : "_A IA não respondeu agora, então respondi no modo básico._");
        return;
      }
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: j.error ?? "Algo deu errado.", error: true }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: j.reply, actions: [...(j.actions ?? []), ...(j.pending ?? []).map((p: { id: string; summary: string }) => ({ tool: "pending", pending_id: p.id, summary: p.summary }))] }]);
        if ((j.actions ?? []).some((a: { ok: boolean }) => a.ok)) { invalidate("tasks", "events", "transactions", "habits", "habit_logs", "sleep_logs", "water_logs", "shopping_lists", "shopping_items", "notes", "goals", "goal_steps"); notifyMutated("tasks", "events", "habit_logs"); }
      }
      invalidate("conversations");
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Não consegui me conectar. Verifique sua internet e tente de novo.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  /** Vilma básica: regras em português + dados reais da usuária (nada é enviado a provedores de IA). */
  async function runBasic(msg: string, convId: string | null = conversationId, note?: string) {
    {
      try {
        const sb = getSupabase();
        let conv = convId;
        if (!conv) {
          const { data } = await sb.from("conversations").insert({ title: msg.slice(0, 60) }).select("id").single();
          conv = (data as { id: string } | null)?.id ?? null;
          setConversationId(conv);
        }
        const r = await localAssistant(msg, { sb, today, tz, wakeTime: profile?.wake_time ?? null });
        if (note) r.reply = `${r.reply}\n\n${note}`;
        if (conv) await sb.from("messages").insert([{ conversation_id: conv, role: "user", content: msg }, { conversation_id: conv, role: "assistant", content: r.reply, actions: r.actions }]);
        setMessages((m) => [...m, { role: "assistant", content: r.reply, actions: r.actions }]);
        if (r.actions.some((a) => a.ok)) { invalidate("tasks", "events", "transactions", "sleep_logs", "water_logs", "shopping_lists", "shopping_items", "notes"); notifyMutated("tasks", "events"); }
        invalidate("conversations");
      } catch {
        setMessages((m) => [...m, { role: "assistant", content: "Não consegui registrar agora. Tente de novo.", error: true }]);
      } finally {
        setBusy(false);
      }
    }
  }

  function chooseBasic(on: boolean) {
    setBasicChoice(on);
    try { localStorage.setItem("vilma:basica", on ? "1" : "0"); } catch {}
  }

  async function grantConsent() {
    if (!provider) return;
    await updateProfile({ ai_consent_at: new Date().toISOString(), ai_consent_provider: provider });
    await getSupabase().from("consents").insert({ kind: provider === "gemini" ? "ia_google" : "ia", granted: true });
    chooseBasic(false);
  }

  async function resolve(id: string, decision: "confirmar" | "cancelar") {
    const res = await fetch("/api/vilma/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pendingId: id, decision }) });
    const j = await res.json();
    if (!res.ok && res.status !== 422) return toast.show(j.error ?? "Não foi possível concluir.", "error");
    setResolved((r) => ({ ...r, [id]: decision === "cancelar" ? "cancelada" : j.ok ? "confirmada" : "falhou" }));
    setMessages((m) => [...m, { role: "assistant", content: decision === "cancelar" ? "Tudo bem, cancelei. 👍" : j.ok ? `✅ Feito: ${j.summary}` : `Não consegui concluir: ${j.error}` }]);
    invalidate("tasks", "events", "transactions");
    notifyMutated("tasks", "events");
  }

  function toggleVoice() {
    if (listening) return recRef.current?.stop();
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => setInput(Array.from(e.results).map((r) => r[0].transcript).join(""));
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); toast.show("Não consegui ouvir. Verifique a permissão do microfone.", "error"); };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  if (profile && provider && !consent && !basicChoice && !isLocalMode) {
    const google = provider === "gemini";
    return (
      <>
        <PageHeader title="Vilma" icon={<LogoMark size={26} />} />
        <div className="card space-y-4 p-6 text-center">
          <LogoMark size={56} className="mx-auto" />
          <h2 className="text-lg font-bold">Ative a assistente Vilma</h2>
          {google ? (
            <p className="text-sm text-ink-soft">Para conversar comigo com IA, preciso da sua autorização para enviar suas mensagens e o contexto mínimo necessário (como tarefas, compromissos e valores consultados) ao <strong>Google (Gemini)</strong>. Estamos usando o <strong>plano gratuito</strong>: nele, o Google pode usar essas informações para melhorar os produtos dele, e pessoas podem revisá-las. Seu diário e dados do ciclo nunca são enviados.</p>
          ) : (
            <p className="text-sm text-ink-soft">Para conversar comigo com IA, preciso da sua autorização para enviar suas mensagens e o contexto mínimo necessário (como compromissos e valores consultados) ao provedor de IA (Anthropic). Seu diário e dados do ciclo nunca são enviados, e nada é usado para treinar modelos.</p>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={grantConsent}>Autorizar e conversar</Button>
            <Button variant="ghost" onClick={() => chooseBasic(true)}>Usar a Vilma básica (sem IA)</Button>
          </div>
          <p className="text-xs text-muted">A Vilma básica entende comandos simples e nada sai do seu banco. Você pode mudar quando quiser em Configurações › Privacidade.</p>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col lg:min-h-[calc(100dvh-2rem)]">
      <PageHeader
        title="Vilma"
        subtitle={useAI ? `sua assistente pessoal · IA ${provider === "gemini" ? "Gemini" : "Claude"}` : "sua assistente pessoal · modo básico"}
        icon={<LogoMark size={26} />}
        actions={<>
          <Button size="icon" variant="ghost" aria-label="Histórico de conversas" onClick={() => setHistoryOpen(true)}><History className="size-5" /></Button>
          <Button size="icon" variant="ghost" aria-label="Nova conversa" onClick={() => { setConversationId(null); setMessages([]); }}><Plus className="size-5" /></Button>
        </>}
      />
      <div className="flex-1 space-y-4 pb-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="pt-4 text-center">
            <LogoMark size={64} className="mx-auto" />
            <p className="mt-3 text-lg font-bold">Oi{displayName ? `, ${displayName}` : ""}! 💜 Eu sou a Vilma.</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">Me conta como é o seu dia. Pode escrever ou apertar o microfone e falar.{!useAI && provider !== undefined && " (Modo básico: entendo comandos simples como registrar gastos, compromissos, tarefas, sono e água, e mostrar pendências e resumos.)"}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-pill border border-line bg-surface px-3.5 py-2 text-sm text-ink-soft hover:bg-primary-soft hover:text-primary-soft-ink">{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id ?? i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && <LogoMark size={30} className="mt-1 shrink-0" />}
            <div className={cn("max-w-[85%] space-y-2", m.role === "user" && "items-end")}>
              <div className={cn("rounded-3xl px-4 py-3 text-sm shadow-soft-sm", m.role === "user" ? "rounded-br-lg bg-primary text-primary-ink" : m.error ? "rounded-bl-lg bg-error-soft text-error" : "rounded-bl-lg bg-surface")}>
                {m.role === "assistant" && !m.error ? <Markdown text={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
                {m.error && /Privacidade/.test(m.content) && <Link href="/configuracoes#privacidade" className="mt-1 block font-semibold underline">Abrir configurações</Link>}
              </div>
              {m.actions?.filter((a) => a.tool !== "pending").map((a, j) => (
                <p key={j} className={cn("flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs", a.ok ? "bg-success-soft text-success" : "bg-error-soft text-error")}>
                  {a.ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <XCircle className="size-3.5" aria-hidden />}{a.summary ?? a.error}
                </p>
              ))}
              {m.actions?.filter((a) => a.pending_id).map((a) => {
                const st = resolved[a.pending_id!];
                return (
                  <div key={a.pending_id} className="rounded-2xl border border-warning/40 bg-warning-soft p-3 text-sm" role="group" aria-label="Confirmação necessária">
                    <p className="flex items-start gap-2 font-semibold text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />Confirmação necessária</p>
                    <p className="mt-1 text-ink">{a.summary}</p>
                    {st ? <p className="mt-2 text-xs font-semibold text-muted">{st === "confirmada" ? "✓ Confirmada" : st === "cancelada" ? "Cancelada" : st === "expirada" ? "Expirada" : "Não concluída"}</p> : (
                      <div className="mt-2 flex gap-2"><Button size="sm" variant="ghost" onClick={() => resolve(a.pending_id!, "cancelar")}>Cancelar</Button><Button size="sm" variant="danger" onClick={() => resolve(a.pending_id!, "confirmar")}>Confirmar</Button></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2" role="status" aria-label="Vilma está pensando">
            <LogoMark size={30} />
            <div className="flex gap-1 rounded-3xl rounded-bl-lg bg-surface px-4 py-3.5 shadow-soft-sm">{[0, 1, 2].map((d) => <span key={d} className="size-2 animate-bounce rounded-full bg-iris" style={{ animationDelay: `${d * 0.15}s` }} />)}</div>
            <span className="text-xs text-muted">digitando…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="sticky bottom-24 z-20 flex items-end gap-2 rounded-[26px] border border-line bg-surface p-2 shadow-soft-lg lg:bottom-4">
        <label htmlFor="vilma-input" className="sr-only">Mensagem para a Vilma</label>
        <textarea id="vilma-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }} rows={1} maxLength={4000} placeholder="Mensagem" className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 outline-none" />
        {speechSupported && <Button type="button" size="icon" variant={listening ? "danger" : "soft"} onClick={toggleVoice} aria-label={listening ? "Parar de ouvir" : "Falar"} aria-pressed={listening}>{listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}</Button>}
        <Button type="submit" size="icon" disabled={!input.trim() || busy} aria-label="Enviar"><Send className="size-5" /></Button>
      </form>
      <p className="mt-2 text-center text-[0.7rem] text-muted">
        A Vilma pode errar. Ações de exclusão sempre pedem sua confirmação.
        {!isLocalMode && provider && basicChoice && <> · <button type="button" className="font-semibold text-primary underline" onClick={() => chooseBasic(false)}>Ligar a IA ({provider === "gemini" ? "Gemini" : "Claude"})</button></>}
        {useAI && <> · <button type="button" className="font-semibold text-primary underline" onClick={() => chooseBasic(true)}>Usar modo básico</button></>}
      </p>

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Conversas">
        {conversations.length === 0 ? <EmptyState icon="💬" title="Nenhuma conversa ainda" /> : (
          <ul className="divide-y divide-line">
            {conversations.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <button onClick={() => openConversation(c.id)} className={cn("flex-1 py-3 text-left", c.id === conversationId && "font-bold text-primary")}><p className="truncate">{c.title}</p><p className="text-xs text-muted">{new Date(c.updated_at).toLocaleString("pt-BR")}</p></button>
                <Button size="icon" variant="ghost" aria-label={`Excluir conversa ${c.title}`} onClick={() => setDelConv(c)}><Trash2 className="size-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      <ConfirmDialog open={!!delConv} danger title="Excluir conversa?" message="O histórico desta conversa será apagado." confirmLabel="Excluir" onCancel={() => setDelConv(null)} onConfirm={async () => { await mutate({ action: "delete", table: "conversations", id: delConv!.id }); if (delConv!.id === conversationId) { setConversationId(null); setMessages([]); } setDelConv(null); }} />
    </div>
  );
}

export default function VilmaPage() {
  return <Suspense><VilmaInner /></Suspense>;
}
