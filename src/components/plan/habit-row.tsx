"use client";
import { useState } from "react";
import { Check, ChevronDown, Flame, Minus, Plus, Clock, MoreVertical, Play } from "lucide-react";
import Link from "next/link";
import { cn, Badge } from "@/components/ui/primitives";
import { logHabit } from "@/lib/data/actions";
import { useToast } from "@/components/ui/toast";
import { isCompleted } from "@/lib/domain/habits";
import type { Habit, HabitLog } from "@/lib/types";

/** Linha de hábito no plano: check, sequência, contador inline (ex.: água) e checklist expansível. */
export function HabitRow({ habit, log, date, streak, onEdit }: { habit: Habit; log?: HabitLog; date: string; streak: number; onEdit?: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const done = isCompleted(habit, log);
  const value = Number(log?.value ?? 0);
  const target = Number(habit.target_value);
  const step = Number(habit.step_value) || 1;
  const quantitative = target > 1 && habit.checklist.length === 0;
  const checklistDone = log?.checklist_done ?? [];

  async function setValue(v: number) {
    const ok = await logHabit(habit, date, { value: Math.max(0, v) }, log);
    if (ok && !done) toast.show(`${habit.emoji} ${habit.name}: meta batida! 🎉`, "success");
  }

  async function toggleMain() {
    if (habit.checklist.length) {
      const all = done ? [] : habit.checklist.map((c) => c.id);
      await logHabit(habit, date, { checklist_done: all }, log);
    } else await setValue(done ? 0 : target);
  }

  return (
    <article className={cn("rounded-card border p-3.5 transition", done ? "border-success/30 bg-success-soft/60" : "border-line bg-surface")}>
      <div className="flex items-start gap-3">
        <button onClick={toggleMain} aria-pressed={done} aria-label={done ? `Desmarcar ${habit.name}` : `Concluir ${habit.name}`} className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 transition active:scale-90", done ? "border-success bg-success text-white" : "border-iris")}>
          {done && <Check className="size-4" strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="primary">Hábito</Badge>
            <span className="inline-flex items-center gap-0.5 text-xs text-muted"><Flame className={cn("size-3.5", streak > 0 ? "text-warning" : "text-muted")} aria-hidden />{streak} {streak === 1 ? "dia" : "dias"}</span>
            {habit.time_of_day && <span className="inline-flex items-center gap-0.5 rounded-pill bg-surface-2 px-1.5 text-xs text-muted"><Clock className="size-3" aria-hidden />{habit.time_of_day.slice(0, 5)}</span>}
          </div>
          <p className="mt-0.5 font-semibold"><span aria-hidden>{habit.emoji}</span> {habit.name}</p>
          {quantitative && (
            <div className="mt-2 rounded-2xl bg-info-soft/70 p-2.5">
              <p className="text-sm"><strong className="text-info">{value} {habit.unit}</strong> <span className="text-muted">de {target} {habit.unit}</span></p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-6 flex-1 overflow-hidden rounded-pill bg-surface" role="progressbar" aria-valuenow={Math.min(100, Math.round((value / target) * 100))} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${habit.name}`}>
                  <div className="grid h-full place-items-center rounded-pill bg-info text-[0.65rem] font-bold uppercase tracking-wide text-white transition-all" style={{ width: `${Math.min(100, (value / target) * 100)}%` }}>{value >= target && "Meta batida 🎉"}</div>
                </div>
                <button onClick={() => setValue(value - step)} aria-label={`Diminuir ${step} ${habit.unit}`} className="grid size-8 place-items-center rounded-full bg-surface text-info"><Minus className="size-4" /></button>
                <button onClick={() => setValue(value + step)} aria-label={`Adicionar ${step} ${habit.unit}`} className="grid size-8 place-items-center rounded-full bg-info text-white"><Plus className="size-4" /></button>
              </div>
            </div>
          )}
          {habit.checklist.length > 0 && (
            <>
              <button onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 inline-flex items-center gap-1 rounded-pill bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-soft-ink">
                {checklistDone.length}/{habit.checklist.length} detalhes <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} aria-hidden />
              </button>
              {open && (
                <ul className="mt-2 space-y-1">
                  {habit.checklist.map((c) => {
                    const on = checklistDone.includes(c.id);
                    return (
                      <li key={c.id}>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={on} className="size-4 accent-[var(--primary)]" onChange={() => logHabit(habit, date, { checklist_done: on ? checklistDone.filter((x) => x !== c.id) : [...checklistDone, c.id] }, log)} />
                          <span className={cn(on && "text-muted line-through")}>{c.label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <Link href="/foco" aria-label={`Iniciar foco: ${habit.name}`} className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary"><Play className="size-3.5" /></Link>
          {onEdit && <button onClick={onEdit} aria-label={`Opções de ${habit.name}`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2"><MoreVertical className="size-4" /></button>}
        </div>
      </div>
    </article>
  );
}
