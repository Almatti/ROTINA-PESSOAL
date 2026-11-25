"use client";
import Link from "next/link";
import { Plus, CalendarDays, CheckSquare, Wallet, Moon, Heart, Leaf, Droplets, Target, Timer, Trophy, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Card, ProgressBar, Ring, SeeMore, cn } from "@/components/ui/primitives";
import { useSession } from "@/lib/session";
import { useQuickAdd } from "@/components/layout/quick-add";
import { useEvents, useTodayTasks, useHabits, useHabitLogs, useTransactions, useAccounts, useSleepLogs, useMoodLogs, useWaterLogs, useGoals, usePoints } from "@/lib/data/hooks";
import { setTaskDone, addWater } from "@/lib/data/actions";
import { addDays, localTimeHHMM, zonedToUtc, minutesToLabel, monthStart, WEEKDAY_SHORT, weekdayOf } from "@/lib/domain/dates";
import { monthSummary, totalBalance } from "@/lib/domain/finance";
import { formatCents } from "@/lib/domain/money";
import { isScheduledOn, isCompleted } from "@/lib/domain/habits";
import { levelFromPoints } from "@/lib/domain/gamification";
import { MOODS } from "@/components/modules/mood-meta";
import { useFocus } from "@/components/focus/focus-provider";
import { formatClock } from "@/lib/domain/pomodoro";
import { eventsOnDay } from "@/lib/calendar";

function WidgetHead({ icon, title, tone, action }: { icon: React.ReactNode; title: string; tone: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className={cn("grid size-8 place-items-center rounded-xl", tone)} aria-hidden>{icon}</span>
      <h2 className="flex-1 text-sm font-bold">{title}</h2>
      {action}
    </div>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }} aria-label={label} className="grid size-7 place-items-center rounded-full bg-primary-soft text-primary hover:brightness-95">
      <Plus className="size-4" />
    </button>
  );
}

export function AgendaWidget({ day }: { day: string }) {
  const { tz } = useSession();
  const qa = useQuickAdd();
  const { data: events = [] } = useEvents(zonedToUtc(day, "00:00", tz).toISOString(), zonedToUtc(addDays(day, 1), "00:00", tz).toISOString());
  const list = eventsOnDay(events, day, tz);
  return (
    <Link href={`/agenda?dia=${day}`} className="card card-hover block p-4">
      <WidgetHead icon={<CalendarDays className="size-4" />} title="Minha agenda" tone="bg-primary-soft text-primary" action={<AddBtn label="Novo compromisso" onClick={() => qa.open("compromisso", { date: day })} />} />
      {list.length ? (
        <ul className="space-y-1.5">
          {list.slice(0, 4).map((e) => (
            <li key={e.id + e.occStart} className="flex items-center gap-2 text-sm">
              <span className="size-2 shrink-0 rounded-full" style={{ background: e.color ?? "var(--primary)" }} aria-hidden />
              <span className="w-11 shrink-0 tabular-nums text-muted">{e.all_day ? "Dia" : localTimeHHMM(new Date(e.occStart), tz)}</span>
              <span className="truncate">{e.title}</span>
            </li>
          ))}
          {list.length > 4 && <li className="text-xs text-muted">+{list.length - 4} compromisso(s)</li>}
        </ul>
      ) : <p className="text-sm text-muted">Nenhum compromisso neste dia.</p>}
      <SeeMore>Ver agenda completa</SeeMore>
    </Link>
  );
}

