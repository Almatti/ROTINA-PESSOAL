"use client";
import { useState } from "react";
import { Moon, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, Ring, Stat, EmptyState, Field, Input, SectionTitle } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { SleepForm } from "@/components/modules/sleep-form";
import { Bars, CHART_COLORS } from "@/components/charts";
import { useSession } from "@/lib/session";
import { useSleepLogs } from "@/lib/data/hooks";
import { sleepStats } from "@/lib/domain/sleep";
import { addDays, minutesToLabel, localTimeHHMM, WEEKDAY_SHORT, weekdayOf, formatDayMonth, greeting } from "@/lib/domain/dates";
import { mutate } from "@/lib/data/store";
import { useToast } from "@/components/ui/toast";
import type { SleepLogRow } from "@/lib/types";

export default function SleepPage() {
  const { today, tz, profile, updateProfile, hour } = useSession();
  const toast = useToast();
  const { data: logs = [] } = useSleepLogs(90);
  const [form, setForm] = useState<SleepLogRow | null | "new">(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalHours, setGoalHours] = useState("");
  const [del, setDel] = useState<SleepLogRow | null>(null);
  const goal = profile?.sleep_goal_minutes ?? 480;
  const s = sleepStats(logs, goal, today);
  const lastPct = s.last ? Math.round((s.last.duration_minutes / goal) * 100) : 0;
  const [range, setRange] = useState<7 | 30>(7);
  const days = Array.from({ length: range }, (_, i) => addDays(today, i - range + 1));
  const map = new Map(logs.map((l) => [l.sleep_date, l.duration_minutes]));
  const chart = days.map((d) => ({ dia: range === 7 ? WEEKDAY_SHORT[weekdayOf(d)] : formatDayMonth(d), Horas: map.has(d) ? Math.round((map.get(d)! / 60) * 10) / 10 : null }));
  const qualityEmoji = ["", "😫", "😕", "😐", "😌", "😴"];

  return (
    <>
      <PageHeader title="Sono" icon={<Moon className="size-5" />} actions={<Button size="sm" variant="ghost" aria-label="Meta de sono" onClick={() => { setGoalHours(String(goal / 60).replace(".", ",")); setGoalOpen(true); }}><SlidersHorizontal className="size-4" /></Button>} />
      <section className="night-card stars rounded-card-lg p-5 shadow-soft-lg">
        <p className="eyebrow text-white/70">{greeting(hour)}</p>
        <h2 className="text-xl font-bold">Como foi sua noite?</h2>
        <div className="mt-4 flex items-center gap-4">
          <Ring value={lastPct} size={110} stroke={9} color="#BAAAC8" track="rgba(255,255,255,0.15)" label={`Última noite: ${s.last ? minutesToLabel(s.last.duration_minutes) : "sem registro"}`}>
            <div><span className="text-lg" aria-hidden>{s.last?.quality ? qualityEmoji[s.last.quality] : "🌙"}</span><p className="text-xl font-bold">{s.last ? minutesToLabel(s.last.duration_minutes) : "—"}</p><p className="text-[0.6rem] uppercase text-white/70">{lastPct}% da meta</p></div>
          </Ring>
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <p className="font-semibold">{s.last ? `Última noite: ${minutesToLabel(s.last.duration_minutes)}` : "Nenhuma noite registrada ainda"}</p>
            {s.last && <p className="text-white/75">{s.last.duration_minutes >= goal ? "Meta de sono alcançada." : `Faltaram ${minutesToLabel(goal - s.last.duration_minutes)} para a meta.`}</p>}
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-pill bg-white/12 px-2.5 py-1">🎯 meta {minutesToLabel(goal)}</span>
              {s.last && <span className="rounded-pill bg-white/12 px-2.5 py-1">🛏️ {localTimeHHMM(new Date(s.last.bed_at), tz)} → {localTimeHHMM(new Date(s.last.wake_at), tz)}</span>}
            </div>
          </div>
        </div>
        <button onClick={() => setForm("new")} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-white font-semibold text-orchid"><Plus className="size-5" aria-hidden />Registrar minha noite</button>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat icon="🌙" label="Média da semana" value={s.weekAvg ? minutesToLabel(s.weekAvg) : "—"} sub={s.monthAvg ? `mês: ${minutesToLabel(s.monthAvg)}` : undefined} />
        <Stat icon="🏆" label="Melhor noite" value={s.best ? minutesToLabel(s.best.duration_minutes) : "—"} sub="últimos 30 dias" />
        <Stat icon="🔥" label="Noites na meta" value={s.nightsOnGoal} sub={`${s.streakOnGoal} seguida(s)`} />
        <Stat icon="💤" label="Diferença da meta (7 dias)" value={s.debtMinutes === 0 ? "zerada" : `−${minutesToLabel(s.debtMinutes)}`} tone={s.debtMinutes === 0 ? "success" : "error"} />
      </div>

      <Card className="mt-4">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Sua {range === 7 ? "semana" : "evolução (30 dias)"}</h2><div className="flex gap-1 text-xs"><button className={range === 7 ? "font-bold text-primary" : "text-muted"} onClick={() => setRange(7)}>7 dias</button>·<button className={range === 30 ? "font-bold text-primary" : "text-muted"} onClick={() => setRange(30)}>30 dias</button></div></div>
        {logs.length ? <Bars data={chart} xKey="dia" series={[{ key: "Horas", label: "Horas dormidas", color: CHART_COLORS[0] }]} goal={{ value: goal / 60, label: `meta ${minutesToLabel(goal)}` }} format={(v) => `${v}h`} /> : <EmptyState icon="🌙" title="Registre sua primeira noite" />}
      </Card>

      <SectionTitle>Histórico</SectionTitle>
      <Card className="divide-y divide-line py-1">
        {logs.length === 0 && <p className="py-3 text-sm text-muted">Sem registros.</p>}
        {logs.slice(0, 30).map((l) => (
          <div key={l.id} className="flex items-center gap-3 py-2.5">
            <span className="text-xl" aria-hidden>{l.quality ? qualityEmoji[l.quality] : "🌙"}</span>
            <button onClick={() => setForm(l)} className="flex-1 text-left"><p className="font-semibold">{formatDayMonth(l.sleep_date)} · {minutesToLabel(l.duration_minutes)}</p><p className="text-xs text-muted">{localTimeHHMM(new Date(l.bed_at), tz)} → {localTimeHHMM(new Date(l.wake_at), tz)}{l.duration_minutes >= goal ? " · na meta ✓" : ""}</p></button>
            <Button size="icon" variant="ghost" aria-label="Excluir registro" onClick={() => setDel(l)}><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </Card>
      <p className="mt-3 text-center text-xs text-muted">Indicadores informativos, sem finalidade de diagnóstico médico. Se tiver dificuldades persistentes para dormir, procure um profissional de saúde.</p>

      <Sheet open={!!form} onClose={() => setForm(null)} title="Registrar noite">{form && <SleepForm log={form === "new" ? null : form} onDone={() => setForm(null)} />}</Sheet>
      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title="Meta de sono">
        <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const h = Number(goalHours.replace(",", ".")); if (!(h >= 3 && h <= 14)) return toast.show("Informe entre 3 e 14 horas.", "error"); await updateProfile({ sleep_goal_minutes: Math.round(h * 60) }); setGoalOpen(false); toast.show("Meta atualizada.", "success"); }}>
          <Field label="Horas por noite">{(id) => <Input id={id} inputMode="decimal" value={goalHours} onChange={(e) => setGoalHours(e.target.value)} />}</Field>
          <Button type="submit" className="w-full">Salvar</Button>
        </form>
      </Sheet>
      <ConfirmDialog open={!!del} danger title="Excluir registro de sono?" message="Esta ação não pode ser desfeita." confirmLabel="Excluir" onCancel={() => setDel(null)} onConfirm={async () => { await mutate({ action: "delete", table: "sleep_logs", id: del!.id }); setDel(null); }} />
    </>
  );
}
