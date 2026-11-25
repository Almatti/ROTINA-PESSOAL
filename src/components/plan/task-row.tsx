"use client";
import { useState } from "react";
import { Check, ChevronDown, Star, Calendar, Clock, MoreVertical, Play, Repeat } from "lucide-react";
import Link from "next/link";
import { cn, Badge } from "@/components/ui/primitives";
import { setTaskDone, toggleSubtask } from "@/lib/data/actions";
import { mutate } from "@/lib/data/store";
import { effectiveStatus, PRIORITY_LABEL } from "@/lib/domain/tasks";
import { formatDayMonth } from "@/lib/domain/dates";
import type { Task } from "@/lib/types";

export function TaskRow({ task, today, onEdit, compact }: { task: Task; today: string; onEdit?: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const st = effectiveStatus(task, today);
  const done = task.status === "concluida";
  const subs = [...(task.subtasks ?? [])].sort((a, b) => a.position - b.position);
  return (
    <article className={cn("rounded-card border p-3.5 transition", done ? "border-success/30 bg-success-soft/60" : st === "atrasada" ? "border-error/30 bg-surface" : "border-line bg-surface", task.status === "cancelada" && "opacity-60")}>
      <div className="flex items-start gap-3">
        <button onClick={() => setTaskDone(task, !done, today)} aria-pressed={done} aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`} className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 transition active:scale-90", done ? "border-success bg-success text-white" : "border-iris")}>
          {done && <Check className="size-4" strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          {!compact && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="warning">Tarefa</Badge>
              {st === "atrasada" && <Badge tone="error">Atrasada</Badge>}
              {st === "em_andamento" && <Badge tone="info">Em andamento</Badge>}
              {(task.priority === "alta" || task.priority === "urgente") && <Badge tone={task.priority === "urgente" ? "error" : "warning"}>{PRIORITY_LABEL[task.priority]}</Badge>}
              {task.recurrence && <Repeat className="size-3.5 text-muted" aria-label="Recorrente" />}
            </div>
          )}
          <p className={cn("mt-0.5 break-words font-semibold", done && "text-muted line-through")}>{task.title}</p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted">
            {task.due_date && <span className="inline-flex items-center gap-1 rounded-pill bg-primary-soft px-2 py-0.5 text-primary-soft-ink"><Calendar className="size-3" aria-hidden />{task.due_date === today ? "Hoje" : formatDayMonth(task.due_date)}</span>}
            {task.due_time && <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden />{task.due_time.slice(0, 5)}</span>}
            {task.tags.map((t) => <span key={t} className="rounded-pill bg-warning-soft px-2 py-0.5 text-warning">{t}</span>)}
          </div>
          {subs.length > 0 && (
            <>
              <button onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 inline-flex items-center gap-1 rounded-pill bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-soft-ink">
                {subs.filter((s) => s.done).length}/{subs.length} subtarefas <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} aria-hidden />
              </button>
              {open && (
                <ul className="mt-2 space-y-1">
                  {subs.map((s) => (
                    <li key={s.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.done} onChange={() => toggleSubtask(s.id, !s.done)} className="size-4 accent-[var(--primary)]" /><span className={cn(s.done && "text-muted line-through")}>{s.title}</span></label></li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <Link href={`/foco?tarefa=${task.id}`} aria-label={`Focar em ${task.title}`} className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary"><Play className="size-3.5" /></Link>
          <button onClick={() => mutate({ action: "update", table: "tasks", id: task.id, values: { is_starred: !task.is_starred } })} aria-pressed={task.is_starred} aria-label={task.is_starred ? "Remover destaque" : "Destacar"} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2">
            <Star className={cn("size-4", task.is_starred && "fill-warning text-warning")} />
          </button>
          {onEdit && <button onClick={onEdit} aria-label={`Editar ${task.title}`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2"><MoreVertical className="size-4" /></button>}
        </div>
      </div>
    </article>
  );
}
