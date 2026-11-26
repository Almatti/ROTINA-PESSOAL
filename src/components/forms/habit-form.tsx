"use client";
import { useState } from "react";
import { Plus, Trash2, Archive } from "lucide-react";
import { Button, Field, Input, Select, Segmented, Toggle } from "@/components/ui/primitives";
import { habitSchema, zodFieldErrors } from "@/lib/validation/entities";
import { mutate, newId, DataError } from "@/lib/data/store";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/sheet";
import { WEEKDAY_SHORT } from "@/lib/domain/dates";
import type { Habit } from "@/lib/types";
import type { HabitFrequency } from "@/lib/domain/habits";

export const HABIT_TEMPLATES: { name: string; emoji: string; unit: string; target: number; step: number; period: Habit["period"] }[] = [
  { name: "Beber água", emoji: "💧", unit: "ml", target: 2000, step: 250, period: "qualquer" },
  { name: "Estudar", emoji: "📚", unit: "min", target: 30, step: 10, period: "tarde" },
  { name: "Ler", emoji: "📖", unit: "páginas", target: 10, step: 5, period: "noite" },
  { name: "Meditar", emoji: "🧘", unit: "min", target: 5, step: 5, period: "manha" },
  { name: "Fazer exercícios", emoji: "🏋️", unit: "min", target: 30, step: 10, period: "manha" },
  { name: "Skincare", emoji: "🧴", unit: "vez", target: 1, step: 1, period: "manha" },
  { name: "Dormir cedo", emoji: "🌙", unit: "vez", target: 1, step: 1, period: "noite" },
  { name: "Organizar a casa", emoji: "🧹", unit: "min", target: 15, step: 5, period: "qualquer" },
  { name: "Tomar vitaminas", emoji: "💊", unit: "vez", target: 1, step: 1, period: "manha" },
  { name: "Economizar dinheiro", emoji: "🐷", unit: "R$", target: 10, step: 5, period: "qualquer" },
];

const COLORS = ["#7451A6", "#88708E", "#5B8DEF", "#2F9E6E", "#E59A4F", "#D96BA0", "#4F7CAC", "#C9405F"];

