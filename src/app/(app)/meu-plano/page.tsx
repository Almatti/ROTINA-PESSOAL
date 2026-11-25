"use client";
import { useMemo, useState } from "react";
import { CalendarCheck, SlidersHorizontal, Sun, Sunset, Moon, Sparkles, CalendarDays } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { WeekStrip } from "@/components/calendar-bits";
import { DayProgress } from "@/components/dashboard/widgets";
import { HabitRow } from "@/components/plan/habit-row";
import { TaskRow } from "@/components/plan/task-row";
import { Chip, EmptyState, Skeleton, Badge, Button } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { TaskForm } from "@/components/forms/task-form";
import { HabitForm } from "@/components/forms/habit-form";
import { useSession } from "@/lib/session";
import { useQuickAdd } from "@/components/layout/quick-add";
import { useTodayTasks, useHabits, useHabitLogs, useEvents } from "@/lib/data/hooks";
import { eventsOnDay } from "@/lib/calendar";
import { addDays, periodOfTime, localTimeHHMM, zonedToUtc, formatShortLabel } from "@/lib/domain/dates";
import { isScheduledOn, isCompleted, currentStreak } from "@/lib/domain/habits";
import { mutate } from "@/lib/data/store";
import type { Task, Habit } from "@/lib/types";

type Filter = "todos" | "pendentes" | "concluidos";
const PERIODS = [
  { key: "manha", label: "Manhã", icon: Sun },
  { key: "tarde", label: "Tarde", icon: Sunset },
  { key: "noite", label: "Noite", icon: Moon },
  { key: "sem_horario", label: "Sem horário", icon: Sparkles },
] as const;

