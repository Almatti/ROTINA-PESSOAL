import { addDays, diffDays, type ISODate } from "./dates";

export type TaskStatus = "pendente" | "em_andamento" | "concluida" | "cancelada";
export type EffectiveStatus = TaskStatus | "atrasada";
export type Priority = "baixa" | "media" | "alta" | "urgente";

export interface TaskLike {
  id: string;
  status: TaskStatus;
  due_date: ISODate | null;
  due_time?: string | null;
  deadline?: ISODate | null;
  priority: Priority;
  completed_at?: string | null;
  estimated_minutes?: number | null;
  created_at?: string;
}

export const PRIORITY_WEIGHT: Record<Priority, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
export const PRIORITY_LABEL: Record<Priority, string> = { urgente: "Urgente", alta: "Alta", media: "Média", baixa: "Baixa" };
export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

/** "Atrasada" é derivada: aberta com prazo (deadline ou data) anterior a hoje. */
export function effectiveStatus(t: TaskLike, today: ISODate): EffectiveStatus {
  if (t.status === "concluida" || t.status === "cancelada") return t.status;
  const limit = t.deadline ?? t.due_date;
  if (limit && limit < today) return "atrasada";
  return t.status;
}

/** Ordenação padrão: atrasadas, depois por data/hora, prioridade e criação. */
export function sortTasks<T extends TaskLike>(tasks: T[], today: ISODate): T[] {
  return [...tasks].sort((a, b) => {
    const oa = effectiveStatus(a, today) === "atrasada" ? 0 : 1;
    const ob = effectiveStatus(b, today) === "atrasada" ? 0 : 1;
    if (oa !== ob) return oa - ob;
    const da = (a.due_date ?? "9999-12-31") + (a.due_time ?? "99:99");
    const db = (b.due_date ?? "9999-12-31") + (b.due_time ?? "99:99");
    if (da !== db) return da.localeCompare(db);
    const p = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (p) return p;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

export interface ProductivityStats {
  completedToday: number;
  completedWeek: number;
  open: number;
  overdue: number;
  completionRateWeek: number; // % concluídas das que venciam nos últimos 7 dias
  plannedMinutesToday: number;
}

export function productivityStats(tasks: TaskLike[], today: ISODate, tzDate: (iso: string) => ISODate): ProductivityStats {
  const weekAgo = addDays(today, -6);
  let completedToday = 0, completedWeek = 0, open = 0, overdue = 0, dueWeek = 0, dueWeekDone = 0, planned = 0;
  for (const t of tasks) {
    const st = effectiveStatus(t, today);
    if (t.completed_at) {
      const d = tzDate(t.completed_at);
      if (d === today) completedToday++;
      if (d >= weekAgo && d <= today) completedWeek++;
    }
    if (st === "pendente" || st === "em_andamento" || st === "atrasada") open++;
    if (st === "atrasada") overdue++;
    if (t.due_date && t.due_date >= weekAgo && t.due_date <= today && t.status !== "cancelada") {
      dueWeek++;
      if (t.status === "concluida") dueWeekDone++;
    }
    if (t.due_date === today && t.status !== "concluida" && t.status !== "cancelada") planned += t.estimated_minutes ?? 0;
  }
  return {
    completedToday,
    completedWeek,
    open,
    overdue,
    completionRateWeek: dueWeek ? Math.round((dueWeekDone / dueWeek) * 100) : 0,
    plannedMinutesToday: planned,
  };
}

/** Sugere nova data para tarefas atrasadas: hoje para urgentes/altas, demais distribuídas nos próximos dias. */
export function suggestReschedule<T extends TaskLike>(overdue: T[], today: ISODate, perDay = 3): { id: string; from: ISODate | null; to: ISODate }[] {
  const sorted = [...overdue].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
  return sorted.map((t, i) => ({
    id: t.id,
    from: t.due_date,
    to: PRIORITY_WEIGHT[t.priority] >= 3 && i < perDay ? today : addDays(today, 1 + Math.floor(i / perDay)),
  }));
}

export function daysUntil(due: ISODate, today: ISODate) {
  return diffDays(due, today);
}
