"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Timer, Play, Pause, RotateCcw, SkipForward, Settings2, Volume2, VolumeX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, Field, Input, Select, Segmented, Stat, Toggle, Ring } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { Bars, CHART_COLORS } from "@/components/charts";
import { useFocus } from "@/components/focus/focus-provider";
import { useSession } from "@/lib/session";
import { useTasks, useTable } from "@/lib/data/hooks";
import { formatClock, type FocusMode } from "@/lib/domain/pomodoro";
import { addDays, localDateISO, WEEKDAY_SHORT, weekdayOf, minutesToLabel } from "@/lib/domain/dates";

function FocusInner() {
  const f = useFocus();
  const { today, tz } = useSession();
  const params = useSearchParams();
  const { data: tasks = [] } = useTasks({ key: "open" });
  const { data: sessions = [] } = useTable<{ id: string; mode: string; actual_minutes: number; started_at: string; task_id: string | null; completed: boolean }>("focus_sessions", { order: "started_at", ascending: false, limit: 500 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const total = f.state.plannedMinutes * 60000;
  const pct = total ? ((total - f.remainingMs) / total) * 100 : 0;

  useEffect(() => {
    const t = params.get("tarefa");
    if (t && f.state.status === "parado") f.setTask(t);
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusSessions = sessions.filter((s) => s.mode === "foco");
  const todayMin = focusSessions.filter((s) => localDateISO(new Date(s.started_at), tz) === today).reduce((t, s) => t + s.actual_minutes, 0);
  const weekMin = focusSessions.filter((s) => localDateISO(new Date(s.started_at), tz) >= addDays(today, -6)).reduce((t, s) => t + s.actual_minutes, 0);
  const chart = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => ({ dia: WEEKDAY_SHORT[weekdayOf(d)], Minutos: focusSessions.filter((s) => localDateISO(new Date(s.started_at), tz) === d).reduce((t, s) => t + s.actual_minutes, 0) })), [focusSessions, today, tz]);
  const color = f.state.mode === "foco" ? "var(--primary)" : "var(--success)";

  return (
    <>
      <PageHeader title="Modo foco" icon={<Timer className="size-5" />} actions={<Button size="icon" variant="ghost" aria-label="Configurar sessões" onClick={() => setSettingsOpen(true)}><Settings2 className="size-5" /></Button>} />
      <Segmented label="Modo" value={f.state.mode} onChange={(m: FocusMode) => f.setMode(m)} options={[{ value: "foco", label: "Foco" }, { value: "pausa_curta", label: "Pausa curta" }, { value: "pausa_longa", label: "Pausa longa" }]} />
      <Card className="mt-4 flex flex-col items-center gap-5 py-8">
        <Ring value={pct} size={240} stroke={14} color={color} label={`${formatClock(f.remainingMs)} restantes`}>
          <div>
            <p className="text-5xl font-bold tabular-nums" aria-live="polite" aria-atomic>{formatClock(f.remainingMs)}</p>
            <p className="mt-1 text-sm text-muted">{f.state.mode === "foco" ? "Foco" : "Pausa"} · ciclo {f.state.completedFocus % f.settings.cyclesUntilLong + (f.state.mode === "foco" ? 1 : 0)}/{f.settings.cyclesUntilLong}</p>
          </div>
        </Ring>
        <div className="flex items-center gap-3">
          <Button size="icon" variant="outline" onClick={f.reset} aria-label="Reiniciar"><RotateCcw className="size-5" /></Button>
          {f.state.status === "rodando" ? (
            <Button size="lg" className="w-40" onClick={f.pause} icon={<Pause className="size-5" />}>Pausar</Button>
          ) : (
            <Button size="lg" className="w-40" onClick={f.start} icon={<Play className="size-5" />}>{f.state.status === "pausado" ? "Continuar" : "Iniciar"}</Button>
          )}
          <Button size="icon" variant="outline" onClick={f.skip} aria-label="Pular para a próxima etapa"><SkipForward className="size-5" /></Button>
        </div>
        <div className="w-full max-w-sm">
          <label htmlFor="focus-task" className="label">Vincular a uma tarefa</label>
          <Select id="focus-task" value={f.state.taskId ?? ""} onChange={(e) => f.setTask(e.target.value || null)}>
            <option value="">Nenhuma</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
        </div>
        <button onClick={() => f.updateSettings({ sound: !f.settings.sound })} className="inline-flex items-center gap-1.5 text-sm text-muted" aria-pressed={f.settings.sound}>{f.settings.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}Som ao terminar {f.settings.sound ? "ativado" : "desativado"}</button>
      </Card>
      <p className="mt-2 text-center text-xs text-muted">O cronômetro continua ao navegar pelo app. Ative as notificações para ser avisada ao terminar.</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Hoje" value={minutesToLabel(todayMin)} icon="🎯" />
        <Stat label="7 dias" value={minutesToLabel(weekMin)} icon="📈" />
        <Stat label="Sessões" value={focusSessions.length} sub="concluídas" icon="⏱️" />
      </div>
      <Card className="mt-4"><h2 className="mb-2 font-bold">Minutos de foco na semana</h2><Bars data={chart} xKey="dia" series={[{ key: "Minutos", label: "Minutos de foco", color: CHART_COLORS[0] }]} /></Card>
      {focusSessions.length > 0 && (
        <Card className="mt-4 divide-y divide-line py-1">
          <h2 className="py-2 font-bold">Histórico</h2>
          {focusSessions.slice(0, 15).map((s) => (
            <div key={s.id} className="flex justify-between py-2 text-sm">
              <span>{new Date(s.started_at).toLocaleString("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short" })}{s.task_id ? ` · ${tasks.find((t) => t.id === s.task_id)?.title ?? "tarefa"}` : ""}</span>
              <span className="font-semibold">{s.actual_minutes} min</span>
            </div>
          ))}
        </Card>
      )}

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Sessões personalizadas">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Foco (min)">{(id) => <Input id={id} type="number" min={1} max={180} value={f.settings.focus} onChange={(e) => f.updateSettings({ focus: Math.max(1, Math.min(180, Number(e.target.value) || 25)) })} />}</Field>
            <Field label="Pausa curta (min)">{(id) => <Input id={id} type="number" min={1} max={60} value={f.settings.shortBreak} onChange={(e) => f.updateSettings({ shortBreak: Math.max(1, Math.min(60, Number(e.target.value) || 5)) })} />}</Field>
            <Field label="Pausa longa (min)">{(id) => <Input id={id} type="number" min={1} max={90} value={f.settings.longBreak} onChange={(e) => f.updateSettings({ longBreak: Math.max(1, Math.min(90, Number(e.target.value) || 15)) })} />}</Field>
            <Field label="Ciclos até a pausa longa">{(id) => <Input id={id} type="number" min={2} max={10} value={f.settings.cyclesUntilLong} onChange={(e) => f.updateSettings({ cyclesUntilLong: Math.max(2, Math.min(10, Number(e.target.value) || 4)) })} />}</Field>
          </div>
          <Toggle checked={f.settings.autoStartNext} onChange={(b) => f.updateSettings({ autoStartNext: b })} label="Iniciar a próxima etapa automaticamente" />
          <Toggle checked={f.settings.sound} onChange={(b) => f.updateSettings({ sound: b })} label="Som ao terminar" />
        </div>
      </Sheet>
    </>
  );
}

export default function FocusPage() {
  return <Suspense><FocusInner /></Suspense>;
}
