"use client";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, Plus, Flame, HelpCircle, Droplet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, SectionTitle, Stat } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { MoodForm } from "@/components/modules/mood-form";
import { MonthGrid, MonthNav } from "@/components/calendar-bits";
import { Lines, CHART_COLORS } from "@/components/charts";
import { useSession } from "@/lib/session";
import { useMoodLogs, useTable } from "@/lib/data/hooks";
import { monthStart, monthEnd, addDays, formatDayMonth, formatDateBR } from "@/lib/domain/dates";
import { predictCycle, cycleCalendarMarks } from "@/lib/domain/cycle";
import { MOODS } from "@/components/modules/mood-meta";

export default function MoodPage() {
  const { today, profile } = useSession();
  const [month, setMonth] = useState(monthStart(today));
  const [form, setForm] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const { data: logs = [] } = useMoodLogs(addDays(monthStart(month), -60), monthEnd(month));
  const { data: allCount = [] } = useMoodLogs("2000-01-01", today);
  const cycleOn = profile?.modules?.ciclo === true;
  const { data: periods = [] } = useTable<{ start_date: string; end_date: string | null }>("cycle_periods", { order: "start_date", select: "start_date,end_date", key: cycleOn ? "on" : "off" });
  const pred = cycleOn ? predictCycle(periods, today) : null;
  const marks = cycleOn ? cycleCalendarMarks(periods, pred, addDays(monthStart(month), -7), addDays(monthEnd(month), 7)) : new Map();

  // sequência de dias com registro
  let streak = 0;
  for (let d = logs.some((l) => l.log_date === today) ? today : addDays(today, -1); allCount.some((l) => l.log_date === d); d = addDays(d, -1)) streak++;
  const monthLogs = logs.filter((l) => l.log_date.slice(0, 7) === month.slice(0, 7));
  const avg = monthLogs.length ? monthLogs.reduce((s, l) => s + l.mood, 0) / monthLogs.length : 0;
  const series = logs.filter((l) => l.log_date >= addDays(today, -29)).map((l) => ({ dia: formatDayMonth(l.log_date), Humor: l.mood, Energia: l.energy }));
  const recent = [...logs].reverse().filter((l) => l.journal || l.gratitude || l.highlights).slice(0, 10);

  return (
    <>
      <PageHeader title="Meu Journal" icon={<BookOpen className="size-5" />} subtitle={`${allCount.length} registro(s)`} actions={<span className="flex h-9 items-center gap-1 rounded-pill bg-error-soft px-3 text-sm font-bold text-error" aria-label={`${streak} dias seguidos`}>{streak} <Flame className="size-4" aria-hidden /></span>} />
      <div className="flex items-center justify-between">
        <button onClick={() => setHelp(true)} className="inline-flex items-center gap-1 text-sm text-muted"><HelpCircle className="size-4" aria-hidden />Como funciona</button>
        <Button size="icon" variant="dark" aria-label="Novo registro" onClick={() => setForm(today)}><Plus className="size-5" /></Button>
      </div>
      <div className="mt-3"><MonthNav month={month} onChange={setMonth} /></div>
      <Card className="mt-3">
        <MonthGrid month={month} today={today} onSelect={(d) => d <= today && setForm(d)} renderDay={(d) => {
          const l = logs.find((x) => x.log_date === d);
          const m = marks.get(d);
          return (
            <>
              <span className="text-2xl leading-7" aria-hidden>{l ? l.emoji : <span className="text-transparent">·</span>}</span>
              <span className={`text-[0.65rem] ${m === "menstruacao" ? "rounded-full bg-error px-1 font-bold text-white" : m === "previsao" ? "rounded-full px-1 outline-1 outline-dashed outline-error text-error" : "text-muted"}`}>{Number(d.slice(8))}</span>
            </>
          );
        }} />
        {cycleOn && <div className="mt-3 flex justify-center gap-4 text-xs text-muted"><span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-error" />Menstruação</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-full outline-1 outline-dashed outline-error" />Previsão</span></div>}
      </Card>

      {cycleOn ? (
        <SectionTitle>Meu ciclo</SectionTitle>
      ) : null}
      {cycleOn && (
        <Link href="/ciclo" className="card card-hover flex items-center gap-3 p-4">
          <span className="grid size-12 place-items-center rounded-full bg-error-soft text-error"><Droplet className="size-6" aria-hidden /></span>
          <div className="flex-1">{pred ? <><p className="font-bold">Próxima menstruação: {formatDateBR(pred.nextStart)}</p><p className="text-xs text-muted">Estimativa · dia {pred.currentDay ?? "—"} do ciclo</p></> : <><p className="font-bold">Vamos acompanhar seu ciclo?</p><p className="text-xs text-muted">Toque em “Registrar hoje” no primeiro dia da menstruação.</p></>}</div>
          <span className="rounded-pill bg-error-soft px-3 py-2 text-sm font-semibold text-error">{pred ? "Abrir" : "Registrar hoje"}</span>
        </Link>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Humor médio no mês" value={avg ? `${MOODS[Math.round(avg) - 1].emoji} ${avg.toFixed(1)}` : "—"} />
        <Stat label="Registros no mês" value={monthLogs.length} />
      </div>
      {series.length > 1 && (
        <Card className="mt-4">
          <h2 className="font-bold">Evolução (30 dias)</h2>
          <p className="mb-2 text-xs text-muted">Humor (1–5) e energia (1–5)</p>
          <Lines data={series} xKey="dia" series={[{ key: "Humor", label: "Humor", color: CHART_COLORS[0] }, { key: "Energia", label: "Energia", color: CHART_COLORS[2] }]} />
          <div className="mt-1 flex gap-4 text-xs"><span className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[0] }} />Humor</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[2] }} />Energia</span></div>
        </Card>
      )}
      {recent.length > 0 && (
        <>
          <SectionTitle>Últimas páginas do diário</SectionTitle>
          <div className="space-y-2">
            {recent.map((l) => (
              <button key={l.id} onClick={() => setForm(l.log_date)} className="card block w-full p-4 text-left">
                <p className="text-sm font-semibold">{l.emoji} {formatDateBR(l.log_date)}{l.feelings.length ? ` · ${l.feelings.slice(0, 3).join(", ")}` : ""}</p>
                {l.journal && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{l.journal}</p>}
                {l.gratitude && <p className="mt-1 line-clamp-1 text-xs text-muted">🙏 {l.gratitude}</p>}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="mt-4 text-center text-xs text-muted">O diário é um espaço de autoconhecimento e não substitui acompanhamento psicológico. Em sofrimento intenso, procure ajuda — CVV: ligue 188 (gratuito, 24h).</p>

      <Sheet open={!!form} onClose={() => setForm(null)} title="Como você está?">{form && <MoodForm date={form} onDone={() => setForm(null)} />}</Sheet>
      <Sheet open={help} onClose={() => setHelp(false)} title="Como funciona o Journal">
        <ul className="space-y-2 text-sm text-ink-soft"><li>• Toque em um dia do calendário para registrar ou rever seu humor.</li><li>• Cada emoji mostra como você se sentiu; a chama conta os dias seguidos com registro.</li><li>• Escreva livremente, anote gratidões e acontecimentos.</li><li>• Seus textos ficam só na sua conta e nunca são enviados à IA.</li></ul>
      </Sheet>
    </>
  );
}
