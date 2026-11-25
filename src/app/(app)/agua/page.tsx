"use client";
import { useState } from "react";
import { Droplets, Trash2, ChevronLeft, ChevronRight, SlidersHorizontal, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, ProgressBar, SectionTitle, Field, Input, Segmented, cn } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { Bars, CHART_COLORS } from "@/components/charts";
import { useSession } from "@/lib/session";
import { useWaterLogs } from "@/lib/data/hooks";
import { addWater, award, unlock } from "@/lib/data/actions";
import { mutate } from "@/lib/data/store";
import { addDays, formatShortLabel, localTimeHHMM, WEEKDAY_SHORT, weekdayOf, formatDayMonth } from "@/lib/domain/dates";
import { useToast } from "@/components/ui/toast";
import type { WaterLog } from "@/lib/types";

export default function WaterPage() {
  const { today, tz, profile, updateProfile } = useSession();
  const toast = useToast();
  const [day, setDay] = useState(today);
  const [range, setRange] = useState<"semana" | "mes">("semana");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [editing, setEditing] = useState<WaterLog | null>(null);
  const [editMl, setEditMl] = useState("");
  const target = profile?.water_goal_ml ?? 2000;
  const { data: logs = [] } = useWaterLogs(addDays(today, -30), today);
  const dayLogs = logs.filter((l) => l.log_date === day);
  const total = dayLogs.reduce((s, l) => s + l.amount_ml, 0);
  const cupSize = 250;
  const cups = Math.max(1, Math.ceil(target / cupSize));
  const filled = Math.floor(total / cupSize);
  const days = range === "semana" ? 7 : 30;
  const chart = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1)).map((d) => ({ dia: range === "semana" ? WEEKDAY_SHORT[weekdayOf(d)] : formatDayMonth(d), Litros: Math.round(logs.filter((l) => l.log_date === d).reduce((s, l) => s + l.amount_ml, 0) / 100) / 10 }));
  const daysOnGoal = Array.from({ length: days }, (_, i) => addDays(today, -i)).filter((d) => logs.filter((l) => l.log_date === d).reduce((s, l) => s + l.amount_ml, 0) >= target).length;

  async function add(ml: number) {
    const before = total;
    await addWater(ml, day);
    if (before < target && before + ml >= target) {
      toast.show("Meta de água batida! 💧🎉", "success");
      await award("agua_meta", `agua:${day}`);
      void unlock("agua_meta");
    }
  }

  return (
    <>
      <PageHeader title="Hidratação" icon={<Droplets className="size-5" />} actions={<Button size="sm" variant="ghost" aria-label="Meta diária" onClick={() => { setGoal(String(target)); setGoalOpen(true); }}><SlidersHorizontal className="size-4" /></Button>} />
      <div className="flex items-center justify-between">
        <button onClick={() => setDay(addDays(day, -1))} className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary" aria-label="Dia anterior"><ChevronLeft className="size-5" /></button>
        <p className="font-bold capitalize">{day === today ? "Hoje" : formatShortLabel(day)}</p>
        <button onClick={() => setDay(addDays(day, 1))} disabled={day >= today} className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary disabled:opacity-30" aria-label="Próximo dia"><ChevronRight className="size-5" /></button>
      </div>
      <Card className="mt-3 bg-info-soft/50 p-5 text-center">
        <p className="text-4xl font-bold text-info">{total} <span className="text-lg">ml</span></p>
        <p className="text-sm text-muted">de {target} ml · {Math.min(100, Math.round((total / target) * 100))}%</p>
        <ProgressBar value={(total / target) * 100} tone="info" className="mt-3 h-3" label="Progresso da hidratação" />
        <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-8" role="group" aria-label="Copos de 250 ml">
          {Array.from({ length: cups }, (_, i) => {
            const on = i < filled;
            return (
              <button key={i} onClick={() => (on ? undefined : add(cupSize))} aria-label={on ? `Copo ${i + 1} cheio` : `Beber copo ${i + 1} (250 ml)`} className={cn("relative mx-auto h-14 w-11 overflow-hidden rounded-b-2xl rounded-t-md border-2 transition active:scale-90", on ? "border-info" : "border-info/40 hover:border-info")}>
                <span className="absolute inset-x-0 bottom-0 bg-info transition-all duration-500" style={{ height: on ? "85%" : "0%" }} />
              </button>
            );
          })}
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {[150, 250, 350, 500].map((ml) => <Button key={ml} size="sm" variant="outline" onClick={() => add(ml)}>+{ml}</Button>)}
        </div>
      </Card>

      <SectionTitle>Registros do dia</SectionTitle>
      <Card className="divide-y divide-line py-1">
        {dayLogs.length === 0 && <p className="py-3 text-sm text-muted">Nenhum registro.</p>}
        {[...dayLogs].reverse().map((l) => (
          <div key={l.id} className="flex items-center gap-3 py-2">
            <Droplets className="size-4 text-info" aria-hidden />
            <span className="flex-1 text-sm"><strong>{l.amount_ml} ml</strong> <span className="text-muted">às {localTimeHHMM(new Date(l.logged_at), tz)}</span></span>
            <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => { setEditing(l); setEditMl(String(l.amount_ml)); }}><Pencil className="size-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => mutate({ action: "delete", table: "water_logs", id: l.id })}><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </Card>

      <SectionTitle action={<div className="w-40"><Segmented label="Período" value={range} onChange={setRange} options={[{ value: "semana", label: "Semana" }, { value: "mes", label: "Mês" }]} /></div>}>Histórico</SectionTitle>
      <Card>
        <Bars data={chart} xKey="dia" series={[{ key: "Litros", label: "Litros", color: CHART_COLORS[3] }]} goal={{ value: target / 1000, label: `meta ${target / 1000} L` }} format={(v) => `${v} L`} />
        <p className="mt-2 text-center text-xs text-muted">{daysOnGoal} de {days} dias na meta</p>
      </Card>

      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title="Meta diária de água">
        <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const v = Number(goal); if (!(v >= 250 && v <= 8000)) return toast.show("Entre 250 e 8000 ml.", "error"); await updateProfile({ water_goal_ml: v }); setGoalOpen(false); }}>
          <Field label="Meta (ml)">{(id) => <Input id={id} type="number" min={250} max={8000} step={50} value={goal} onChange={(e) => setGoal(e.target.value)} />}</Field>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={!!profile?.notification_prefs?.agua} onChange={(e) => updateProfile({ notification_prefs: { ...profile!.notification_prefs, agua: e.target.checked } })} />Lembretes de água (a cada 2 h, das 8h às 20h, com o app aberto)</label>
          <Button type="submit" className="w-full">Salvar</Button>
        </form>
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar registro">
        <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const v = Number(editMl); if (!(v >= 1 && v <= 5000)) return toast.show("Entre 1 e 5000 ml.", "error"); await mutate({ action: "update", table: "water_logs", id: editing!.id, values: { amount_ml: v } }); setEditing(null); }}>
          <Field label="Quantidade (ml)">{(id) => <Input id={id} type="number" min={1} max={5000} value={editMl} onChange={(e) => setEditMl(e.target.value)} />}</Field>
          <Button type="submit" className="w-full">Salvar</Button>
        </form>
      </Sheet>
    </>
  );
}
