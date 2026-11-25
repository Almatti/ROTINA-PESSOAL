"use client";
import { useEffect, useMemo, useState } from "react";
import { Dumbbell, Plus, Play, Trash2, Pencil, Timer, Pause, RotateCcw, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, Field, Input, Select, Textarea, SectionTitle, EmptyState, Segmented, Stat, cn } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { Lines, CHART_COLORS } from "@/components/charts";
import { WeekStrip } from "@/components/calendar-bits";
import { useSession } from "@/lib/session";
import { useTable } from "@/lib/data/hooks";
import { mutate, newId, DataError } from "@/lib/data/store";
import { award, unlock } from "@/lib/data/actions";
import { getSupabase } from "@/lib/supabase/client";
import { WEEKDAY_SHORT, weekdayOf, formatDayMonth, formatDateBR, addDays, startOfWeek } from "@/lib/domain/dates";
import { useToast } from "@/components/ui/toast";

interface Plan { id: string; name: string; weekdays: number[]; goal: string | null; notes: string | null; active: boolean; workout_exercises?: Exercise[] }
interface Exercise { id: string; plan_id: string; name: string; sets: number; reps: string; load_kg: string | null; rest_seconds: number; position: number; notes: string | null }
interface Session { id: string; plan_id: string | null; activity: string; performed_on: string; duration_minutes: number | null; distance_km: string | null; effort: number | null; notes: string | null; workout_sets?: { exercise_name: string; set_number: number; reps: number | null; load_kg: string | null }[] }

const ACTIVITIES = ["musculacao", "corrida", "caminhada", "bicicleta", "natacao", "yoga", "pilates", "danca", "funcional", "outro"];
const ACT_LABEL: Record<string, string> = { musculacao: "Musculação", corrida: "Corrida", caminhada: "Caminhada", bicicleta: "Bicicleta", natacao: "Natação", yoga: "Yoga", pilates: "Pilates", danca: "Dança", funcional: "Funcional", outro: "Outro" };

