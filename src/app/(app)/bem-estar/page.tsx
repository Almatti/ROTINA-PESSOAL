"use client";
import Link from "next/link";
import { Heart, Moon, Smile, Droplets, Dumbbell, Flower2, Timer, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressBar, Ring } from "@/components/ui/primitives";
import { useSession } from "@/lib/session";
import { useSleepLogs, useMoodLogs, useWaterLogs, useTable } from "@/lib/data/hooks";
import { sleepStats } from "@/lib/domain/sleep";
import { predictCycle } from "@/lib/domain/cycle";
import { addDays, minutesToLabel, formatDateBR, startOfWeek } from "@/lib/domain/dates";
import { MOODS } from "@/components/modules/mood-meta";
import { useQuickAdd } from "@/components/layout/quick-add";

export default function WellbeingPage() {
  const { today, profile } = useSession();
  const qa = useQuickAdd();
  const { data: sleep = [] } = useSleepLogs(30);
  const { data: mood = [] } = useMoodLogs(addDays(today, -6), today);
  const { data: water = [] } = useWaterLogs(today, today);
  const cycleOn = profile?.modules?.ciclo === true;
  const { data: periods = [] } = useTable<{ start_date: string; end_date: string | null }>("cycle_periods", { order: "start_date", select: "start_date,end_date", key: cycleOn ? "on" : "off" });
  const { data: sessions = [] } = useTable<{ performed_on: string; duration_minutes: number | null }>("workout_sessions", { select: "performed_on,duration_minutes", filter: {}, key: "wb", order: "performed_on", ascending: false, limit: 50 });
  const { data: focus = [] } = useTable<{ started_at: string; actual_minutes: number; mode: string }>("focus_sessions", { select: "started_at,actual_minutes,mode", order: "started_at", ascending: false, limit: 50, key: "wb" });
  const goal = profile?.sleep_goal_minutes ?? 480;
  const s = sleepStats(sleep, goal, today);
  const todayMood = mood.find((m) => m.log_date === today);
  const waterTotal = water.reduce((t, w) => t + w.amount_ml, 0);
  const waterGoal = profile?.water_goal_ml ?? 2000;
  const pred = cycleOn ? predictCycle(periods, today) : null;
  const ws = startOfWeek(today);
  const weekWorkouts = sessions.filter((x) => x.performed_on >= ws);
  const focusToday = focus.filter((f) => f.mode === "foco" && f.started_at.slice(0, 10) >= addDays(today, -1)).reduce((t, f) => t + f.actual_minutes, 0);

  return (
    <>
      <PageHeader title="Bem-estar" icon={<Heart className="size-5" />} />
      <p className="mb-4 text-sm text-ink-soft">Um olhar gentil sobre como você está. Nada de cobranças — só informação para você se cuidar.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/sono" className="night-card stars card-hover block rounded-card p-4">
          <div className="flex items-center gap-2"><Moon className="size-5 text-iris" aria-hidden /><h2 className="flex-1 font-bold">Sono</h2><ChevronRight className="size-4 opacity-70" aria-hidden /></div>
          <div className="mt-3 flex items-center gap-4">
            <Ring value={s.last ? (s.last.duration_minutes / goal) * 100 : 0} size={72} stroke={7} color="#BAAAC8" track="rgba(255,255,255,.15)"><span className="text-sm font-bold">{s.last ? minutesToLabel(s.last.duration_minutes) : "—"}</span></Ring>
            <div className="text-sm"><p>Média semanal: <strong>{s.weekAvg ? minutesToLabel(s.weekAvg) : "—"}</strong></p><p className="text-white/75">{s.nightsOnGoal} noite(s) na meta em 30 dias</p></div>
          </div>
        </Link>
        <Link href="/humor" className="card card-hover block p-4">
          <div className="flex items-center gap-2"><Smile className="size-5 text-warning" aria-hidden /><h2 className="flex-1 font-bold">Humor e diário</h2><ChevronRight className="size-4 text-muted" aria-hidden /></div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-5xl" aria-hidden>{todayMood?.emoji ?? "🫥"}</span>
            <div className="text-sm"><p className="font-semibold">{todayMood ? MOODS[todayMood.mood - 1].label : "Ainda sem registro hoje"}</p><button className="text-primary" onClick={(e) => { e.preventDefault(); qa.open("humor"); }}>{todayMood ? "Atualizar" : "Registrar agora"}</button></div>
          </div>
          <div className="mt-3 flex gap-1" aria-label="Humor dos últimos 7 dias">{Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => <span key={d} className="flex-1 text-center text-lg" title={d}>{mood.find((m) => m.log_date === d)?.emoji ?? "·"}</span>)}</div>
        </Link>
        <Link href="/agua" className="card card-hover block p-4">
          <div className="flex items-center gap-2"><Droplets className="size-5 text-info" aria-hidden /><h2 className="flex-1 font-bold">Hidratação</h2><ChevronRight className="size-4 text-muted" aria-hidden /></div>
          <p className="mt-3 text-2xl font-bold text-info">{waterTotal} <span className="text-sm font-normal text-muted">/ {waterGoal} ml</span></p>
          <ProgressBar value={(waterTotal / waterGoal) * 100} tone="info" className="mt-2" label="Hidratação de hoje" />
        </Link>
        <Link href="/treinos" className="card card-hover block p-4">
          <div className="flex items-center gap-2"><Dumbbell className="size-5 text-success" aria-hidden /><h2 className="flex-1 font-bold">Movimento</h2><ChevronRight className="size-4 text-muted" aria-hidden /></div>
          <p className="mt-3 text-2xl font-bold">{weekWorkouts.length} <span className="text-sm font-normal text-muted">treino(s) na semana</span></p>
          <p className="text-sm text-muted">{weekWorkouts.reduce((t, x) => t + (x.duration_minutes ?? 0), 0)} minutos de atividade</p>
        </Link>
        {cycleOn && (
          <Link href="/ciclo" className="card card-hover block p-4">
            <div className="flex items-center gap-2"><Flower2 className="size-5 text-error" aria-hidden /><h2 className="flex-1 font-bold">Ciclo</h2><ChevronRight className="size-4 text-muted" aria-hidden /></div>
            <p className="mt-3 text-sm">{pred ? <>Próxima menstruação estimada: <strong>{formatDateBR(pred.nextStart)}</strong></> : "Registre o primeiro dia da menstruação."}</p>
          </Link>
        )}
        <Link href="/foco" className="card card-hover block p-4">
          <div className="flex items-center gap-2"><Timer className="size-5 text-primary" aria-hidden /><h2 className="flex-1 font-bold">Foco</h2><ChevronRight className="size-4 text-muted" aria-hidden /></div>
          <p className="mt-3 text-2xl font-bold">{focusToday} <span className="text-sm font-normal text-muted">min de foco recentes</span></p>
        </Link>
      </div>
      {!cycleOn && <p className="mt-4 text-center text-xs text-muted">O módulo de ciclo menstrual é opcional — <Link href="/ciclo" className="font-semibold text-primary">saiba mais</Link>.</p>}
    </>
  );
}