export function TasksWidget({ day }: { day: string }) {
  const { today } = useSession();
  const qa = useQuickAdd();
  const { data: tasks = [] } = useTodayTasks(day);
  const list = tasks.filter((t) => t.status !== "cancelada").slice(0, 5);
  return (
    <Link href="/tarefas" className="card card-hover block p-4">
      <WidgetHead icon={<CheckSquare className="size-4" />} title="Minhas tarefas" tone="bg-warning-soft text-warning" action={<AddBtn label="Nova tarefa" onClick={() => qa.open("tarefa", { date: day })} />} />
      {list.length ? (
        <ul className="space-y-1">
          {list.map((t) => {
            const done = t.status === "concluida";
            return (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); void setTaskDone(t, !done, today); }}
                  aria-label={done ? `Reabrir ${t.title}` : `Concluir ${t.title}`}
                  className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2 transition", done ? "border-success bg-success text-white" : "border-iris hover:border-primary")}
                >
                  {done && <svg viewBox="0 0 12 12" className="size-3" aria-hidden><path d="M2.5 6.5l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>}
                </button>
                <span className={cn("truncate", done && "text-muted line-through", t.due_date && t.due_date < today && !done && "text-error")}>{t.title}</span>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-sm text-muted">Tudo em dia por aqui ✨</p>}
      <SeeMore>Ver todas as tarefas</SeeMore>
    </Link>
  );
}

export function FinanceWidget() {
  const { today } = useSession();
  const { data: txs = [] } = useTransactions();
  const { data: accounts = [] } = useAccounts();
  if (!accounts.length) {
    return (
      <Link href="/financas" className="card card-hover block p-4">
        <WidgetHead icon={<Wallet className="size-4" />} title="Finanças" tone="bg-warning-soft text-warning" />
        <p className="text-sm text-muted">Cadastre sua primeira conta para ver seu saldo real.</p>
        <SeeMore>Começar</SeeMore>
      </Link>
    );
  }
  const s = monthSummary(txs, monthStart(today));
  const balance = totalBalance(accounts, txs);
  return (
    <Link href="/financas" className="card card-hover block p-4">
      <WidgetHead icon={<Wallet className="size-4" />} title="Finanças" tone="bg-warning-soft text-warning" />
      <p className="text-xs text-muted">Saldo disponível</p>
      <p className={cn("text-xl font-bold tabular-nums", balance < 0 && "text-error")}>{formatCents(balance)}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div><p className="flex items-center gap-1 text-muted"><ArrowUp className="size-3 text-success" aria-hidden />Entradas</p><p className="font-semibold text-success tabular-nums">{formatCents(s.income)}</p></div>
        <div><p className="flex items-center gap-1 text-muted"><ArrowDown className="size-3 text-error" aria-hidden />Saídas</p><p className="font-semibold tabular-nums">{formatCents(s.expense)}</p></div>
      </div>
      <SeeMore>Ver detalhes</SeeMore>
    </Link>
  );
}

export function SleepWidget() {
  const { today, profile } = useSession();
  const { data: logs = [] } = useSleepLogs(14);
  const goal = profile?.sleep_goal_minutes ?? 480;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const map = new Map(logs.map((l) => [l.sleep_date, l.duration_minutes]));
  const last = logs[0];
  const max = Math.max(goal, ...days.map((d) => map.get(d) ?? 0));
  return (
    <Link href="/sono" className="card card-hover block p-4">
      <WidgetHead icon={<Moon className="size-4" />} title="Sono" tone="bg-primary-soft text-primary" />
      <p className="text-xs text-muted">Última noite</p>
      <p className="text-xl font-bold">{last ? minutesToLabel(last.duration_minutes) : "—"}</p>
      <div className="mt-2 flex h-14 items-end gap-1.5" role="img" aria-label="Sono dos últimos 7 dias">
        {days.map((d) => {
          const v = map.get(d) ?? 0;
          return (
            <div key={d} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t-md rounded-b-sm bg-iris/80" style={{ height: `${Math.max(4, (v / max) * 44)}px`, opacity: v ? 1 : 0.25 }} title={`${d}: ${v ? minutesToLabel(v) : "sem registro"}`} />
              <span className="text-[0.6rem] text-muted">{WEEKDAY_SHORT[weekdayOf(d)].slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
      <SeeMore />
    </Link>
  );
}

export function MoodWidget() {
  const { today } = useSession();
  const qa = useQuickAdd();
  const { data: logs = [] } = useMoodLogs(addDays(today, -6), today);
  const todayLog = logs.find((l) => l.log_date === today);
  return (
    <Link href="/humor" className="card card-hover block p-4">
      <WidgetHead icon={<Heart className="size-4" />} title="Bem-estar" tone="bg-error-soft text-error" action={<AddBtn label="Registrar humor" onClick={() => qa.open("humor")} />} />
      <p className="text-xs text-muted">Humor de hoje</p>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-4xl" aria-label={todayLog ? MOODS[todayLog.mood - 1].label : "Sem registro"}>{todayLog?.emoji ?? "🫥"}</span>
        <div className="flex flex-1 items-end gap-1" aria-hidden>
          {Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => {
            const l = logs.find((x) => x.log_date === d);
            return <span key={d} className="flex-1 rounded-md bg-plum dark:bg-primary/60" style={{ height: `${l ? 6 + l.mood * 5 : 4}px`, opacity: l ? 1 : 0.3 }} />;
          })}
        </div>
      </div>
      <SeeMore>Ver histórico</SeeMore>
    </Link>
  );
}

export function HabitsWidget({ day }: { day: string }) {
  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(day, day);
  const scheduled = habits.filter((h) => h.kind === "construir" && isScheduledOn(h, day));
  const done = scheduled.filter((h) => isCompleted(h, logs.find((l) => l.habit_id === h.id))).length;
  const pct = scheduled.length ? (done / scheduled.length) * 100 : 0;
  return (
    <Link href="/habitos" className="card card-hover block p-4">
      <WidgetHead icon={<Leaf className="size-4" />} title="Meus hábitos" tone="bg-success-soft text-success" />
      {scheduled.length ? (
        <div className="flex items-center gap-3">
          <Ring value={pct} size={64} stroke={8} color="var(--success)" label={`${done} de ${scheduled.length} hábitos concluídos`} />
          <div><p className="text-xl font-bold">{done}/{scheduled.length}</p><p className="text-xs text-muted">concluídos</p></div>
        </div>
      ) : <p className="text-sm text-muted">Crie seu primeiro hábito 🌱</p>}
      <SeeMore>Ver hábitos</SeeMore>
    </Link>
  );
}

export function WaterWidget({ day }: { day: string }) {
  const { profile, today } = useSession();
  const { data: logs = [] } = useWaterLogs(day, day);
  const goal = profile?.water_goal_ml ?? 2000;
  const total = logs.reduce((s, l) => s + l.amount_ml, 0);
  const cups = Math.ceil(goal / 250);
  const filled = Math.floor(total / 250);
  return (
    <Link href="/agua" className="card card-hover block p-4">
      <WidgetHead icon={<Droplets className="size-4" />} title="Hidratação" tone="bg-info-soft text-info" action={day === today ? <AddBtn label="Adicionar 250 ml" onClick={() => void addWater(250, today)} /> : undefined} />
      <p className="text-sm"><strong className="text-lg">{total} ml</strong> <span className="text-muted">de {goal} ml</span></p>
      <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
        {Array.from({ length: Math.min(cups, 12) }, (_, i) => <span key={i} className={cn("h-5 w-3.5 rounded-b-md rounded-t-sm border", i < filled ? "border-info bg-info" : "border-info/40")} />)}
      </div>
      <ProgressBar value={(total / goal) * 100} tone="info" className="mt-2" label="Progresso da hidratação" />
    </Link>
  );
}

export function GoalsWidget() {
  const { data: goals = [] } = useGoals();
  const active = goals.filter((g) => g.status === "ativa").slice(0, 3);
  return (
    <Link href="/metas" className="card card-hover block p-4">
      <WidgetHead icon={<Target className="size-4" />} title="Metas" tone="bg-primary-soft text-primary" />
      {active.length ? (
        <ul className="space-y-2">
          {active.map((g) => {
            const steps = g.goal_steps ?? [];
            const pct = g.target_value ? (Number(g.current_value) / Number(g.target_value)) * 100 : steps.length ? (steps.filter((s) => s.done).length / steps.length) * 100 : 0;
            return <li key={g.id}><p className="truncate text-sm">{g.title}</p><ProgressBar value={pct} className="mt-1" label={g.title} /></li>;
          })}
        </ul>
      ) : <p className="text-sm text-muted">Defina uma meta para acompanhar.</p>}
      <SeeMore />
    </Link>
  );
}

export function FocusWidget() {
  const f = useFocus();
  return (
    <Link href="/foco" className="card card-hover block p-4">
      <WidgetHead icon={<Timer className="size-4" />} title="Modo foco" tone="bg-primary-soft text-primary" />
      <p className="text-2xl font-bold tabular-nums">{formatClock(f.remainingMs)}</p>
      <p className="text-xs text-muted">{f.state.status === "rodando" ? (f.state.mode === "foco" ? "Focando…" : "Em pausa") : `${f.state.completedFocus} sessão(ões) neste ciclo`}</p>
      <SeeMore>Abrir</SeeMore>
    </Link>
  );
}

export function PointsWidget() {
  const { total } = usePoints();
  const lv = levelFromPoints(total);
  return (
    <Link href="/conquistas" className="card card-hover block p-4">
      <WidgetHead icon={<Trophy className="size-4" />} title="Conquistas" tone="bg-warning-soft text-warning" />
      <p className="text-sm"><strong className="text-lg">Nível {lv.level}</strong> · <span className="text-muted">{lv.title}</span></p>
      <ProgressBar value={lv.progress} tone="warning" className="mt-2" label="Progresso de nível" />
      <p className="mt-1 text-xs text-muted">{total} pontos · faltam {lv.needed - lv.intoLevel}</p>
    </Link>
  );
}

export const Trend = ({ v }: { v: number }) => (v > 0 ? <ArrowUp className="size-3 text-success" /> : v < 0 ? <ArrowDown className="size-3 text-error" /> : <Minus className="size-3 text-muted" />);

export function DayProgress({ day }: { day: string }) {
  const { data: tasks = [] } = useTodayTasks(day);
  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(day, day);
  const dayTasks = tasks.filter((t) => t.due_date === day && t.status !== "cancelada");
  const sched = habits.filter((h) => h.kind === "construir" && isScheduledOn(h, day));
  const total = dayTasks.length + sched.length;
  const done = dayTasks.filter((t) => t.status === "concluida").length + sched.filter((h) => isCompleted(h, logs.find((l) => l.habit_id === h.id))).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm"><span className="font-semibold">Progresso de hoje</span><span className="font-bold">{pct}%</span></div>
      <ProgressBar value={pct} tone="dark" className="h-2.5" label="Progresso do dia" />
    </div>
  );
}

export function useWidgetRenderer(day: string) {
  return (key: string) => {
    switch (key) {
      case "agenda": return <AgendaWidget day={day} />;
      case "tarefas": return <TasksWidget day={day} />;
      case "financas": return <FinanceWidget />;
      case "sono": return <SleepWidget />;
      case "humor": return <MoodWidget />;
      case "habitos": return <HabitsWidget day={day} />;
      case "agua": return <WaterWidget day={day} />;
      case "metas": return <GoalsWidget />;
      case "foco": return <FocusWidget />;
      case "conquistas": return <PointsWidget />;
      default: return null;
    }
  };
}

export { Card };
