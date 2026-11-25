"use client";
import { useState } from "react";
import { Flower2, ShieldCheck, Droplet, Trash2, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, Field, Input, Select, Textarea, Toggle, SectionTitle, Stat, EmptyState } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { MonthGrid, MonthNav } from "@/components/calendar-bits";
import { useSession } from "@/lib/session";
import { useTable } from "@/lib/data/hooks";
import { mutate, invalidate } from "@/lib/data/store";
import { getSupabase } from "@/lib/supabase/client";
import { predictCycle, cycleCalendarMarks, averageCycleLength, CYCLE_DISCLAIMER } from "@/lib/domain/cycle";
import { monthStart, monthEnd, addDays, formatDateBR, diffDays } from "@/lib/domain/dates";
import { useToast } from "@/components/ui/toast";

interface Period { id: string; start_date: string; end_date: string | null; flow: string | null; notes: string | null }
interface SymptomLog { id: string; log_date: string; symptoms: string[]; flow: string | null; notes: string | null }
const SYMPTOMS = ["Cólica", "Dor de cabeça", "Inchaço", "Sensibilidade nos seios", "Acne", "Cansaço", "Irritabilidade", "Ansiedade", "Desejo por doces", "Dor nas costas", "Náusea", "Insônia"];

export default function CyclePage() {
  const { today, profile, updateProfile } = useSession();
  const toast = useToast();
  const enabled = profile?.modules?.ciclo === true && !!profile?.cycle_consent_at;
  const { data: periods = [] } = useTable<Period>("cycle_periods", { order: "start_date", key: enabled ? "on" : "off" });
  const { data: symptoms = [] } = useTable<SymptomLog>("cycle_symptoms", { order: "log_date", key: enabled ? "on" : "off" });
  const [month, setMonth] = useState(monthStart(today));
  const [day, setDay] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [disable, setDisable] = useState(false);
  const [wipe, setWipe] = useState(false);

  if (!profile) return null;
  if (!enabled) {
    return (
      <>
        <PageHeader title="Ciclo menstrual" icon={<Flower2 className="size-5" />} />
        <Card className="space-y-4 p-5">
          <ShieldCheck className="size-10 text-primary" aria-hidden />
          <h2 className="text-lg font-bold">Módulo opcional e protegido</h2>
          <p className="text-sm text-ink-soft">Registre menstruação, fluxo e sintomas para ver previsões estimadas. Esses são dados sensíveis de saúde (LGPD, art. 11): ficam somente na sua conta, nunca são enviados à assistente de IA e podem ser apagados a qualquer momento.</p>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" /><span>Consinto, de forma específica e destacada, com o tratamento dos meus dados do ciclo menstrual para as finalidades deste módulo.</span></label>
          <Button disabled={!consent} onClick={async () => {
            await updateProfile({ modules: { ...profile.modules, ciclo: true }, cycle_consent_at: new Date().toISOString() });
            await getSupabase().from("consents").insert({ kind: "ciclo", granted: true });
            toast.show("Módulo ativado.", "success");
          }}>Ativar módulo</Button>
        </Card>
      </>
    );
  }

  const pred = predictCycle(periods, today);
  const marks = cycleCalendarMarks(periods, pred, addDays(monthStart(month), -7), addDays(monthEnd(month), 7));
  const open = [...periods].reverse().find((p) => !p.end_date);
  const avgLen = averageCycleLength(periods);

  async function startToday() {
    if (periods.some((p) => p.start_date === today)) return toast.show("Já registrado hoje.", "info");
    await mutate({ action: "insert", table: "cycle_periods", values: { start_date: today } });
    toast.show("Início da menstruação registrado.", "success");
  }

  return (
    <>
      <PageHeader title="Meu ciclo" icon={<Flower2 className="size-5" />} />
      <Card className="flex items-center gap-4 bg-error-soft/50">
        <span className="grid size-14 place-items-center rounded-full bg-surface text-error"><Droplet className="size-7" aria-hidden /></span>
        <div className="flex-1">
          {pred ? <><p className="text-sm text-muted">Dia {pred.currentDay ?? "—"} do ciclo</p><p className="font-bold">Próxima menstruação estimada: {formatDateBR(pred.nextStart)}</p><p className="text-xs text-muted">em {Math.max(0, diffDays(pred.nextStart, today))} dia(s){!pred.basedOnHistory && " · estimativa padrão (registre mais ciclos)"}</p></> : <><p className="font-bold">Vamos acompanhar seu ciclo?</p><p className="text-xs text-muted">Toque em “Registrar hoje” no primeiro dia da menstruação.</p></>}
        </div>
      </Card>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {open ? <Button variant="soft" onClick={async () => { await mutate({ action: "update", table: "cycle_periods", id: open.id, values: { end_date: today < open.start_date ? open.start_date : today } }); toast.show("Fim registrado.", "success"); }}>Registrar fim hoje</Button> : <Button onClick={startToday}>Registrar hoje</Button>}
        <Button variant="outline" onClick={() => setDay(today)}>Sintomas de hoje</Button>
      </div>
      <p className="mt-3 flex gap-2 rounded-2xl bg-warning-soft p-3 text-xs text-warning"><Info className="size-4 shrink-0" aria-hidden />{CYCLE_DISCLAIMER}</p>

      <div className="mt-4"><MonthNav month={month} onChange={setMonth} /></div>
      <Card className="mt-3">
        <MonthGrid month={month} today={today} onSelect={(d) => d <= today && setDay(d)} renderDay={(d) => {
          const m = marks.get(d);
          const hasSym = symptoms.some((s) => s.log_date === d && s.symptoms.length);
          return (
            <>
              <span className={`grid size-8 place-items-center rounded-full text-sm ${m === "menstruacao" ? "bg-error font-bold text-white" : m === "previsao" ? "border-2 border-dashed border-error text-error" : m === "fertil" ? "bg-info-soft text-info" : ""}`}>{Number(d.slice(8))}</span>
              {hasSym && <span className="mt-0.5 size-1 rounded-full bg-primary" aria-label="sintomas registrados" />}
            </>
          );
        }} />
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-error" />Menstruação</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border border-dashed border-error" />Previsão</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-info-soft" />Janela fértil estimada</span>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Duração média do ciclo" value={avgLen ? `${avgLen} dias` : "—"} sub={avgLen ? undefined : "precisa de 2+ ciclos"} />
        <Stat label="Duração da menstruação" value={pred ? `${pred.periodLength} dias` : "—"} />
      </div>

      <SectionTitle>Histórico</SectionTitle>
      {periods.length === 0 ? <EmptyState icon="🌸" title="Nenhum ciclo registrado" /> : (
        <Card className="divide-y divide-line py-1">
          {[...periods].reverse().map((p, i, arr) => {
            const next = arr[i - 1];
            return (
              <div key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="flex-1"><p className="font-semibold">{formatDateBR(p.start_date)} {p.end_date ? `– ${formatDateBR(p.end_date)}` : "· em andamento"}</p><p className="text-xs text-muted">{p.end_date ? `${diffDays(p.end_date, p.start_date) + 1} dias de menstruação` : ""}{next ? ` · ciclo de ${diffDays(next.start_date, p.start_date)} dias` : ""}{p.flow ? ` · fluxo ${p.flow}` : ""}</p></div>
                <Button size="icon" variant="ghost" aria-label="Excluir registro" onClick={() => mutate({ action: "delete", table: "cycle_periods", id: p.id })}><Trash2 className="size-4" /></Button>
              </div>
            );
          })}
        </Card>
      )}

      <SectionTitle>Privacidade do módulo</SectionTitle>
      <Card className="space-y-2">
        <Toggle checked={!!profile.notification_prefs?.ciclo} onChange={(b) => updateProfile({ notification_prefs: { ...profile.notification_prefs, ciclo: b } })} label="Lembrete perto da data prevista" description="Notificação discreta, sem detalhes no texto." />
        <Button variant="outline" className="w-full" onClick={() => setDisable(true)}>Desativar módulo</Button>
        <Button variant="ghost" className="w-full text-error" onClick={() => setWipe(true)}>Apagar todos os dados do ciclo</Button>
      </Card>

      <DaySheet day={day} onClose={() => setDay(null)} existing={symptoms.find((s) => s.log_date === day) ?? null} period={periods.find((p) => day && p.start_date <= day && (p.end_date ?? p.start_date) >= day) ?? null} />
      <ConfirmDialog open={disable} title="Desativar o módulo de ciclo?" message="O módulo some do menu e o consentimento é revogado. Seus registros permanecem guardados até que você os apague." confirmLabel="Desativar" onCancel={() => setDisable(false)} onConfirm={async () => {
        await updateProfile({ modules: { ...profile.modules, ciclo: false }, cycle_consent_at: null });
        await getSupabase().from("consents").insert({ kind: "ciclo", granted: false });
        setDisable(false);
      }} />
      <ConfirmDialog open={wipe} danger title="Apagar dados do ciclo?" message="Todos os períodos e sintomas registrados serão apagados definitivamente." confirmLabel="Apagar tudo" onCancel={() => setWipe(false)} onConfirm={async () => {
        const sb = getSupabase();
        await sb.from("cycle_symptoms").delete().not("id", "is", null);
        await sb.from("cycle_periods").delete().not("id", "is", null);
        invalidate("cycle_periods", "cycle_symptoms");
        setWipe(false);
        toast.show("Dados do ciclo apagados.", "success");
      }} />
    </>
  );
}

