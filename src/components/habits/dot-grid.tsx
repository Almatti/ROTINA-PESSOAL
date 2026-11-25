"use client";
import { cn } from "@/components/ui/primitives";
import { addDays, formatDateBR } from "@/lib/domain/dates";
import { isCompleted, isScheduledOn, completionRate } from "@/lib/domain/habits";
import { logHabit } from "@/lib/data/actions";
import type { Habit, HabitLog } from "@/lib/types";

/** Grade de 30 bolinhas (como na referência): cada bolinha preenchida é um dia concluído. Toque para marcar. */
export function HabitDotCard({ habit, logs, today, days = 30 }: { habit: Habit; logs: HabitLog[]; today: string; days?: number }) {
  const list = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  const rate = completionRate(habit, logs, today, days);
  return (
    <article className="rounded-card border p-3" style={{ borderColor: `${habit.color}55`, background: `color-mix(in oklab, ${habit.color} 9%, var(--surface))` }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-surface text-sm" aria-hidden>{habit.emoji}</span>
        <h3 className="flex-1 truncate text-sm font-semibold">{habit.name}</h3>
        <span className="rounded-pill px-2 py-0.5 text-xs font-bold text-white" style={{ background: habit.color }}>{rate}%</span>
      </div>
      <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5" role="group" aria-label={`Últimos ${days} dias de ${habit.name}`}>
        {list.map((d) => {
          const log = logs.find((l) => l.habit_id === habit.id && l.log_date === d);
          const done = isCompleted(habit, log);
          const sched = isScheduledOn(habit, d);
          return (
            <button
              key={d}
              onClick={() => logHabit(habit, d, habit.checklist.length ? { checklist_done: done ? [] : habit.checklist.map((c) => c.id) } : { value: done ? 0 : Number(habit.target_value) }, log)}
              aria-pressed={done}
              aria-label={`${formatDateBR(d)}: ${done ? "concluído" : sched ? "não concluído" : "não agendado"}`}
              disabled={d < habit.started_on}
              className={cn("aspect-square rounded-full transition hover:scale-110 disabled:opacity-20", d === today && "ring-2 ring-offset-1 ring-offset-transparent")}
              style={{ background: done ? habit.color : `${habit.color}${sched ? "33" : "14"}`, ["--tw-ring-color" as string]: habit.color }}
            />
          );
        })}
      </div>
    </article>
  );
}
