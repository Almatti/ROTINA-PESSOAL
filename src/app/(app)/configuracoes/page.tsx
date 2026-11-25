"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, Palette, Bell, LayoutGrid, Clock, Tags, Zap, Plug, Shield, LogOut, Download, Trash2, Play, ExternalLink, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, Field, Input, Select, Segmented, Toggle, SectionTitle, Badge, cn } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/sheet";
import { useSession } from "@/lib/session";
import { useTable, useCategories } from "@/lib/data/hooks";
import { mutate, invalidate } from "@/lib/data/store";
import { getSupabase } from "@/lib/supabase/client";
import { requestNotificationPermission } from "@/lib/notify";
import { download } from "@/lib/export";
import { useToast } from "@/components/ui/toast";
import type { Category } from "@/lib/types";
import { AUTOMATIONS } from "@/lib/automation/catalog";
import { isLocalMode, withBase } from "@/lib/env";
import { exportLocalData, deleteLocalAccount } from "@/lib/local/client";
import { pushSupported, currentSubscription, enablePush, disablePush, vapidKey } from "@/lib/push/client";

const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza", "America/Recife", "America/Cuiaba", "America/Porto_Velho", "America/Rio_Branco", "America/Noronha", "Europe/Lisbon", "America/New_York", "Europe/London"];

