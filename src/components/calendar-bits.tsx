"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { addDays, startOfWeek, WEEKDAY_SHORT, WEEKDAY_LETTER, monthGrid, formatMonthYear, addMonths, monthStart, MONTHS } from "@/lib/domain/dates";
import { cn } from "@/components/ui/primitives";

/** Faixa semanal interativa (como nas referências): setas + 7 dias, dia selecionado em destaque escuro. */
export function WeekStrip({ selected, onSelect, today, marks }: { selected: string; onSelect: (d: string) => void; today: string; marks?: Record<string, number> }) {
  const start = startOfWeek(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onSelect(addDays(selected, -7))} className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary" aria-label="Semana anterior"><ChevronLeft className="size-4" /></button>
      <ol className="grid flex-1 grid-cols-7 gap-0.5" aria-label="Dias da semana">
        {days.map((d) => {
          const isSel = d === selected;
          const isToday = d === today;
          return (
            <li key={d}>
              <button onClick={() => onSelect(d)} aria-current={isSel ? "date" : undefined} aria-label={`${WEEKDAY_SHORT[new Date(d + "T12:00:00Z").getUTCDay()]} ${d.slice(8)}${isToday ? " (hoje)" : ""}`} className={cn("flex w-full flex-col items-center rounded-2xl py-1.5 transition", isSel ? "bg-orchid text-white shadow-soft dark:bg-primary dark:text-primary-ink" : "hover:bg-surface-2")}>
                <span className={cn("text-[0.62rem] font-semibold uppercase", isSel ? "text-white/80 dark:text-primary-ink/80" : "text-muted")}>{WEEKDAY_SHORT[new Date(d + "T12:00:00Z").getUTCDay()]}</span>
                <span className={cn("text-lg font-bold leading-tight", isToday && !isSel && "text-primary")}>{Number(d.slice(8))}</span>
                <span className={cn("mt-0.5 size-1 rounded-full", marks?.[d] ? (isSel ? "bg-white" : "bg-primary") : "bg-transparent")} aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
      <button onClick={() => onSelect(addDays(selected, 7))} className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary" aria-label="Próxima semana"><ChevronRight className="size-4" /></button>
    </div>
  );
}

export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const [y, m] = month.split("-").map(Number);
  return (
    <div className="flex items-center justify-between rounded-card bg-surface p-2 shadow-soft-sm">
      <button onClick={() => onChange(addMonths(monthStart(month), -1, 1))} className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary" aria-label="Mês anterior"><ChevronLeft className="size-5" /></button>
      <div className="text-center">
        <p className="text-lg font-bold capitalize">{MONTHS[m - 1]}</p>
        <p className="text-xs tracking-[0.3em] text-muted">{y}</p>
      </div>
      <button onClick={() => onChange(addMonths(monthStart(month), 1, 1))} className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary" aria-label="Próximo mês"><ChevronRight className="size-5" /></button>
    </div>
  );
}

/** Grade mensal genérica: renderiza o conteúdo de cada dia via render prop. */
export function MonthGrid({ month, today, selected, onSelect, renderDay, label }: { month: string; today: string; selected?: string; onSelect?: (d: string) => void; renderDay?: (d: string) => ReactNode; label?: string }) {
  const days = monthGrid(month);
  const mm = month.slice(0, 7);
  return (
    <div role="grid" aria-label={label ?? formatMonthYear(month)}>
      <div className="grid grid-cols-7 pb-1 text-center text-xs font-semibold text-muted" role="row">
        {WEEKDAY_LETTER.map((d, i) => <span key={i} role="columnheader">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1" role="rowgroup">
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === mm;
          return (
            <button
              key={d}
              role="gridcell"
              aria-selected={selected === d}
              aria-label={`${Number(d.slice(8))}${d === today ? ", hoje" : ""}`}
              onClick={() => onSelect?.(d)}
              className={cn("relative flex min-h-12 flex-col items-center justify-start rounded-2xl pt-1 text-sm transition", !inMonth && "opacity-35", selected === d && "bg-primary-soft", d === today && "ring-1.5 ring-primary/50 ring-1")}
            >
              {renderDay ? renderDay(d) : <span className="font-semibold">{Number(d.slice(8))}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