function DaySheet({ day, onClose, existing, period }: { day: string | null; onClose: () => void; existing: SymptomLog | null; period: Period | null }) {
  const toast = useToast();
  const [sel, setSel] = useState<string[]>([]);
  const [flow, setFlow] = useState("");
  const [notes, setNotes] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (day && loadedFor !== day) {
    setLoadedFor(day);
    setSel(existing?.symptoms ?? []);
    setFlow(existing?.flow ?? "");
    setNotes(existing?.notes ?? "");
  }
  return (
    <Sheet open={!!day} onClose={onClose} title={day ? `Registro de ${formatDateBR(day)}` : ""}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        const values = { log_date: day, symptoms: sel, flow: flow || null, notes: notes || null };
        if (existing) await mutate({ action: "update", table: "cycle_symptoms", id: existing.id, values });
        else await mutate({ action: "insert", table: "cycle_symptoms", values });
        if (period && flow && flow !== "nenhum") await mutate({ action: "update", table: "cycle_periods", id: period.id, values: { flow } });
        toast.show("Registro salvo.", "success");
        onClose();
      }}>
        <Field label="Intensidade do fluxo">{(id) => <Select id={id} value={flow} onChange={(e) => setFlow(e.target.value)}><option value="">Não informar</option><option value="nenhum">Sem fluxo</option><option value="leve">Leve</option><option value="moderado">Moderado</option><option value="intenso">Intenso</option></Select>}</Field>
        <fieldset><legend className="label">Sintomas</legend><div className="flex flex-wrap gap-1.5">{SYMPTOMS.map((s) => { const on = sel.includes(s); return <button key={s} type="button" aria-pressed={on} onClick={() => setSel((l) => (on ? l.filter((x) => x !== s) : [...l, s]))} className={`rounded-pill px-3 py-1.5 text-sm ${on ? "bg-primary text-primary-ink" : "bg-surface-2"}`}>{s}</button>; })}</div></fieldset>
        <Field label="Observações">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}</Field>
        <Button type="submit" className="w-full">Salvar</Button>
      </form>
    </Sheet>
  );
}
