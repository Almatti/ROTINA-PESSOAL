"use client";
/**
 * Gráficos (Recharts) seguindo o design system: marcas finas, cantos
 * arredondados na ponta, grade discreta, tooltip por padrão e legenda
 * sempre que houver 2+ séries. Paleta categórica validada (claro/escuro).
 */
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
export const CHART_OTHER = "var(--chart-other)";

const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;

function TipBox({ active, payload, label, format }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }[]; label?: string; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-soft">
      {label && <p className="mb-1 font-semibold text-ink">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-ink-soft">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}: <strong className="text-ink">{format ? format(Number(p.value)) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-ink-soft">{i.label}</span>
          {i.value !== undefined && <span className="font-semibold text-ink">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export function Donut({ data, center, format, size = 150 }: { data: { label: string; value: number; color: string }[]; center?: ReactNode; format?: (v: number) => string; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={total ? data : [{ label: "vazio", value: 1, color: "var(--surface-3)" }]} dataKey="value" nameKey="label" innerRadius="70%" outerRadius="100%" paddingAngle={total && data.length > 1 ? 2 : 0} stroke="var(--surface)" strokeWidth={2} isAnimationActive>
            {(total ? data : [{ color: "var(--surface-3)" }]).map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          {total > 0 && <Tooltip content={<TipBox format={format} />} />}
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-xs text-muted">{center}</div>}
    </div>
  );
}

export function Bars({ data, xKey, series, height = 180, goal, format, stacked }: { data: Record<string, unknown>[]; xKey: string; series: { key: string; label: string; color: string }[]; height?: number; goal?: { value: number; label: string }; format?: (v: number) => string; stacked?: boolean }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} tickFormatter={format ? (v) => format(Number(v)) : undefined} width={56} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<TipBox format={format} />} />
          {goal && <ReferenceLine y={goal.value} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: goal.label, position: "insideTopRight", fill: "var(--muted)", fontSize: 10 }} />}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]} maxBarSize={28} stackId={stacked ? "a" : undefined} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Lines({ data, xKey, series, height = 180, format }: { data: Record<string, unknown>[]; xKey: string; series: { key: string; label: string; color: string }[]; height?: number; format?: (v: number) => string }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} tickFormatter={format ? (v) => format(Number(v)) : undefined} width={56} />
          <Tooltip content={<TipBox format={format} />} cursor={{ stroke: "var(--line)" }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: s.color }} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Abrevia valores em reais para eixos: 1,2 mil. */
export const shortBRL = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }));