export default function WorkoutsPage() {
  const { today } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<"semana" | "fichas" | "evolucao">("semana");
  const [day, setDay] = useState(today);
  const { data: plans = [] } = useTable<Plan>("workout_plans", { select: "*, workout_exercises(*)", order: "created_at", key: "full" });
  const { data: sessions = [] } = useTable<Session>("workout_sessions", { select: "*, workout_sets(*)", order: "performed_on", ascending: false, key: "full", limit: 300 });
  const [planForm, setPlanForm] = useState<Plan | null | "new">(null);
  const [running, setRunning] = useState<Plan | null>(null);
  const [activity, setActivity] = useState(false);
  const [del, setDel] = useState<{ table: string; id: string; label: string } | null>(null);
  const todays = plans.filter((p) => p.active && p.weekdays.includes(weekdayOf(day)));
  const weekStart = startOfWeek(today);
  const weekSessions = sessions.filter((s) => s.performed_on >= weekStart);
  const sessionDays = Object.fromEntries(sessions.map((s) => [s.performed_on, 1]));

  return (
    <>
      <PageHeader title="Treinos" icon={<Dumbbell className="size-5" />} actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setActivity(true)}>Atividade</Button>} />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Nesta semana" value={weekSessions.length} sub="treinos" icon="💪" />
        <Stat label="Minutos" value={weekSessions.reduce((s, x) => s + (x.duration_minutes ?? 0), 0)} sub="na semana" icon="⏱️" />
        <Stat label="Total" value={sessions.length} sub="registros" icon="🏅" />
      </div>
      <div className="mt-4"><Segmented label="Seções" value={tab} onChange={setTab} options={[{ value: "semana", label: "Minha semana" }, { value: "fichas", label: "Fichas" }, { value: "evolucao", label: "Evolução" }]} /></div>

      {tab === "semana" && (
        <div className="mt-4 space-y-3">
          <Card><WeekStrip selected={day} onSelect={setDay} today={today} marks={sessionDays} /></Card>
          <SectionTitle>Seu treino {day === today ? "de hoje" : `de ${formatDayMonth(day)}`}</SectionTitle>
          {todays.length === 0 ? <EmptyState icon="🧘" title="Dia livre de fichas" description="Descanso também é treino. Ou registre uma atividade avulsa." action={<Button variant="soft" onClick={() => setActivity(true)}>Registrar atividade</Button>} /> : todays.map((p) => (
            <Card key={p.id}>
              <p className="eyebrow">{p.goal ?? "Ficha"}</p>
              <h3 className="font-bold">{p.name}</h3>
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {(p.workout_exercises ?? []).sort((a, b) => a.position - b.position).map((e) => <li key={e.id}>• {e.name} — {e.sets}×{e.reps}{e.load_kg ? ` · ${Number(e.load_kg)} kg` : ""}</li>)}
              </ul>
              <Button className="mt-3 w-full bg-success" icon={<Play className="size-4" />} onClick={() => setRunning(p)} disabled={!(p.workout_exercises ?? []).length}>Começar treino</Button>
            </Card>
          ))}
          <SectionTitle>Últimos movimentos</SectionTitle>
          {sessions.length === 0 ? <p className="text-sm text-muted">Nenhum treino registrado.</p> : (
            <Card className="divide-y divide-line py-1">
              {sessions.slice(0, 15).map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1"><p className="font-semibold">{s.plan_id ? plans.find((p) => p.id === s.plan_id)?.name ?? "Treino" : ACT_LABEL[s.activity] ?? s.activity}</p><p className="text-xs text-muted">{formatDateBR(s.performed_on)}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}{s.distance_km ? ` · ${Number(s.distance_km)} km` : ""}{s.workout_sets?.length ? ` · ${s.workout_sets.length} séries` : ""}</p></div>
                  <Button size="icon" variant="ghost" aria-label="Excluir registro" onClick={() => setDel({ table: "workout_sessions", id: s.id, label: "este treino" })}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {tab === "fichas" && (
        <div className="mt-4 space-y-3">
          <Button variant="soft" className="w-full" icon={<Plus className="size-4" />} onClick={() => setPlanForm("new")}>Nova ficha de treino</Button>
          <Card>
            <p className="mb-2 text-sm font-bold">Divisão semanal</p>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {WEEKDAY_SHORT.map((d, i) => (
                <div key={d} className="rounded-xl bg-surface-2 p-1.5"><p className="font-semibold">{d}</p>{plans.filter((p) => p.active && p.weekdays.includes(i)).map((p) => <p key={p.id} className="mt-1 truncate rounded bg-primary-soft px-0.5 text-[0.6rem] text-primary-soft-ink" title={p.name}>{p.name}</p>)}</div>
              ))}
            </div>
          </Card>
          {plans.length === 0 ? <EmptyState icon="📋" title="Crie sua primeira ficha" description="Ex.: Treino A — Inferiores, com séries, repetições, carga e descanso." /> : plans.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start gap-2">
                <div className="flex-1"><h3 className={cn("font-bold", !p.active && "text-muted line-through")}>{p.name}</h3><p className="text-xs text-muted">{p.weekdays.length ? p.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ") : "Sem dias definidos"}{p.goal ? ` · ${p.goal}` : ""}</p></div>
                <Button size="icon" variant="ghost" aria-label={`Editar ${p.name}`} onClick={() => setPlanForm(p)}><Pencil className="size-4" /></Button>
                <Button size="icon" variant="ghost" aria-label={`Excluir ${p.name}`} onClick={() => setDel({ table: "workout_plans", id: p.id, label: p.name })}><Trash2 className="size-4" /></Button>
              </div>
              <ul className="mt-2 divide-y divide-line text-sm">
                {(p.workout_exercises ?? []).sort((a, b) => a.position - b.position).map((e) => <li key={e.id} className="flex justify-between py-1.5"><span>{e.name}</span><span className="text-muted">{e.sets}×{e.reps}{e.load_kg ? ` · ${Number(e.load_kg)}kg` : ""} · {e.rest_seconds}s</span></li>)}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {tab === "evolucao" && <Evolution sessions={sessions} today={today} />}

      <Sheet open={!!planForm} onClose={() => setPlanForm(null)} title={planForm === "new" ? "Nova ficha" : "Editar ficha"} wide>{planForm && <PlanForm plan={planForm === "new" ? null : planForm} onDone={() => setPlanForm(null)} />}</Sheet>
      <Sheet open={!!running} onClose={() => setRunning(null)} title={running?.name ?? ""} wide>{running && <RunWorkout plan={running} onDone={() => setRunning(null)} />}</Sheet>
      <Sheet open={activity} onClose={() => setActivity(false)} title="Registrar atividade física">
        <ActivityForm onDone={() => setActivity(false)} />
      </Sheet>
      <ConfirmDialog open={!!del} danger title="Confirmar exclusão" message={`Excluir ${del?.label}? Esta ação não pode ser desfeita.`} confirmLabel="Excluir" onCancel={() => setDel(null)} onConfirm={async () => { await mutate({ action: "delete", table: del!.table, id: del!.id }); setDel(null); toast.show("Excluído.", "success"); }} />
    </>
  );
}

function PlanForm({ plan, onDone }: { plan: Plan | null; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(plan?.name ?? "");
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(plan?.weekdays ?? []);
  const [active, setActive] = useState(plan?.active ?? true);
  const [exercises, setExercises] = useState<Partial<Exercise>[]>(plan?.workout_exercises?.sort((a, b) => a.position - b.position) ?? [{ id: newId(), name: "", sets: 3, reps: "12", load_kg: "", rest_seconds: 60 }]);
  const [saving, setSaving] = useState(false);
  const upd = (i: number, k: keyof Exercise, v: string | number) => setExercises((l) => l.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!name.trim()) return toast.show("Dê um nome à ficha.", "error");
      const valid = exercises.filter((x) => x.name?.trim());
      setSaving(true);
      try {
        const id = plan?.id ?? newId();
        const values = { name: name.trim(), goal: goal || null, weekdays: weekdays.sort(), active };
        if (plan) await mutate({ action: "update", table: "workout_plans", id, values });
        else await mutate({ action: "insert", table: "workout_plans", values: { id, ...values } });
        for (const old of plan?.workout_exercises ?? []) if (!valid.find((x) => x.id === old.id)) await mutate({ action: "delete", table: "workout_exercises", id: old.id });
        for (const [i, x] of valid.entries()) {
          const row = { plan_id: id, name: x.name!.trim(), sets: Math.max(1, Math.min(20, Number(x.sets) || 3)), reps: String(x.reps || "12").slice(0, 20), load_kg: x.load_kg ? Number(String(x.load_kg).replace(",", ".")) : null, rest_seconds: Math.max(0, Math.min(900, Number(x.rest_seconds) || 60)), position: i };
          if (plan?.workout_exercises?.find((o) => o.id === x.id)) await mutate({ action: "update", table: "workout_exercises", id: x.id!, values: row });
          else await mutate({ action: "insert", table: "workout_exercises", values: { id: x.id ?? newId(), ...row } });
        }
        toast.show("Ficha salva.", "success");
        onDone();
      } catch (ex) {
        toast.show(ex instanceof DataError ? ex.message : "Erro ao salvar.", "error");
      } finally {
        setSaving(false);
      }
    }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Treino A — Inferiores" />}</Field>
        <Field label="Objetivo">{(id) => <Input id={id} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Hipertrofia, resistência…" />}</Field>
      </div>
      <fieldset><legend className="label">Dias da semana</legend><div className="flex flex-wrap gap-1.5">{WEEKDAY_SHORT.map((d, i) => { const on = weekdays.includes(i); return <button key={d} type="button" aria-pressed={on} onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== i) : [...w, i]))} className={`h-9 w-11 rounded-xl text-xs font-semibold ${on ? "bg-primary text-primary-ink" : "bg-surface-2"}`}>{d}</button>; })}</div></fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--primary)]" />Ficha ativa</label>
      <div className="space-y-3">
        <span className="label">Exercícios</span>
        {exercises.map((x, i) => (
          <div key={x.id ?? i} className="rounded-2xl bg-surface-2 p-3">
            <div className="flex gap-2"><Input value={x.name ?? ""} onChange={(e) => upd(i, "name", e.target.value)} placeholder="Exercício" aria-label="Nome do exercício" /><Button size="icon" variant="ghost" aria-label="Remover exercício" onClick={() => setExercises((l) => l.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <label className="text-xs">Séries<Input type="number" min={1} max={20} value={x.sets ?? 3} onChange={(e) => upd(i, "sets", e.target.value)} /></label>
              <label className="text-xs">Reps<Input value={x.reps ?? ""} onChange={(e) => upd(i, "reps", e.target.value)} /></label>
              <label className="text-xs">Carga (kg)<Input inputMode="decimal" value={x.load_kg ?? ""} onChange={(e) => upd(i, "load_kg", e.target.value)} /></label>
              <label className="text-xs">Descanso (s)<Input type="number" min={0} max={900} value={x.rest_seconds ?? 60} onChange={(e) => upd(i, "rest_seconds", e.target.value)} /></label>
            </div>
          </div>
        ))}
        <Button variant="outline" className="w-full" icon={<Plus className="size-4" />} onClick={() => setExercises((l) => [...l, { id: newId(), name: "", sets: 3, reps: "12", load_kg: "", rest_seconds: 60 }])}>Adicionar exercício</Button>
      </div>
      <Button type="submit" className="w-full" loading={saving}>Salvar ficha</Button>
    </form>
  );
}

/** Execução do treino: registra séries/cargas, cronômetro geral e timer de descanso. */
function RunWorkout({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const { today } = useSession();
  const toast = useToast();
  const exercises = (plan.workout_exercises ?? []).sort((a, b) => a.position - b.position);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [sets, setSets] = useState<Record<string, { reps: string; load: string; done: boolean }[]>>(() =>
    Object.fromEntries(exercises.map((e) => [e.id, Array.from({ length: e.sets }, () => ({ reps: e.reps.replace(/\D.*/, "") || "", load: e.load_kg ? String(Number(e.load_kg)) : "", done: false }))])),
  );
  const [saving, setSaving] = useState(false);
  useEffect(() => { const id = setInterval(() => !paused && setNow(Date.now()), 500); return () => clearInterval(id); }, [paused]);
  useEffect(() => { if (rest && now >= rest.until) { setRest(null); try { navigator.vibrate?.(300); } catch {} toast.show("Descanso concluído! Próxima série 💪", "info"); } }, [now, rest, toast]);
  const elapsed = Math.floor((now - startedAt) / 1000);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-orchid p-4 text-white dark:bg-surface-3">
        <Timer className="size-6 text-iris" aria-hidden />
        <div className="flex-1"><p className="text-xs text-white/70">Tempo de treino</p><p className="text-2xl font-bold tabular-nums" aria-live="off">{fmt(elapsed)}</p></div>
        {rest && <div className="text-right"><p className="text-xs text-white/70">Descanso</p><p className="text-2xl font-bold tabular-nums text-iris">{fmt(Math.max(0, Math.ceil((rest.until - now) / 1000)))}</p></div>}
        <button onClick={() => setPaused(!paused)} aria-label={paused ? "Retomar" : "Pausar"} className="grid size-10 place-items-center rounded-full bg-white/15">{paused ? <Play className="size-4" /> : <Pause className="size-4" />}</button>
        {rest && <button onClick={() => setRest(null)} aria-label="Pular descanso" className="grid size-10 place-items-center rounded-full bg-white/15"><RotateCcw className="size-4" /></button>}
      </div>
      {exercises.map((e) => (
        <div key={e.id} className="rounded-2xl border border-line p-3">
          <p className="font-semibold">{e.name} <span className="text-xs font-normal text-muted">· descanso {e.rest_seconds}s</span></p>
          <div className="mt-2 space-y-1.5">
            {sets[e.id]?.map((s, i) => (
              <div key={i} className="grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2 text-sm">
                <span className="text-muted">{i + 1}ª</span>
                <Input aria-label={`Repetições da série ${i + 1}`} inputMode="numeric" value={s.reps} onChange={(ev) => setSets((m) => ({ ...m, [e.id]: m[e.id].map((x, j) => (j === i ? { ...x, reps: ev.target.value } : x)) }))} placeholder="reps" className="min-h-9 py-1" />
                <Input aria-label={`Carga da série ${i + 1}`} inputMode="decimal" value={s.load} onChange={(ev) => setSets((m) => ({ ...m, [e.id]: m[e.id].map((x, j) => (j === i ? { ...x, load: ev.target.value } : x)) }))} placeholder="kg" className="min-h-9 py-1" />
                <button aria-pressed={s.done} aria-label={`Concluir série ${i + 1}`} onClick={() => { setSets((m) => ({ ...m, [e.id]: m[e.id].map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })); if (!s.done && e.rest_seconds) setRest({ until: Date.now() + e.rest_seconds * 1000, total: e.rest_seconds }); }} className={cn("grid size-9 place-items-center rounded-full border-2", s.done ? "border-success bg-success text-white" : "border-iris")}>{s.done && <Check className="size-4" />}</button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button className="w-full" loading={saving} onClick={async () => {
        setSaving(true);
        try {
          const sessionId = newId();
          await mutate({ action: "insert", table: "workout_sessions", values: { id: sessionId, plan_id: plan.id, activity: "musculacao", performed_on: today, duration_minutes: Math.max(1, Math.round(elapsed / 60)) } });
          const rows = exercises.flatMap((e) => (sets[e.id] ?? []).filter((s) => s.done).map((s, i) => ({ session_id: sessionId, exercise_id: e.id, exercise_name: e.name, set_number: i + 1, reps: s.reps ? Number(s.reps) : null, load_kg: s.load ? Number(s.load.replace(",", ".")) : null })));
          if (rows.length) await mutate({ action: "insert", table: "workout_sets", values: rows });
          // atualiza a carga de referência da ficha com a maior carga usada
          for (const e of exercises) {
            const max = Math.max(0, ...(sets[e.id] ?? []).filter((s) => s.done && s.load).map((s) => Number(s.load.replace(",", "."))));
            if (max && max !== Number(e.load_kg)) await mutate({ action: "update", table: "workout_exercises", id: e.id, values: { load_kg: max } });
          }
          await award("treino", `treino:${sessionId}`);
          const { count } = await getSupabase().from("workout_sessions").select("id", { count: "exact", head: true });
          if ((count ?? 0) >= 10) void unlock("treino_10");
          toast.show("Treino registrado! 💪", "success");
          onDone();
        } catch {
          toast.show("Não foi possível salvar o treino.", "error");
        } finally {
          setSaving(false);
        }
      }}>Finalizar treino</Button>
    </div>
  );
}

function ActivityForm({ onDone }: { onDone: () => void }) {
  const { today } = useSession();
  const toast = useToast();
  const [activity, setActivity] = useState("caminhada");
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState("30");
  const [distance, setDistance] = useState("");
  const [effort, setEffort] = useState("5");
  const [notes, setNotes] = useState("");
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const d = Number(duration);
      if (!(d >= 1 && d <= 1440)) return toast.show("Duração entre 1 e 1440 min.", "error");
      const id = newId();
      await mutate({ action: "insert", table: "workout_sessions", values: { id, activity, performed_on: date, duration_minutes: d, distance_km: distance ? Number(distance.replace(",", ".")) : null, effort: Number(effort), notes: notes || null } });
      await award("treino", `treino:${id}`);
      toast.show("Atividade registrada!", "success");
      onDone();
    }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Atividade">{(id) => <Select id={id} value={activity} onChange={(e) => setActivity(e.target.value)}>{ACTIVITIES.map((a) => <option key={a} value={a}>{ACT_LABEL[a]}</option>)}</Select>}</Field>
        <Field label="Data">{(id) => <Input id={id} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Duração (min)">{(id) => <Input id={id} type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />}</Field>
        <Field label="Distância (km)">{(id) => <Input id={id} inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="opcional" />}</Field>
      </div>
      <label className="block text-sm"><span className="label">Esforço percebido: {effort}/10</span><input type="range" min={1} max={10} value={effort} onChange={(e) => setEffort(e.target.value)} className="w-full accent-[var(--primary)]" /></label>
      <Field label="Observações">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}</Field>
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );
}

function Evolution({ sessions, today }: { sessions: Session[]; today: string }) {
  const names = useMemo(() => [...new Set(sessions.flatMap((s) => s.workout_sets?.map((x) => x.exercise_name) ?? []))].sort(), [sessions]);
  const [ex, setEx] = useState("");
  const selected = ex || names[0] || "";
  const data = sessions
    .filter((s) => s.workout_sets?.some((x) => x.exercise_name === selected && x.load_kg))
    .map((s) => ({ dia: formatDayMonth(s.performed_on), d: s.performed_on, "Carga máx. (kg)": Math.max(...(s.workout_sets ?? []).filter((x) => x.exercise_name === selected && x.load_kg).map((x) => Number(x.load_kg))) }))
    .sort((a, b) => a.d.localeCompare(b.d))
    .slice(-20);
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const ws = addDays(startOfWeek(today), -7 * (7 - i));
    return { semana: formatDayMonth(ws), Minutos: sessions.filter((s) => s.performed_on >= ws && s.performed_on < addDays(ws, 7)).reduce((t, s) => t + (s.duration_minutes ?? 0), 0) };
  });
  return (
    <div className="mt-4 space-y-3">
      <Card>
        <h2 className="font-bold">Evolução de cargas</h2>
        {names.length === 0 ? <p className="mt-2 text-sm text-muted">Finalize treinos com cargas registradas para ver a evolução.</p> : (
          <>
            <Select className="mt-2" value={selected} onChange={(e) => setEx(e.target.value)} aria-label="Exercício">{names.map((n) => <option key={n}>{n}</option>)}</Select>
            <div className="mt-3"><Lines data={data} xKey="dia" series={[{ key: "Carga máx. (kg)", label: "Carga máxima (kg)", color: CHART_COLORS[0] }]} format={(v) => `${v}kg`} /></div>
          </>
        )}
      </Card>
      <Card><h2 className="mb-2 font-bold">Minutos de atividade por semana</h2><Lines data={weekly} xKey="semana" series={[{ key: "Minutos", label: "Minutos", color: CHART_COLORS[2] }]} /></Card>
    </div>
  );
}