export function HabitForm({ habit, onDone }: { habit?: Habit | null; onDone: () => void }) {
  const toast = useToast();
  const isEdit = !!habit;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [v, setV] = useState({
    name: habit?.name ?? "",
    emoji: habit?.emoji ?? "✨",
    color: habit?.color ?? COLORS[0],
    kind: habit?.kind ?? ("construir" as Habit["kind"]),
    target_value: String(habit?.target_value ?? 1),
    unit: habit?.unit ?? "vez",
    step_value: String(habit?.step_value ?? 1),
    time_of_day: habit?.time_of_day?.slice(0, 5) ?? "",
    period: habit?.period ?? ("qualquer" as Habit["period"]),
    reminder: habit?.reminder ?? false,
    money_per_day: habit?.money_per_day?.toString() ?? "",
  });
  const [freq, setFreq] = useState<HabitFrequency>(habit?.frequency ?? { type: "daily" });
  const [checklist, setChecklist] = useState(habit?.checklist ?? []);
  const [item, setItem] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = habitSchema.safeParse({ ...v, frequency: freq, checklist, time_of_day: v.time_of_day || null, money_per_day: v.money_per_day ? Number(v.money_per_day.replace(",", ".")) : null });
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));
    setErrors({});
    setSaving(true);
    try {
      if (isEdit) await mutate({ action: "update", table: "habits", id: habit!.id, values: parsed.data });
      else await mutate({ action: "insert", table: "habits", values: parsed.data });
      toast.show(isEdit ? "Hábito atualizado." : "Hábito criado! 🌱", "success");
      onDone();
    } catch (err) {
      toast.show(err instanceof DataError ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      {!isEdit && (
        <div>
          <span className="label">Sugestões</span>
          <div className="scroll-x -mx-1 flex gap-2 px-1 pb-1">
            {HABIT_TEMPLATES.map((t) => (
              <button key={t.name} type="button" onClick={() => setV((s) => ({ ...s, name: t.name, emoji: t.emoji, unit: t.unit, target_value: String(t.target), step_value: String(t.step), period: t.period }))} className="shrink-0 rounded-pill border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface-2">
                {t.emoji} {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <Segmented label="Tipo de hábito" value={v.kind} onChange={(k) => setV((s) => ({ ...s, kind: k }))} options={[{ value: "construir", label: "Construir" }, { value: "largar", label: "Largar um vício" }]} />
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <Field label="Emoji">{(id) => <Input id={id} value={v.emoji} onChange={set("emoji")} maxLength={4} className="text-center text-xl" />}</Field>
        <Field label="Nome" error={errors.name}>{(id, d) => <Input id={id} value={v.name} onChange={set("name")} aria-describedby={d} invalid={!!errors.name} placeholder={v.kind === "largar" ? "Ex.: Menos redes sociais" : "Ex.: Meditar"} />}</Field>
      </div>
      {v.kind === "construir" ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Meta diária" error={errors.target_value}>{(id) => <Input id={id} type="number" min={0.01} step="any" value={v.target_value} onChange={set("target_value")} />}</Field>
            <Field label="Unidade" error={errors.unit}>{(id) => <Input id={id} value={v.unit} onChange={set("unit")} placeholder="vez, ml, min" />}</Field>
            <Field label="Incremento" error={errors.step_value}>{(id) => <Input id={id} type="number" min={0.01} step="any" value={v.step_value} onChange={set("step_value")} />}</Field>
          </div>
          <div>
            <span className="label">Frequência</span>
            <Select value={freq.type} aria-label="Frequência" onChange={(e) => {
              const t = e.target.value;
              setFreq(t === "weekdays" ? { type: "weekdays", days: [1, 2, 3, 4, 5] } : t === "times_per_week" ? { type: "times_per_week", times: 3 } : t === "every_n_days" ? { type: "every_n_days", n: 2 } : { type: "daily" });
            }}>
              <option value="daily">Todos os dias</option>
              <option value="weekdays">Dias específicos</option>
              <option value="times_per_week">X vezes por semana</option>
              <option value="every_n_days">A cada N dias</option>
            </Select>
            {freq.type === "weekdays" && (
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Dias">
                {WEEKDAY_SHORT.map((d, i) => {
                  const on = freq.days.includes(i);
                  return <button key={d} type="button" aria-pressed={on} onClick={() => setFreq({ type: "weekdays", days: on ? freq.days.filter((x) => x !== i) : [...freq.days, i] })} className={`h-9 w-11 rounded-xl text-xs font-semibold ${on ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-soft"}`}>{d}</button>;
                })}
              </div>
            )}
            {freq.type === "times_per_week" && <Input className="mt-2" type="number" min={1} max={7} value={freq.times} onChange={(e) => setFreq({ type: "times_per_week", times: Math.max(1, Math.min(7, Number(e.target.value) || 1)) })} aria-label="Vezes por semana" />}
            {freq.type === "every_n_days" && <Input className="mt-2" type="number" min={2} max={60} value={freq.n} onChange={(e) => setFreq({ type: "every_n_days", n: Math.max(2, Math.min(60, Number(e.target.value) || 2)) })} aria-label="A cada quantos dias" />}
            {errors.frequency && <p className="mt-1 text-xs text-error">{errors.frequency}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Período">{(id) => (
              <Select id={id} value={v.period} onChange={set("period")}>
                <option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option><option value="qualquer">Qualquer horário</option>
              </Select>)}
            </Field>
            <Field label="Horário (opcional)">{(id) => <Input id={id} type="time" value={v.time_of_day} onChange={set("time_of_day")} />}</Field>
          </div>
          <div>
            <span className="label">Checklist interno (opcional)</span>
            <ul className="space-y-1.5">
              {checklist.map((c, i) => (
                <li key={c.id} className="flex gap-2">
                  <Input value={c.label} onChange={(e) => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Item do checklist" className="min-h-10 py-1.5" />
                  <Button variant="ghost" size="icon" onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))} aria-label="Remover item"><Trash2 className="size-4" /></Button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Ex.: Limpeza, tônico, hidratante" aria-label="Novo item" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (item.trim()) { setChecklist((l) => [...l, { id: newId(), label: item.trim() }]); setItem(""); } } }} />
              <Button variant="soft" size="icon" aria-label="Adicionar item" onClick={() => { if (item.trim()) { setChecklist((l) => [...l, { id: newId(), label: item.trim() }]); setItem(""); } }}><Plus className="size-4" /></Button>
            </div>
            {checklist.length > 0 && <p className="mt-1 text-xs text-muted">Com checklist, o hábito é concluído quando todos os itens forem marcados.</p>}
          </div>
        </>
      ) : (
        <Field label="Quanto você gastava por dia com isso? (opcional)" hint="Usado para estimar o dinheiro economizado.">{(id, d) => <Input id={id} inputMode="decimal" value={v.money_per_day} onChange={set("money_per_day")} aria-describedby={d} placeholder="0,00" />}</Field>
      )}
      <div>
        <span className="label">Cor</span>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={v.color === c} onClick={() => setV((s) => ({ ...s, color: c }))} className={`size-8 rounded-full ring-offset-2 ring-offset-surface ${v.color === c ? "ring-2 ring-ink" : ""}`} style={{ background: c }} />)}
        </div>
      </div>
      <Toggle checked={v.reminder} onChange={(b) => setV((s) => ({ ...s, reminder: b }))} label="Lembrete" description="Avisa no horário definido (com notificações ativas)." />
      <Button type="submit" className="w-full" loading={saving}>{isEdit ? "Salvar" : "Criar hábito"}</Button>
      {isEdit && (
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" icon={<Archive className="size-4" />} onClick={async () => { await mutate({ action: "update", table: "habits", id: habit!.id, values: { archived: true } }); toast.show("Hábito arquivado.", "success"); onDone(); }}>Arquivar</Button>
          <Button type="button" variant="ghost" className="flex-1 text-error" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>Excluir hábito</Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Excluir hábito?"
        message="O hábito e todo o histórico de registros serão apagados definitivamente. Se quiser só pausar, use Arquivar."
        confirmLabel="Excluir"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await mutate({ action: "delete", table: "habits", id: habit!.id });
            toast.show("Hábito excluído.", "success");
            setConfirmDelete(false);
            onDone();
          } catch (e) {
            toast.show(e instanceof DataError ? e.message : "Não foi possível excluir.", "error");
          }
        }}
      />
    </form>
  );
}
