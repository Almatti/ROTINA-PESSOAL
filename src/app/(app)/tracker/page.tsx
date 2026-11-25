"use client";
import Link from "next/link";
import { ClipboardList, Plus, Droplets, Moon, Smile, Dumbbell, Flame, PiggyBank, RotateCcw } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, EmptyState, Skeleton, Card } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { HabitForm } from "@/components/forms/habit-form";
import { HabitDotCard } from "@/components/habits/dot-grid";
import { useSession } from "@/lib/session";
import { useHabits, useHabitLogs, useWaterLogs, useSleepLogs, useMoodLogs } from "@/lib/data/hooks";
import { addDays, minutesToLabel } from "@/lib/domain/dates";
import { daysFree } from "@/lib/domain/habits";
import { formatBRL } from "@/lib/domain/money";
import { mutate } from "@/lib/data/store";
import { useToast } from "@/components/ui/toast";
import type { Habit } from "@/lib/types";

export default function TrackerPage() {
  const { today, profile } = useSession();
  const toast = useToast();
  const { data: habits, loading } = useHabits();
  const { data: logs = [] } = useHabitLogs(addDays(today, -400), today);
  const { data: water = [] } = useWaterLogs(today, today);
  const { data: sleep = [] } = useSleepLogs(1);
  const { data: mood = [] } = useMoodLogs(today, today);
  const [creating, setCreating] = useState(false);
  const [relapse, setRelapse] = useState<Habit | null>(null);
  const build = (habits ?? []).filter((h) => h.kind === "construir");
  const quit = (habits ?? []).filter((h) => h.kind === "largar");
  const waterTotal = water.reduce((s, w) => s + w.amount_ml, 0);

  return (
    <>
      <PageHeader title="Tracker" icon={<ClipboardList className="size-5" />} actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Hábito</Button>} />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Registros rápidos">
        <Link href="/agua" className="card card-hover p-3"><Droplets className="size-5 text-info" aria-hidden /><p className="mt-2 text-xs text-muted">Água hoje</p><p className="font-bold">{waterTotal} / {profile?.water_goal_ml ?? 2000} ml</p></Link>
        <Link href="/sono" className="card card-hover p-3"><Moon className="size-5 text-primary" aria-hidden /><p className="mt-2 text-xs text-muted">Última noite</p><p className="font-bold">{sleep[0] ? minutesToLabel(sleep[0].duration_minutes) : "Registrar"}</p></Link>
        <Link href="/humor" className="card card-hover p-3"><Smile className="size-5 text-warning" aria-hidden /><p className="mt-2 text-xs text-muted">Humor</p><p className="font-bold">{mood[0]?.emoji ?? "Registrar"}</p></Link>
        <Link href="/treinos" className="card card-hover p-3"><Dumbbell className="size-5 text-success" aria-hidden /><p className="mt-2 text-xs text-muted">Treinos</p><p className="font-bold">Ver fichas</p></Link>
      </section>

      <div className="mb-2 mt-6 flex items-end justify-between">
        <div><h2 className="text-lg font-bold">Hábitos</h2><p className="text-xs text-muted">30 dias de visão · cada bolinha é um dia</p></div>
        <Link href="/habitos" className="text-sm font-semibold text-primary">Gerenciar</Link>
      </div>
      {loading && !habits ? <Skeleton className="h-32" /> : build.length === 0 ? (
        <EmptyState icon="🌱" title="Nenhum hábito ainda" description="Treino, água, leitura, meditação, skincare… comece por um." action={<Button onClick={() => setCreating(true)}>Criar hábito</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">{build.map((h) => <HabitDotCard key={h.id} habit={h} logs={logs} today={today} />)}</div>
      )}

      {quit.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-lg font-bold">Liberdade</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {quit.map((h) => {
              const relapses = logs.filter((l) => l.habit_id === h.id && l.value > 0).map((l) => l.log_date);
              const free = daysFree(h.started_on, relapses, today);
              return (
                <Card key={h.id} className="night-card stars border-0 text-white">
                  <p className="eyebrow text-white/70">Cada dia conta</p>
                  <p className="mt-1 font-semibold">{h.emoji} {h.name}</p>
                  <div className="mt-3 flex items-end gap-4">
                    <div><p className="flex items-center gap-1 text-3xl font-bold"><Flame className="size-6 text-iris" aria-hidden />{free}</p><p className="text-xs text-white/70">dias livres</p></div>
                    {h.money_per_day ? <div><p className="flex items-center gap-1 text-lg font-bold"><PiggyBank className="size-5 text-iris" aria-hidden />{formatBRL(free * Number(h.money_per_day))}</p><p className="text-xs text-white/70">estimativa economizada</p></div> : null}
                  </div>
                  <button onClick={() => setRelapse(h)} className="mt-4 inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3 py-1.5 text-xs font-semibold"><RotateCcw className="size-3.5" aria-hidden />Registrar recaída (sem julgamentos)</button>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="Novo hábito">{creating && <HabitForm onDone={() => setCreating(false)} />}</Sheet>
      <ConfirmDialog open={!!relapse} title="Registrar recaída?" message="Tudo bem — recomeçar faz parte. O contador volta a zero a partir de hoje e seu histórico é mantido." confirmLabel="Registrar" onCancel={() => setRelapse(null)} onConfirm={async () => {
        await mutate({ action: "upsert", table: "habit_logs", onConflict: "habit_id,log_date", values: { habit_id: relapse!.id, log_date: today, value: 1, completed: false, note: "recaida" } });
        setRelapse(null);
        toast.show("Registrado. Você continua no caminho 💜", "success");
      }} />
    </>
  );
}
