"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, ChevronLeft } from "lucide-react";
import { useSession } from "@/lib/session";
import { Button, Field, Input, ProgressBar, Toggle, Segmented } from "@/components/ui/primitives";
import { LogoMark } from "@/components/brand/logo";
import { useToast } from "@/components/ui/toast";
import { getSupabase } from "@/lib/supabase/client";
import { uploadUserFile, useFileUrl } from "@/lib/files";
import { parseBRL } from "@/lib/domain/money";
import { unlock, award } from "@/lib/data/actions";
import { DEFAULT_WIDGETS } from "@/components/dashboard/widgets-config";
import type { Profile } from "@/lib/types";

const GOALS = ["Ter uma rotina mais leve", "Organizar minhas finanças", "Dormir melhor", "Criar hábitos saudáveis", "Ser mais produtiva", "Cuidar da saúde mental", "Estudar com constância", "Treinar regularmente", "Organizar a casa", "Realizar um sonho"];
const INTERESTS = [
  { key: "financas", label: "💸 Finanças" }, { key: "habitos", label: "🌱 Hábitos" }, { key: "sono", label: "🌙 Sono" }, { key: "humor", label: "📔 Diário" },
  { key: "agua", label: "💧 Hidratação" }, { key: "treinos", label: "💪 Treinos" }, { key: "estudos", label: "📚 Estudos" }, { key: "trabalho", label: "💼 Trabalho" },
  { key: "casa", label: "🏡 Casa" }, { key: "metas", label: "🎯 Metas" }, { key: "ciclo", label: "🌸 Ciclo menstrual" },
];