export default function PlanPage() {
  const { today, tz } = useSession();
  const qa = useQuickAdd();
  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState<Filter>("todos");
  const [show, setShow] = useState({ tarefas: true, habitos: true, compromissos: true });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [archive, setArchive] = useState<Habit | null>(null);

  const { data: tasks, loading } = useTodayTasks(day);
  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(addDays(day, -400), day);
  const { data: events = [] } = useEvents(zonedToUtc(day, "00:00", tz).toISOString(), zonedToUtc(addDays(day, 1), "00:00", tz).toISOString());

  const items = useMemo(() => {
    const out: { kind: "task" | "habit" | "event"; period: string; sort: string; done: boolean; node: React.ReactNode; key: string }[] = [];
    if (show.tarefas) for (const t of tasks ?? []) {
      if (t.status === "cancelada") continue;
      if (t.due_date !== day && !(day === today && (t.due_date === null || t.due_date < day))) continue;
      out.push({ kind: "task", key: `t${t.id}`, period: periodOfTime(t.due_time), sort: t.due_time ?? "99", done: t.status === "concluida", node: <TaskRow task={t} today={today} onEdit={() => setEditTask(t)} /> });
    }
    if (show.habitos) for (const h of habits) {
      if (h.kind !== "construir" || !isScheduledOn(h, day)) continue;
      const log = logs.find((l) => l.habit_id === h.id && l.log_date === day);
      const period = h.time_of_day ? periodOfTime(h.time_of_day) : h.period === "qualquer" ? "sem_horario" : h.period;
      out.push({ kind: "habit", key: `h${h.id}`, period, sort: h.time_of_day ?? "98", done: isCompleted(h, log), node: <HabitRow habit={h} log={log} date={day} streak={currentStreak(h, logs, day)} onEdit={() => setEditHabit(h)} /> });
    }
    if (show.compromissos) for (const e of eventsOnDay(events, day, tz)) {
      const time = e.all_day ? null : localTimeHHMM(new Date(e.occStart), tz);
      out.push({
        kind: "event", key: `e${e.id}${e.occStart}`, period: periodOfTime(time), sort: time ?? "97", done: new Date(e.occEnd).getTime() < Date.now(),
        node: (
          <Link href={`/agenda?dia=${day}`} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5" style={{ borderLeft: `4px solid ${e.color ?? "var(--info)"}` }}>
            <CalendarDays className="size-5 shrink-0 text-info" aria-hidden />
            <div className="min-w-0 flex-1"><Badge tone="info">Compromisso</Badge><p className="mt-0.5 truncate font-semibold">{e.title}</p></div>
            <span className="text-sm tabular-nums text-muted">{e.all_day ? "Dia inteiro" : `${time} – ${localTimeHHMM(new Date(e.occEnd), tz)}`}</span>
          </Link>
        ),
      });
    }
    return out
      .filter((i) => (filter === "pendentes" ? !i.done : filter === "concluidos" ? i.done : true))
      .sort((a, b) => a.sort.localeCompare(b.sort));
  }, [tasks, habits, logs, events, day, today, tz, filter, show]);

  return (
    <>
      <PageHeader title="Meu plano" icon={<CalendarCheck className="size-5" />} subtitle={formatShortLabel(day)} actions={<Button size="sm" onClick={() => qa.open(undefined, { date: day })}>+ Nova</Button>} />
      <section className="card space-y-4 p-4">
        <WeekStrip selected={day} onSelect={setDay} today={today} />
        <DayProgress day={day} />
      </section>
      <div className="scroll-x -mx-4 mt-4 flex gap-2 px-4">
        <Chip active={day === today && filter === "todos"} onClick={() => { setDay(today); setFilter("todos"); }}>☀️ Hoje</Chip>
        <Chip active={filter === "pendentes"} onClick={() => setFilter(filter === "pendentes" ? "todos" : "pendentes")}>○ Pendentes</Chip>
        <Chip active={filter === "concluidos"} onClick={() => setFilter(filter === "concluidos" ? "todos" : "concluidos")}>✓ Concluídos</Chip>
        <Chip onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="size-4" aria-hidden />Filtros</Chip>
      </div>

      {loading && !tasks ? (
        <div className="mt-6 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : items.length === 0 ? (
        <div className="mt-6"><EmptyState icon="🌤️" title={filter === "concluidos" ? "Nada concluído ainda" : "Dia livre por aqui"} description="Adicione tarefas, hábitos ou compromissos para montar seu plano." action={<Button onClick={() => qa.open(undefined, { date: day })}>Nova ação</Button>} /></div>
      ) : (
        PERIODS.map((p) => {
          const list = items.filter((i) => i.period === p.key);
          if (!list.length) return null;
          return (
            <section key={p.key} className="mt-6" aria-label={p.label}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><p.icon className="size-4 text-warning" aria-hidden />{p.label}<span className="font-normal text-muted">{list.filter((i) => i.done).length}/{list.length}</span></h2>
              <div className="space-y-2.5">{list.map((i) => <div key={i.key}>{i.node}</div>)}</div>
            </section>
          );
        })
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
        <div className="space-y-2">
          {(["tarefas", "habitos", "compromissos"] as const).map((k) => (
            <label key={k} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 text-sm font-semibold capitalize">
              <input type="checkbox" checked={show[k]} onChange={(e) => setShow((s) => ({ ...s, [k]: e.target.checked }))} className="size-5 accent-[var(--primary)]" />
              {k === "habitos" ? "Hábitos" : k}
            </label>
          ))}
        </div>
      </Sheet>
      <Sheet open={!!editTask} onClose={() => setEditTask(null)} title="Editar tarefa">{editTask && <TaskForm task={editTask} onDone={() => setEditTask(null)} />}</Sheet>
      <Sheet open={!!editHabit} onClose={() => setEditHabit(null)} title="Editar hábito" footer={editHabit && <Button variant="ghost" className="w-full text-error" onClick={() => { setArchive(editHabit); setEditHabit(null); }}>Arquivar hábito</Button>}>
        {editHabit && <HabitForm habit={editHabit} onDone={() => setEditHabit(null)} />}
      </Sheet>
      <ConfirmDialog open={!!archive} title="Arquivar hábito?" message="O histórico é mantido e você pode reativá-lo em Hábitos › Arquivados." confirmLabel="Arquivar" onCancel={() => setArchive(null)} onConfirm={async () => { await mutate({ action: "update", table: "habits", id: archive!.id, values: { archived: true } }); setArchive(null); }} />
    </>
  );
}
