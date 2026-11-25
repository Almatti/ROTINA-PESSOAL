"use client";
import { useEffect, useState } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/toast";
import { mutate, DataError } from "@/lib/data/store";
import { award } from "@/lib/data/actions";
import { getSupabase } from "@/lib/supabase/client";
import { buildSleepInstants, durationFromTimes } from "@/lib/domain/sleep";
import { minutesToLabel, localTimeHHMM, timeToMinutes } from "@/lib/domain/dates";
import { sleepSchema, zodFieldErrors } from "@/lib/validation/entities";
import type { SleepLogRow } from "@/lib/types";

const QUALITY = [
  { v: 1, e: "😫", l: "Péssima" }, { v: 2, e: "😕", l: "Ruim" }, { v: 3, e: "😐", l: "Ok" }, { v: 4, e: "😌", l: "Boa" }, { v: 5, e: "😴", l: "Excelente" },
];

export function SleepForm({ onDone, log, durationHint }: { onDone: () => void; log?: SleepLogRow | null; durationHint?: number }) {
  const { today, tz, profile } = useSession();
  const toast = useToast();
  const wakeDefault = profile?.wake_time?.slice(0, 5) ?? "07:00";
  const bedDefault = durationHint
    ? (() => { const m = (timeToMinutes(wakeDefault) - durationHint + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; })()
    : profile?.bed_time?.slice(0, 5) ?? "23:00";
  const [date, setDate] = useState(log?.sleep_date ?? today);
  const [bed, setBed] = useState(log ? localTimeHHMM(new Date(log.bed_at), tz) : bedDefault);
  const [wake, setWake] = useState(log ? localTimeHHMM(new Date(log.wake_at), tz) : wakeDefault);
  const [quality, setQuality] = useState<number | null>(log?.quality ?? null);
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [existingId, setExistingId] = useState<string | null>(log?.id ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (log) return;
    getSupabase().from("sleep_logs").select("id").eq("sleep_date", date).maybeSingle().then(({ data }) => setExistingId(data?.id ?? null));
  }, [date, log]);

  const duration = bed && wake ? durationFromTimes(bed, wake) : 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = sleepSchema.safeParse({ sleep_date: date, bed, wake, quality, notes: notes || null });
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));
    const { bedAt, wakeAt, duration: dur } = buildSleepInstants(date, bed, wake, tz);
    if (dur <= 0 || dur > 1440) return setErrors({ wake: "Verifique os horários." });
    setErrors({});
    setSaving(true);
    try {
      const values = { sleep_date: date, bed_at: bedAt.toISOString(), wake_at: wakeAt.toISOString(), duration_minutes: dur, quality, notes: notes || null };
      if (existingId) await mutate({ action: "update", table: "sleep_logs", id: existingId, values });
      else await mutate({ action: "insert", table: "sleep_logs", values });
      await award("sono", `sono:${date}`);
      toast.show(`Noite registrada: ${minutesToLabel(dur)} 🌙`, "success");
      onDone();
    } catch (err) {
      toast.show(err instanceof DataError ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <Field label="Data em que acordei" error={errors.sleep_date}>{(id) => <Input id={id} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fui dormir" error={errors.bed}>{(id) => <Input id={id} type="time" value={bed} onChange={(e) => setBed(e.target.value)} />}</Field>
        <Field label="Acordei" error={errors.wake}>{(id) => <Input id={id} type="time" value={wake} onChange={(e) => setWake(e.target.value)} />}</Field>
      </div>
      <p className="rounded-2xl bg-primary-soft p-3 text-center text-sm text-primary-soft-ink">Duração: <strong>{minutesToLabel(duration)}</strong>{existingId && " · substituirá o registro desta data"}</p>
      <fieldset>
        <legend className="label">Como foi a qualidade?</legend>
        <div className="grid grid-cols-5 gap-2">
          {QUALITY.map((q) => (
            <button key={q.v} type="button" aria-pressed={quality === q.v} onClick={() => setQuality(q.v)} className={`flex flex-col items-center rounded-2xl border p-2 text-xs ${quality === q.v ? "border-primary bg-primary-soft" : "border-line"}`}>
              <span className="text-2xl" aria-hidden>{q.e}</span>{q.l}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Observações">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}</Field>
      <Button type="submit" className="w-full" loading={saving}>Salvar noite</Button>
    </form>
  );
}
