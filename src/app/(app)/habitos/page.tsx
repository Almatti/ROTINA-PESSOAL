"use client";
import { useMemo, useState } from "react";
import { Repeat, Plus, Flame, Trophy, Archive, ArchiveRestore } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, EmptyState, Segmented, Stat, Skeleton, cn } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { HabitForm } from "@/components/forms/habit-form";
import { HabitRow } from "@/components/plan/habit-row";
import { MonthGrid, MonthNav } from "@/components/calendar-bits";
import { Lines, CHART_COLORS } from "@/components/charts";
import { useSession } from "@/lib/session";
import { useHabits, useHabitLogs, useTable } from "@/lib/data/hooks";
import { addDays, monthStart, formatDayMonth } from "@/lib/domain/dates";
import { currentStreak, bestStreak, completionRate, isScheduledOn, isCompleted, describeFrequency } from "@/lib/domain/habits";
import { mutate } from "@/lib/data/store";
import { useToast } from "@/components/ui/toast";
import type { Habit } from "@/lib/types";

export default function HabitsPage() {
  const { today } = useSession();
  const toast = useToast();
  const { data: habits, loading } = useHabits();
  const { data: archived = [] } = useTable<Habit>("habits", { filter: { archived: true }, key: "archived" });
  const { data: logs = [] } = useHabitLogs(addDays(today, -400), today);
  const [tab, setTab] = useState<"hoje" | "calendario" | "evolucao">("hoje");
  const [month, setMonth] = useState(monthStart(today));
  const [selected, setSelected] = useState<string>("");
  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const list = (habits ?? []).filter((h) => h.kind === "construir");
  const focus = list.find((h) => h.id === selected) ?? null;

  const overview = useMemo(() => {
    const rates = list.map((h) => completionRate(h, logs, today, 30));
    const streaks = list.map((h) => currentStreak(h, logs, today));
    return {
      avgRate: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0,
      bestNow: Math.max(0, ...streaks),
      record: Math.max(0, ...list.map((h) => bestStreak(h, logs, today))),
    };
  }, [list, logs, today]);

  const series = useMemo(() => {
    // consistência semanal (% de hábitos agendados concluídos) nas últimas 8 semanas
    return Array.from({ length: 8 }, (_, i) => {
      const end = addDays(today, -7 * (7 - i));
      let sched = 0, done = 0;
      for (let d = 0; d < 7; d++) {
        const day = addDays(end, -d);
        for (const h of focus ? [focus] : list) {
          if (!isScheduledOn(h, day)) continue;
          sched++;
          if (isCompleted(h, logs.find((l) => l.habit_id === h.id && l.log_date === day))) done++;
        }
      }
      return { semana: formatDayMonth(addDays(end, -6)), consistencia: sched ? Math.round((done / sched) * 100) : 0 };
    });
  }, [list, logs, today, focus]);

  return (
    <>
      <PageHeader title="Hábitos" icon={<Repeat className="size-5" />} actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Novo</Button>} />
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Consistência" value={`${overview.avgRate}%`} sub="últimos 30 dias" icon="📊" />
        <Stat label="Maior sequência" value={`${overview.bestNow} d`} sub="atual" icon={<Flame className="size-5 text-warning" />} />
        <Stat label="Recorde" value={`${overview.record} d`} icon={<Trophy className="size-5 text-warning" />} />
      </section>
      <div className="mt-4"><Segmented label="Seções" value={tab} onChange={setTab} options={[{ value: "hoje", label: "Hoje" }, { value: "calendario", label: "Calendário" }, { value: "evolucao", label: "Evolução" }]} /></div>

      {loading && !habits ? <Skeleton className="mt-4 h-40" /> : list.length === 0 ? (
        <div className="mt-4"><EmptyState icon="🌱" title="Comece com um hábito pequeno" description="Escolha algo simples que você consegue fazer até nos dias difíceis." action={<Button onClick={() => setCreating(true)}>Criar hábito</Button>} /></div>
      ) : tab === "hoje" ? (
        <div className="mt-4 space-y-2.5">
          {list.map((h) => (
            <div key={h.id}>
              <HabitRow habit={h} log={logs.find((l) => l.habit_id === h.id && l.log_date === today)} date={today} streak={currentStreak(h, logs, today)} onEdit={() => setEditing(h)} />
              <p className="mt-1 px-3 text-xs text-muted">{describeFrequency(h.frequency)} · {completionRate(h, logs, today, 30)}% em 30 dias · recorde {bestStreak(h, logs, today)} dias{!isScheduledOn(h, today) && " · não agendado hoje"}</p>
            </div>
          ))}
        </div>
      ) : tab === "calendario" ? (
        <div className="mt-4 space-y-3">
          <div className="scroll-x -mx-4 flex gap-2 px-4">
            <button onClick={() => setSelected("")} className={cn("shrink-0 rounded-pill px-3 py-1.5 text-sm", !selected ? "bg-orchid text-white dark:bg-primary dark:text-primary-ink" : "bg-surface")}>Todos</button>
            {list.map((h) => <button key={h.id} onClick={() => setSelected(h.id)} className={cn("shrink-0 rounded-pill px-3 py-1.5 text-sm", selected === h.id ? "text-white" : "bg-surface")} style={selected === h.id ? { background: h.color } : undefined}>{h.emoji} {h.name}</button>)}
          </div>
          <MonthNav month={month} onChange={setMonth} />
          <Card>
            <MonthGrid month={month} today={today} renderDay={(d) => {
              const hs = focus ? [focus] : list;
              const sched = hs.filter((h) => isScheduledOn(h, d));
              const done = sched.filter((h) => isCompleted(h, logs.find((l) => l.habit_id === h.id && l.log_date === d))).length;
              const pct = sched.length ? done / sched.length : 0;
              return (
                <>
                  <span className="text-xs font-semibold">{Number(d.slice(8))}</span>
                  <span className="mt-0.5 size-5 rounded-full" style={{ background: d > today || !sched.length ? "var(--surface-3)" : `color-mix(in oklab, ${focus?.color ?? "var(--success)"} ${Math.round(15 + pct * 85)}%, transparent)` }} aria-label={sched.length ? `${done} de ${sched.length}` : "sem hábitos"} />
                </>
              );
            }} />
            <p className="mt-2 text-center text-xs text-muted">Quanto mais forte a cor, mais hábitos concluídos no dia.</p>
          </Card>
        </div>
      ) : (
        <Card className="mt-4">
          <h2 className="font-bold">Consistência semanal {focus ? `· ${focus.name}` : ""}</h2>
          <p className="mb-2 text-xs text-muted">% dos hábitos agendados que foram concluídos</p>
          <Lines data={series} xKey="semana" series={[{ key: "consistencia", label: "Consistência (%)", color: CHART_COLORS[0] }]} format={(v) => `${v}%`} />
          <div className="scroll-x -mx-1 mt-3 flex gap-2 px-1">
            <button onClick={() => setSelected("")} className={cn("shrink-0 rounded-pill px-3 py-1.5 text-xs", !selected ? "bg-primary text-primary-ink" : "bg-surface-2")}>Todos</button>
            {list.map((h) => <button key={h.id} onClick={() => setSelected(h.id)} className={cn("shrink-0 rounded-pill px-3 py-1.5 text-xs", selected === h.id ? "bg-primary text-primary-ink" : "bg-surface-2")}>{h.emoji} {h.name}</button>)}
          </div>
        </Card>
      )}

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold text-muted"><Archive className="mr-1 inline size-4" aria-hidden />Arquivados ({archived.length})</summary>
          <ul className="mt-2 space-y-2">
            {archived.map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                <span>{h.emoji}</span><span className="flex-1">{h.name}</span>
                <Button size="sm" variant="soft" icon={<ArchiveRestore className="size-4" />} onClick={() => mutate({ action: "update", table: "habits", id: h.id, values: { archived: false } })}>Reativar</Button>
                <Button size="sm" variant="ghost" className="text-error" onClick={() => setDeleting(h)}>Excluir</Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="Novo hábito">{creating && <HabitForm onDone={() => setCreating(false)} />}</Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar hábito">{editing && <HabitForm habit={editing} onDone={() => setEditing(null)} />}</Sheet>
      <ConfirmDialog open={!!deleting} danger title="Excluir hábito?" message="O hábito e todo o histórico de registros serão apagados definitivamente." confirmLabel="Excluir" onCancel={() => setDeleting(null)} onConfirm={async () => { await mutate({ action: "delete", table: "habits", id: deleting!.id }); setDeleting(null); toast.show("Hábito excluído.", "success"); }} />
    </>
  );
}