export default function SettingsPage() {
  const { user, profile, updateProfile, signOut } = useSession();
  const toast = useToast();
  const { data: automations = [] } = useTable<{ id: string; key: string; enabled: boolean; last_run_at: string | null }>("automations", { order: "key" });
  const { data: integrations = [] } = useTable<{ id: string; provider: string; status: string; last_synced_at: string | null; last_error: string | null; scope: string | null; tasks_synced_at: string | null }>("integrations", { select: "id,provider,status,last_synced_at,last_error,scope,tasks_synced_at" });
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [perm, setPerm] = useState("default");
  const [deleting, setDeleting] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [revokeAI, setRevokeAI] = useState(false);
  const [disconnect, setDisconnect] = useState(false);
  useEffect(() => {
    if (isLocalMode) return;
    fetch("/api/google/status", { cache: "no-store" }).then((r) => r.json()).then((j) => setGoogleReady(!!j.configured)).catch(() => setGoogleReady(false));
  }, []);
  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("google") === "ok") toast.show("Google conectado! Agenda e Tasks sincronizados.", "success");
    if (p.get("google") === "erro") toast.show("Não foi possível conectar ao Google.", "error");
  }, [toast]);
  if (!profile) return null;
  const google = integrations.find((i) => i.provider === "google_calendar");
  const prefs = profile.notification_prefs ?? {};
  const modules = profile.modules ?? {};

  async function runAutomations() {
    setBusy("auto");
    try {
      let j: { created: number; error?: string };
      if (isLocalMode) {
        const { runAutomationsForUser } = await import("@/lib/automation/engine");
        j = await runAutomationsForUser(getSupabase(), { id: profile!.id, timezone: profile!.timezone, notification_prefs: profile!.notification_prefs });
      } else {
        const res = await fetch("/api/automations/run", { method: "POST" });
        j = await res.json();
        if (!res.ok) throw new Error(j.error);
      }
      toast.show(`Automações executadas: ${j.created} novidade(s).`, "success");
      invalidate("notifications", "tasks", "transactions", "automations");
    } catch (e) {
      toast.show((e as Error).message || "Falha ao executar.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Configurações" icon={<Settings className="size-5" />} />

      <SectionTitle className="mt-2"><Palette className="mr-2 inline size-4 text-primary" aria-hidden />Aparência</SectionTitle>
      <Card className="space-y-3">
        <Segmented label="Tema" value={profile.theme} onChange={(t) => updateProfile({ theme: t })} options={[{ value: "system", label: "Automático" }, { value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }]} />
        <Link href="/inicio" className="block text-sm font-semibold text-primary">Personalizar cartões da tela inicial →</Link>
      </Card>

      <SectionTitle><Bell className="mr-2 inline size-4 text-primary" aria-hidden />Notificações</SectionTitle>
      <Card className="divide-y divide-line py-1">
        <div className="flex items-center justify-between gap-3 py-2">
          <div><p className="text-sm font-semibold">Notificações do dispositivo</p><p className="text-xs text-muted">{perm === "granted" ? "Ativadas" : perm === "denied" ? "Bloqueadas no navegador" : perm === "unsupported" ? "Não suportadas neste navegador" : "Ainda não autorizadas"}</p></div>
          {perm === "default" && <Button size="sm" onClick={async () => setPerm(await requestNotificationPermission())}>Ativar</Button>}
        </div>
        {[["compromissos", "Compromissos"], ["tarefas", "Tarefas com lembrete"], ["vencimentos", "Contas a vencer"], ["habitos", "Hábitos"], ["agua", "Água"], ["resumo_manha", "Resumo da manhã"], ["revisao_noite", "Revisão da noite"]].map(([k, l]) => (
          <Toggle key={k} checked={k === "agua" || k === "revisao_noite" ? !!prefs[k] : prefs[k] !== false} onChange={(b) => updateProfile({ notification_prefs: { ...prefs, [k]: b } })} label={l} />
        ))}
        <PushToggle />
      </Card>

      <SectionTitle><LayoutGrid className="mr-2 inline size-4 text-primary" aria-hidden />Módulos</SectionTitle>
      <Card className="divide-y divide-line py-1">
        <Toggle checked={modules.gamificacao !== false} onChange={(b) => updateProfile({ modules: { ...modules, gamificacao: b } })} label="Pontos e conquistas" />
        <Toggle checked={modules.treinos !== false} onChange={(b) => updateProfile({ modules: { ...modules, treinos: b } })} label="Treinos" />
        <Toggle checked={modules.estudos !== false} onChange={(b) => updateProfile({ modules: { ...modules, estudos: b } })} label="Estudos" />
        <Toggle checked={modules.trabalho !== false} onChange={(b) => updateProfile({ modules: { ...modules, trabalho: b } })} label="Trabalho e projetos" />
        <Toggle checked={modules.casa !== false} onChange={(b) => updateProfile({ modules: { ...modules, casa: b } })} label="Casa" />
        <div className="flex items-center justify-between py-2"><div><p className="text-sm font-semibold">Ciclo menstrual</p><p className="text-xs text-muted">{modules.ciclo ? "Ativado (com consentimento)" : "Desativado"}</p></div><Link href="/ciclo" className="text-sm font-semibold text-primary">Gerenciar</Link></div>
      </Card>

      <SectionTitle><Clock className="mr-2 inline size-4 text-primary" aria-hidden />Rotina, metas e região</SectionTitle>
      <Card className="grid grid-cols-2 gap-3">
        <Field label="Acordo às">{(id) => <Input id={id} type="time" defaultValue={profile.wake_time?.slice(0, 5) ?? ""} onBlur={(e) => updateProfile({ wake_time: e.target.value || null })} />}</Field>
        <Field label="Durmo às">{(id) => <Input id={id} type="time" defaultValue={profile.bed_time?.slice(0, 5) ?? ""} onBlur={(e) => updateProfile({ bed_time: e.target.value || null })} />}</Field>
        <Field label="Meta de sono (h)">{(id) => <Input id={id} inputMode="decimal" defaultValue={String(profile.sleep_goal_minutes / 60).replace(".", ",")} onBlur={(e) => { const h = Number(e.target.value.replace(",", ".")); if (h >= 3 && h <= 14) updateProfile({ sleep_goal_minutes: Math.round(h * 60) }); else toast.show("Meta de sono entre 3 e 14 h.", "error"); }} />}</Field>
        <Field label="Meta de água (ml)">{(id) => <Input id={id} type="number" min={250} max={8000} defaultValue={profile.water_goal_ml} onBlur={(e) => { const v = Number(e.target.value); if (v >= 250 && v <= 8000) updateProfile({ water_goal_ml: v }); else toast.show("Meta de água entre 250 e 8000 ml.", "error"); }} />}</Field>
        <Field label="Fuso horário" className="col-span-2">{(id) => <Select id={id} value={profile.timezone} onChange={(e) => updateProfile({ timezone: e.target.value })}>{TIMEZONES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</Select>}</Field>
        <p className="col-span-2 text-xs text-muted">Moeda: Real (R$) · Datas: DD/MM/AAAA</p>
      </Card>

      <SectionTitle><Tags className="mr-2 inline size-4 text-primary" aria-hidden />Categorias personalizadas</SectionTitle>
      <CategoriesEditor />

      <SectionTitle action={<Button size="sm" variant="soft" loading={busy === "auto"} icon={<Play className="size-4" />} onClick={runAutomations}>Executar agora</Button>}><Zap className="mr-2 inline size-4 text-primary" aria-hidden />Automações</SectionTitle>
      <Card className="divide-y divide-line py-1">
        {AUTOMATIONS.map((a) => {
          const row = automations.find((x) => x.key === a.key);
          return (
            <div key={a.key}>
              <Toggle checked={row?.enabled ?? false} onChange={async (b) => { if (row) await mutate({ action: "update", table: "automations", id: row.id, values: { enabled: b } }); else await mutate({ action: "insert", table: "automations", values: { key: a.key, enabled: b } }); }} label={a.label} description={`${a.description}${row?.last_run_at ? ` · última execução ${new Date(row.last_run_at).toLocaleString("pt-BR")}` : ""}`} />
            </div>
          );
        })}
        <p className="py-2 text-xs text-muted">As automações rodam diariamente no servidor (Vercel Cron) e quando você toca em “Executar agora”. Nenhuma automação faz pagamentos, exclui dados ou altera compromissos sem sua autorização.</p>
      </Card>

      <SectionTitle><Plug className="mr-2 inline size-4 text-primary" aria-hidden /><span id="integracoes">Integrações</span></SectionTitle>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-info-soft font-bold text-info">G</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Google Agenda e Google Tasks</p>
            <p className="text-xs text-muted">
              {google
                ? google.status === "ativa"
                  ? `Conectado${google.last_synced_at ? ` · sincronizado em ${new Date(google.last_synced_at).toLocaleString("pt-BR")}` : ""}`
                  : `Erro: ${google.last_error ?? "reconecte sua conta"}`
                : "Compromissos vão para o Google Agenda; tarefas, hábitos e rotinas vão para o Google Tasks (lista “Vilma”)."}
            </p>
          </div>
          {isLocalMode ? (
            <span className="text-xs text-muted">Disponível na versão online</span>
          ) : google ? (
            <div className="flex gap-2">
              <Button size="sm" variant="soft" loading={syncing} onClick={async () => { setSyncing(true); const r = await fetch("/api/google/sync", { method: "POST" }); const j = await r.json().catch(() => ({})); setSyncing(false); invalidate("integrations", "tasks", "events", "habit_logs"); toast.show(r.ok ? (j.errors?.length ? `Sincronizado com avisos: ${j.errors.join(" · ")}` : "Sincronizado com o Google.") : j.error ?? "Falha ao sincronizar.", r.ok && !j.errors?.length ? "success" : "error"); }}>Sincronizar agora</Button>
              <Button size="sm" variant="ghost" className="text-error" onClick={() => setDisconnect(true)}>Desconectar</Button>
            </div>
          ) : googleReady === false ? (
            <span className="text-xs text-muted">Aguardando configuração do Google no servidor</span>
          ) : (
            <a href="/api/google/connect" className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-primary px-3.5 text-sm font-semibold text-primary-ink"><ExternalLink className="size-4" aria-hidden />Conectar</a>
          )}
        </div>
        {google && google.scope && !google.scope.includes("auth/tasks") && (
          <p className="rounded-2xl bg-warning-soft p-3 text-sm text-warning">Para enviar tarefas e hábitos ao Google Tasks, <a className="font-semibold underline" href="/api/google/connect">reconecte sua conta</a> e autorize o acesso ao Tasks.</p>
        )}
        {google && (
          <>
            <ul className="space-y-1 text-xs text-ink-soft">
              <li>📅 <strong>Google Agenda:</strong> compromissos de trabalho, estudos, pessoal e casa (nos dois sentidos).</li>
              <li>✅ <strong>Google Tasks</strong> (lista “Vilma”): tarefas, hábitos do dia, provas e trabalhos, etapas de projeto, rotinas e manutenções da casa. Concluir no Google conclui no app.{google.tasks_synced_at ? ` Última sincronização: ${new Date(google.tasks_synced_at).toLocaleString("pt-BR")}.` : ""}</li>
              <li>🔄 Sincroniza sozinho alguns segundos depois de cada alteração, ao abrir o app e todo dia às 6h.</li>
            </ul>
            <Toggle checked={profile.google_alarms !== false} onChange={(b) => updateProfile({ google_alarms: b })} label="Alarmes com horário no Google Agenda" description="O Google Tasks não guarda horário. Tarefas e hábitos com hora ganham um alarme curto no Agenda, para o celular avisar no minuto certo." />
          </>
        )}
      </Card>

      <SectionTitle><Shield className="mr-2 inline size-4 text-primary" aria-hidden /><span id="privacidade">Privacidade e dados (LGPD)</span></SectionTitle>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm font-semibold">Assistente Vilma (IA)</p><p className="text-xs text-muted">{profile.ai_consent_at ? `Autorizada (${profile.ai_consent_provider === "gemini" ? "Google Gemini" : "Anthropic"}) em ${new Date(profile.ai_consent_at).toLocaleDateString("pt-BR")}` : "Não autorizada — a Vilma funciona no modo básico, sem IA"}</p></div>
          {profile.ai_consent_at ? <Button size="sm" variant="ghost" onClick={() => setRevokeAI(true)}>Revogar</Button> : <Link href="/vilma" className="rounded-pill bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary-soft-ink">Ativar</Link>}
        </div>
        <Button variant="outline" className="w-full" loading={busy === "export"} icon={<Download className="size-4" />} onClick={async () => {
          setBusy("export");
          try {
            if (isLocalMode) {
              download(`vilma-meus-dados-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportLocalData(), null, 2), "application/json");
            } else {
              const res = await fetch("/api/account/export");
              if (!res.ok) throw new Error();
              download(`vilma-meus-dados-${new Date().toISOString().slice(0, 10)}.json`, await res.blob());
            }
          } catch {
            toast.show("Não foi possível exportar agora.", "error");
          } finally {
            setBusy(null);
          }
        }}>Exportar todos os meus dados (JSON)</Button>
        <div className="flex gap-4 text-sm"><Link className="text-primary underline" href="/privacidade">Política de Privacidade</Link><Link className="text-primary underline" href="/termos">Termos de Uso</Link></div>
        <Button variant="ghost" className="w-full text-error" icon={<Trash2 className="size-4" />} onClick={() => setDeleting(true)}>Excluir minha conta</Button>
      </Card>

      <Button variant="outline" className="mt-6 w-full" icon={<LogOut className="size-4" />} onClick={signOut}>Sair da conta</Button>
      <p className="mt-4 text-center text-xs text-muted">Vilma — Minha Vida · {user?.email}</p>

      <ConfirmDialog open={revokeAI} title="Revogar autorização da IA?" message="A Vilma volta para o modo básico (sem IA) até você autorizar novamente. Seu histórico de conversas permanece até que você o exclua." confirmLabel="Revogar" onCancel={() => setRevokeAI(false)} onConfirm={async () => { await updateProfile({ ai_consent_at: null, ai_consent_provider: null }); await getSupabase().from("consents").insert({ kind: profile.ai_consent_provider === "gemini" ? "ia_google" : "ia", granted: false }); setRevokeAI(false); }} />
      <ConfirmDialog open={disconnect} title="Desconectar o Google?" message="O acesso é revogado e os tokens apagados. O que já está no app continua no app, e o que já foi para o Google continua no Google." confirmLabel="Desconectar" onCancel={() => setDisconnect(false)} onConfirm={async () => { const r = await fetch("/api/google/disconnect", { method: "POST" }); setDisconnect(false); invalidate("integrations"); toast.show(r.ok ? "Google desconectado." : "Falha ao desconectar.", r.ok ? "success" : "error"); }} />
      <ConfirmDialog
        open={deleting}
        danger
        title="Excluir conta definitivamente?"
        loading={busy === "delete"}
        message={<div className="space-y-3"><p>Todos os seus dados (tarefas, finanças, diário, ciclo, arquivos e conversas) serão apagados permanentemente. Recomendamos exportar seus dados antes.</p><label className="block"><span className="label">Digite EXCLUIR para confirmar</span><Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} /></label></div>}
        confirmLabel="Excluir conta"
        onCancel={() => { setDeleting(false); setDeleteText(""); }}
        onConfirm={async () => {
          if (deleteText.trim().toUpperCase() !== "EXCLUIR") return toast.show("Digite EXCLUIR para confirmar.", "error");
          setBusy("delete");
          if (isLocalMode) {
            deleteLocalAccount();
            try { Object.keys(localStorage).filter((k) => k.startsWith("vilma:")).forEach((k) => localStorage.removeItem(k)); } catch {}
            window.location.href = withBase("/?conta=excluida");
            return;
          }
          const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "EXCLUIR" }) });
          setBusy(null);
          if (!res.ok) return toast.show((await res.json()).error ?? "Não foi possível excluir.", "error");
          try { localStorage.clear(); } catch {}
          await getSupabase().auth.signOut();
          window.location.href = withBase("/?conta=excluida");
        }}
      />
    </>
  );
}

function CategoriesEditor() {
  const { data: cats } = useCategories();
  const [scope, setScope] = useState<Category["scope"]>("despesa");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("✨");
  const [color, setColor] = useState("#7451A6");
  const toast = useToast();
  const list = cats.filter((c) => c.scope === scope);
  return (
    <Card className="space-y-3">
      <Select value={scope} onChange={(e) => setScope(e.target.value as Category["scope"])} aria-label="Tipo de categoria"><option value="despesa">Despesas</option><option value="receita">Receitas</option><option value="tarefa">Tarefas</option><option value="evento">Agenda</option><option value="nota">Anotações</option></Select>
      <ul className="flex flex-wrap gap-2">
        {list.map((c) => (
          <li key={c.id} className={cn("inline-flex items-center gap-1.5 rounded-pill border border-line py-1 pl-3 pr-1 text-sm")}>
            <span className="size-2.5 rounded-full" style={{ background: c.color }} aria-hidden />{c.icon} {c.name}
            <button aria-label={`Excluir categoria ${c.name}`} onClick={() => mutate({ action: "delete", table: "categories", id: c.id })} className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface-2"><Trash2 className="size-3.5" /></button>
          </li>
        ))}
      </ul>
      <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; try { await mutate({ action: "insert", table: "categories", values: { scope, name: name.trim().slice(0, 60), icon, color } }); setName(""); } catch (err) { toast.show((err as Error).message, "error"); } }}>
        <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-14 text-center" maxLength={4} aria-label="Ícone" />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria" className="min-w-0 flex-1" aria-label="Nome da categoria" />
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-14 p-1" aria-label="Cor" />
        <Button type="submit" size="icon" aria-label="Adicionar categoria"><Plus className="size-5" /></Button>
      </form>
      <Badge tone="neutral">Excluir uma categoria não apaga registros — eles ficam “sem categoria”.</Badge>
    </Card>
  );
}

function PushToggle() {
  const toast = useToast();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== "undefined" && pushSupported();
  useEffect(() => {
    void currentSubscription().then((s) => setOn(!!s));
  }, []);
  if (isLocalMode) return <p className="py-2 text-xs text-muted">Notificações com o app fechado chegam com a versão online. No modo local, os lembretes funcionam com o app aberto ou usado recentemente.</p>;
  if (!vapidKey) return <p className="py-2 text-xs text-muted">Notificações com o app fechado: aguardando configuração das chaves VAPID no servidor. Com o app aberto, os lembretes funcionam normalmente.</p>;
  return (
    <div className="py-1">
      <Toggle
        checked={on}
        disabled={busy || !supported}
        onChange={async (b) => {
          setBusy(true);
          try {
            if (b) {
              const r = await enablePush();
              if (!r.ok) toast.show(r.error ?? "Não foi possível ativar.", "error");
              setOn(r.ok);
            } else {
              await disablePush();
              setOn(false);
            }
          } finally {
            setBusy(false);
          }
        }}
        label="Receber com o app fechado (push)"
        description={supported ? "Lembretes, vencimentos e resumos chegam mesmo com o app fechado neste dispositivo." : "Não suportado neste navegador. No iPhone, instale o app na Tela de Início (iOS 16.4+)."}
      />
      {on && <Button size="sm" variant="ghost" onClick={async () => { const r = await fetch("/api/push/test", { method: "POST" }); const j = await r.json(); toast.show(r.ok ? (j.sent ? "Notificação de teste enviada." : "Nenhum dispositivo inscrito.") : j.error, r.ok ? "success" : "error"); }}>Enviar notificação de teste</Button>}
    </div>
  );
}