export function Onboarding() {
  const { user, profile, loading, updateProfile } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    full_name: "", nickname: "", avatar_url: null as string | null,
    goals: [] as string[], interests: ["habitos", "financas", "sono", "agua", "metas"] as string[],
    wake_time: "07:00", bed_time: "23:00", work_start: "", work_end: "",
    sleep_hours: "8", water_goal_ml: "2000", monthly_budget: "", monthly_savings_goal: "", initial_balance: "",
    notif: { tarefas: true, compromissos: true, vencimentos: true, habitos: true, agua: false, resumo_manha: true, revisao_noite: false } as Record<string, boolean>,
    theme: "system" as Profile["theme"], gamificacao: true, ai: true, cycleConsent: false,
  });
  const avatar = useFileUrl(f.avatar_url);

  useEffect(() => {
    if (!loading && !user) router.replace("/entrar");
    if (profile) {
      if (profile.onboarding_completed) router.replace("/inicio");
      setF((s) => ({ ...s, full_name: s.full_name || profile.full_name || "", avatar_url: s.avatar_url ?? profile.avatar_url }));
    }
  }, [loading, user, profile, router]);

  const steps = ["Você", "Objetivos", "Rotina", "Metas", "Preferências"];
  const toggle = (k: "goals" | "interests", v: string) => setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  async function finish(skipRest = false) {
    if (!user) return;
    if (!f.full_name.trim() && !skipRest) {
      setStep(0);
      return toast.show("Conte como podemos te chamar 💜", "error");
    }
    setSaving(true);
    try {
      const sb = getSupabase();
      const interests = f.interests;
      const widgets = DEFAULT_WIDGETS.map((w) => ({ key: w.key, visible: !w.interest || interests.includes(w.interest) }));
      const now = new Date().toISOString();
      const sleepH = Math.min(14, Math.max(3, Number(f.sleep_hours.replace(",", ".")) || 8));
      const budget = parseBRL(f.monthly_budget);
      const savings = parseBRL(f.monthly_savings_goal);
      await updateProfile({
        full_name: f.full_name.trim() || profile?.full_name || null,
        nickname: f.nickname.trim() || null,
        avatar_url: f.avatar_url,
        goals: f.goals,
        interests,
        wake_time: f.wake_time || null,
        bed_time: f.bed_time || null,
        work_start: f.work_start || null,
        work_end: f.work_end || null,
        sleep_goal_minutes: Math.round(sleepH * 60),
        water_goal_ml: Math.min(8000, Math.max(250, Number(f.water_goal_ml) || 2000)),
        monthly_budget: budget ? (budget / 100).toFixed(2) : null,
        monthly_savings_goal: savings ? (savings / 100).toFixed(2) : null,
        notification_prefs: f.notif,
        dashboard_widgets: widgets,
        theme: f.theme,
        modules: { ciclo: interests.includes("ciclo") && f.cycleConsent, gamificacao: f.gamificacao, treinos: true, estudos: true, trabalho: true, casa: true },
        ai_consent_at: f.ai ? now : null,
        cycle_consent_at: interests.includes("ciclo") && f.cycleConsent ? now : null,
        privacy_accepted_at: profile?.privacy_accepted_at ?? now,
        onboarding_completed: true,
      });
      const consents = [{ kind: "privacidade", granted: true }, { kind: "ia", granted: f.ai }];
      if (interests.includes("ciclo")) consents.push({ kind: "ciclo", granted: f.cycleConsent });
      await sb.from("consents").insert(consents);
      const bal = parseBRL(f.initial_balance);
      if (bal !== null && f.initial_balance.trim()) {
        await sb.from("financial_accounts").insert({ name: "Conta principal", type: "corrente", initial_balance: (bal / 100).toFixed(2) });
      }
      if (budget) await sb.from("budgets").insert({ month: new Date().toISOString().slice(0, 8) + "01", category_id: null, limit_amount: (budget / 100).toFixed(2) });
      await unlock("primeiro_passo");
      await award("meta_etapa", "onboarding");
      router.replace("/inicio");
    } catch {
      toast.show("Não foi possível salvar. Verifique sua conexão.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8 pt-6">
      <div className="flex items-center gap-3">
        {step > 0 ? <Button variant="ghost" size="icon" onClick={() => setStep(step - 1)} aria-label="Voltar"><ChevronLeft className="size-5" /></Button> : <LogoMark size={40} />}
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted">Passo {step + 1} de {steps.length} · {steps[step]}</p>
          <ProgressBar value={((step + 1) / steps.length) * 100} className="mt-1" label="Progresso do cadastro" />
        </div>
        <button onClick={() => finish(true)} className="text-sm font-semibold text-muted hover:text-primary" disabled={saving}>Pular</button>
      </div>

      <AnimatePresence mode="wait">
        <motion.section key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-8 flex-1 space-y-5">
          {step === 0 && (
            <>
              <h1 className="font-display text-3xl font-semibold">Oi! Eu sou a Vilma 💜</h1>
              <p className="text-ink-soft">Vou te ajudar a organizar a vida. Como posso te chamar?</p>
              <div className="flex items-center gap-4">
                <label className="relative grid size-20 cursor-pointer place-items-center overflow-hidden rounded-full bg-primary-soft text-primary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {avatar ? <img src={avatar} alt="Sua foto" className="size-full object-cover" /> : <Camera className="size-7" aria-hidden />}
                  <input type="file" accept="image/*" className="sr-only" aria-label="Escolher foto de perfil" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !user) return;
                    try {
                      const path = await uploadUserFile(user.id, "avatar", file);
                      setF((s) => ({ ...s, avatar_url: path }));
                    } catch (err) {
                      toast.show((err as Error).message, "error");
                    }
                  }} />
                </label>
                <p className="text-sm text-muted">Foto de perfil (opcional)</p>
              </div>
              <Field label="Nome">{(id) => <Input id={id} value={f.full_name} onChange={(e) => setF((s) => ({ ...s, full_name: e.target.value }))} autoComplete="name" maxLength={120} />}</Field>
              <Field label="Apelido (como a Vilma vai te chamar)">{(id) => <Input id={id} value={f.nickname} onChange={(e) => setF((s) => ({ ...s, nickname: e.target.value }))} maxLength={60} placeholder="Opcional" />}</Field>
            </>
          )}
          {step === 1 && (
            <>
              <h1 className="font-display text-3xl font-semibold">O que você quer cuidar?</h1>
              <fieldset><legend className="label">Seus objetivos</legend>
                <div className="flex flex-wrap gap-2">{GOALS.map((g) => <button key={g} type="button" aria-pressed={f.goals.includes(g)} onClick={() => toggle("goals", g)} className={`rounded-pill px-3.5 py-2 text-sm ${f.goals.includes(g) ? "bg-primary text-primary-ink" : "bg-surface text-ink-soft shadow-soft-sm"}`}>{g}</button>)}</div>
              </fieldset>
              <fieldset><legend className="label">Áreas de interesse (personalizam sua tela inicial)</legend>
                <div className="flex flex-wrap gap-2">{INTERESTS.map((g) => <button key={g.key} type="button" aria-pressed={f.interests.includes(g.key)} onClick={() => toggle("interests", g.key)} className={`rounded-pill px-3.5 py-2 text-sm ${f.interests.includes(g.key) ? "bg-orchid text-white dark:bg-primary dark:text-primary-ink" : "bg-surface text-ink-soft shadow-soft-sm"}`}>{g.label}</button>)}</div>
              </fieldset>
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="font-display text-3xl font-semibold">Sua rotina</h1>
              <p className="text-ink-soft">Usamos esses horários para organizar seu plano do dia e lembretes.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Acordo às">{(id) => <Input id={id} type="time" value={f.wake_time} onChange={(e) => setF((s) => ({ ...s, wake_time: e.target.value }))} />}</Field>
                <Field label="Durmo às">{(id) => <Input id={id} type="time" value={f.bed_time} onChange={(e) => setF((s) => ({ ...s, bed_time: e.target.value }))} />}</Field>
                <Field label="Trabalho/estudo começa">{(id) => <Input id={id} type="time" value={f.work_start} onChange={(e) => setF((s) => ({ ...s, work_start: e.target.value }))} />}</Field>
                <Field label="Termina">{(id) => <Input id={id} type="time" value={f.work_end} onChange={(e) => setF((s) => ({ ...s, work_end: e.target.value }))} />}</Field>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h1 className="font-display text-3xl font-semibold">Suas metas</h1>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Meta de sono (horas)">{(id) => <Input id={id} inputMode="decimal" value={f.sleep_hours} onChange={(e) => setF((s) => ({ ...s, sleep_hours: e.target.value }))} />}</Field>
                <Field label="Meta de água (ml)">{(id) => <Input id={id} type="number" min={250} max={8000} step={250} value={f.water_goal_ml} onChange={(e) => setF((s) => ({ ...s, water_goal_ml: e.target.value }))} />}</Field>
                <Field label="Orçamento mensal (R$)" hint="Opcional">{(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" value={f.monthly_budget} onChange={(e) => setF((s) => ({ ...s, monthly_budget: e.target.value }))} placeholder="0,00" />}</Field>
                <Field label="Quero guardar por mês (R$)" hint="Opcional">{(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" value={f.monthly_savings_goal} onChange={(e) => setF((s) => ({ ...s, monthly_savings_goal: e.target.value }))} placeholder="0,00" />}</Field>
              </div>
              <Field label="Saldo atual da sua conta principal (R$)" hint="Opcional. Cria a “Conta principal” com o saldo real que você informar — nada é inventado.">{(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" value={f.initial_balance} onChange={(e) => setF((s) => ({ ...s, initial_balance: e.target.value }))} placeholder="Ex.: 1.250,00" />}</Field>
            </>
          )}
          {step === 4 && (
            <>
              <h1 className="font-display text-3xl font-semibold">Do seu jeito</h1>
              <div><span className="label">Tema</span><Segmented label="Tema" value={f.theme} onChange={(t) => setF((s) => ({ ...s, theme: t }))} options={[{ value: "system", label: "Automático" }, { value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }]} /></div>
              <div className="card divide-y divide-line px-4 py-1">
                <Toggle checked={f.notif.compromissos} onChange={(b) => setF((s) => ({ ...s, notif: { ...s.notif, compromissos: b } }))} label="Lembretes de compromissos" />
                <Toggle checked={f.notif.tarefas} onChange={(b) => setF((s) => ({ ...s, notif: { ...s.notif, tarefas: b } }))} label="Lembretes de tarefas" />
                <Toggle checked={f.notif.vencimentos} onChange={(b) => setF((s) => ({ ...s, notif: { ...s.notif, vencimentos: b } }))} label="Contas a vencer" />
                <Toggle checked={f.notif.resumo_manha} onChange={(b) => setF((s) => ({ ...s, notif: { ...s.notif, resumo_manha: b } }))} label="Resumo do dia pela manhã" />
                <Toggle checked={f.notif.agua} onChange={(b) => setF((s) => ({ ...s, notif: { ...s.notif, agua: b } }))} label="Lembretes de água" />
              </div>
              <div className="card divide-y divide-line px-4 py-1">
                <Toggle checked={f.gamificacao} onChange={(b) => setF((s) => ({ ...s, gamificacao: b }))} label="Pontos e conquistas" description="Celebra seu progresso, sem punir dias difíceis." />
                <Toggle checked={f.ai} onChange={(b) => setF((s) => ({ ...s, ai: b }))} label="Assistente Vilma (IA)" description="Autorizo enviar minhas mensagens e o contexto mínimo necessário à IA (Anthropic). Diário e ciclo nunca são enviados." />
                {f.interests.includes("ciclo") && (
                  <Toggle checked={f.cycleConsent} onChange={(b) => setF((s) => ({ ...s, cycleConsent: b }))} label="Consentimento para dados do ciclo" description="Dados de saúde sensíveis (LGPD art. 11). Ficam só na sua conta e podem ser apagados a qualquer momento." />
                )}
              </div>
            </>
          )}
        </motion.section>
      </AnimatePresence>

      <div className="mt-8">
        {step < steps.length - 1 ? (
          <Button className="w-full" size="lg" onClick={() => (step === 0 && !f.full_name.trim() ? toast.show("Conte como podemos te chamar 💜", "error") : setStep(step + 1))}>Continuar</Button>
        ) : (
          <Button className="w-full" size="lg" loading={saving} onClick={() => finish()}>Começar a usar</Button>
        )}
      </div>
    </main>
  );
}
