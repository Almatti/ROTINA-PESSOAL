"use client";
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Field, Input, Select, Textarea, Toggle } from "@/components/ui/primitives";
import { RecurrenceField } from "./recurrence-field";
import { eventSchema, zodFieldErrors } from "@/lib/validation/entities";
import { useCategories, useEvents } from "@/lib/data/hooks";
import { mutate, newId, DataError } from "@/lib/data/store";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/lib/session";
import { addDays, localDateISO, localTimeHHMM, zonedToUtc } from "@/lib/domain/dates";
import { conflictsWith } from "@/lib/domain/conflicts";
import type { CalendarEvent } from "@/lib/types";

export function EventForm({ event, onDone, defaults }: { event?: Partial<CalendarEvent> | null; onDone: () => void; defaults?: { title?: string; date?: string; time?: string } }) {
  const toast = useToast();
  const { tz, today } = useSession();
  const { data: categories } = useCategories("evento");
  const isEdit = !!event?.id;
  const start = event?.starts_at ? new Date(event.starts_at) : null;
  const end = event?.ends_at ? new Date(event.ends_at) : null;
  const defTime = defaults?.time ?? "09:00";
  const defEnd = `${String(Math.min(23, Number(defTime.slice(0, 2)) + 1)).padStart(2, "0")}:${defTime.slice(3, 5)}`;
  const [v, setV] = useState({
    title: event?.title ?? defaults?.title ?? "",
    date: start ? localDateISO(start, tz) : defaults?.date ?? today,
    start: start ? localTimeHHMM(start, tz) : defTime,
    endDate: end ? localDateISO(end, tz) : defaults?.date ?? today,
    end: end ? localTimeHHMM(end, tz) : defEnd,
    all_day: event?.all_day ?? false,
    location: event?.location ?? "",
    description: event?.description ?? "",
    category_id: event?.category_id ?? "",
    area: event?.area ?? "pessoal",
    reminder_minutes: event?.reminder_minutes?.toString() ?? "30",
    color: event?.color ?? "",
  });
  const [recurrence, setRecurrence] = useState(event?.recurrence ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const startsAt = v.all_day ? zonedToUtc(v.date, "00:00", tz) : zonedToUtc(v.date, v.start || "00:00", tz);
  const endsAt = v.all_day ? zonedToUtc(addDays(v.endDate < v.date ? v.date : v.endDate, 1), "00:00", tz) : zonedToUtc(v.endDate || v.date, v.end || v.start, tz);

  const { data: dayEvents } = useEvents(zonedToUtc(v.date, "00:00", tz).toISOString(), zonedToUtc(addDays(v.date, 1), "00:00", tz).toISOString());
  const conflicts = useMemo(
    () => (v.all_day ? [] : conflictsWith({ id: event?.id ?? "novo", title: v.title, starts_at: startsAt, ends_at: endsAt }, (dayEvents ?? []).filter((e) => !e.recurrence))),
    [dayEvents, v.all_day, v.title, startsAt.getTime(), endsAt.getTime(), event?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = eventSchema.safeParse({
      title: v.title,
      description: v.description || null,
      location: v.location || null,
      category_id: v.category_id || null,
      area: v.area,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      all_day: v.all_day,
      recurrence,
      reminder_minutes: v.reminder_minutes ? Number(v.reminder_minutes) : null,
      color: v.color || null,
    });
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));
    setErrors({});
    setSaving(true);
    try {
      const values = { ...parsed.data, local_updated_at: new Date().toISOString() };
      if (isEdit) await mutate({ action: "update", table: "events", id: event!.id!, values });
      else await mutate({ action: "insert", table: "events", values: { id: newId(), ...values } });
      toast.show(isEdit ? "Compromisso atualizado." : "Compromisso criado!", "success");
      onDone();
    } catch (err) {
      toast.show(err instanceof DataError ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <Field label="Título" error={errors.title}>{(id, d) => <Input id={id} value={v.title} onChange={set("title")} aria-describedby={d} invalid={!!errors.title} placeholder="Ex.: Pilates" maxLength={200} />}</Field>
      <Toggle checked={v.all_day} onChange={(b) => setV((s) => ({ ...s, all_day: b }))} label="Dia inteiro" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data de início">{(id) => <Input id={id} type="date" value={v.date} onChange={(e) => setV((s) => ({ ...s, date: e.target.value, endDate: s.endDate < e.target.value ? e.target.value : s.endDate }))} />}</Field>
        {!v.all_day && <Field label="Início">{(id) => <Input id={id} type="time" value={v.start} onChange={set("start")} />}</Field>}
        <Field label="Data de término">{(id) => <Input id={id} type="date" value={v.endDate} min={v.date} onChange={set("endDate")} />}</Field>
        {!v.all_day && <Field label="Término" error={errors.ends_at}>{(id) => <Input id={id} type="time" value={v.end} onChange={set("end")} />}</Field>}
      </div>
      {errors.ends_at && v.all_day && <p className="text-xs text-error">{errors.ends_at}</p>}
      {conflicts.length > 0 && (
        <div role="alert" className="flex gap-2 rounded-2xl bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span>Conflito de horário com: {conflicts.map((c) => c.title).join(", ")}. Você ainda pode salvar.</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">{(id) => (
          <Select id={id} value={v.category_id} onChange={set("category_id")}>
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </Select>)}
        </Field>
        <Field label="Lembrete">{(id) => (
          <Select id={id} value={v.reminder_minutes} onChange={set("reminder_minutes")}>
            <option value="">Sem lembrete</option><option value="0">Na hora</option><option value="10">10 min antes</option><option value="30">30 min antes</option><option value="60">1 h antes</option><option value="1440">1 dia antes</option>
          </Select>)}
        </Field>
        <Field label="Área">{(id) => (
          <Select id={id} value={v.area} onChange={set("area")}>
            <option value="pessoal">Pessoal</option><option value="trabalho">Trabalho</option><option value="estudos">Estudos</option><option value="casa">Casa</option>
          </Select>)}
        </Field>
        <Field label="Cor (opcional)">{(id) => <Input id={id} type="color" value={v.color || "#7451a6"} onChange={set("color")} className="h-11 p-1" />}</Field>
      </div>
      <Field label="Repetição">{(id) => <RecurrenceField id={id} value={recurrence} onChange={setRecurrence} />}</Field>
      <Field label="Local">{(id) => <Input id={id} value={v.location} onChange={set("location")} />}</Field>
      <Field label="Descrição">{(id) => <Textarea id={id} value={v.description} onChange={set("description")} rows={2} />}</Field>
      <Button type="submit" className="w-full" loading={saving}>{isEdit ? "Salvar alterações" : "Criar compromisso"}</Button>
    </form>
  );
}
