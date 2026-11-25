"use client";
import { Select } from "@/components/ui/primitives";
import type { RecurrenceRule } from "@/lib/domain/recurrence";
import { WEEKDAY_SHORT } from "@/lib/domain/dates";

export function RecurrenceField({ value, onChange, id }: { value: RecurrenceRule | null; onChange: (r: RecurrenceRule | null) => void; id?: string }) {
  return (
    <div className="space-y-2">
      <Select id={id} value={value?.freq ?? ""} onChange={(e) => onChange(e.target.value ? { freq: e.target.value as RecurrenceRule["freq"], interval: 1, weekdays: e.target.value === "semanal" ? value?.weekdays ?? [] : undefined } : null)}>
        <option value="">Não se repete</option>
        <option value="diaria">Diariamente</option>
        <option value="semanal">Semanalmente</option>
        <option value="mensal">Mensalmente</option>
        <option value="anual">Anualmente</option>
      </Select>
      {value?.freq === "semanal" && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
          {WEEKDAY_SHORT.map((d, i) => {
            const on = value.weekdays?.includes(i);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => onChange({ ...value, weekdays: on ? value.weekdays!.filter((x) => x !== i) : [...(value.weekdays ?? []), i] })} className={`h-9 w-11 rounded-xl text-xs font-semibold ${on ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-soft"}`}>
                {d}
              </button>
            );
          })}
        </div>
      )}
      {value && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Até</span>
          <input type="date" className="field max-w-44" value={value.until ?? ""} onChange={(e) => onChange({ ...value, until: e.target.value || null })} aria-label="Repetir até" />
        </div>
      )}
    </div>
  );
}
