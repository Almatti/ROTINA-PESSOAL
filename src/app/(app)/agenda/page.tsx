"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Search, Plus, AlertTriangle, RefreshCw, Repeat, MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Segmented, Input, EmptyState, cn, Badge } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { EventForm } from "@/components/forms/event-form";
import { MonthGrid } from "@/components/calendar-bits";
import { useSession } from "@/lib/session";
import { useEvents, useCategories, useTable } from "@/lib/data/hooks";
import { expandEvents, countByDay, type Occurrence } from "@/lib/calendar";
import { mutate } from "@/lib/data/store";
import { useToast } from "@/components/ui/toast";
import { addDays, addMonths, startOfWeek, monthStart, monthEnd, zonedToUtc, localTimeHHMM, formatShortLabel, formatMonthYear, WEEKDAY_SHORT, MONTHS_SHORT, weekdayOf, localDateISO, MONTHS } from "@/lib/domain/dates";
import { findConflicts } from "@/lib/domain/conflicts";
import { describeRecurrence } from "@/lib/domain/recurrence";
import type { CalendarEvent } from "@/lib/types";
import { isLocalMode } from "@/lib/env";

type View = "dia" | "semana" | "mes" | "ano";
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06h–23h
const HOUR_PX = 56;

function rangeFor(view: View, anchor: string): [string, string] {
  if (view === "dia") return [anchor, anchor];
  if (view === "semana") { const s = startOfWeek(anchor); return [s, addDays(s, 6)]; }
  if (view === "mes") { const s = startOfWeek(monthStart(anchor)); return [s, addDays(startOfWeek(monthEnd(anchor)), 6)]; }
  return [`${anchor.slice(0, 4)}-01-01`, `${anchor.slice(0, 4)}-12-31`];
}

function AgendaInner() {
  const { today, tz } = useSession();
  const params = useSearchParams();
  const toast = useToast();
  const [view, setView] = useState<View>("dia");
  const [anchor, setAnchor] = useState(params.get("dia") ?? today);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null);
  const [creating, setCreating] = useState<{ date: string; time?: string } | null>(null);
  const [detail, setDetail] = useState<Occurrence | null>(null);
  const [deleting, setDeleting] = useState<Occurrence | null>(null);
  const { data: categories } = useCategories("evento");
  const { data: integrations = [] } = useTable<{ provider: string; status: string; last_synced_at: string | null }>("integrations", { select: "provider,status,last_synced_at" });
  const google = integrations.find((i) => i.provider === "google_calendar");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const d = params.get("dia");
    if (d) setAnchor(d);
  }, [params]);

  const [from, to] = rangeFor(view, anchor);
  const { data: events = [] } = useEvents(zonedToUtc(from, "00:00", tz).toISOString(), zonedToUtc(addDays(to, 1), "00:00", tz).toISOString());
  const occ = useMemo(() => expandEvents(events, from, to, tz), [events, from, to, tz]);
  const filtered = query.trim() ? occ.filter((o) => `${o.title} ${o.location ?? ""} ${o.description ?? ""}`.toLowerCase().includes(query.toLowerCase())) : occ;
  const conflicts = useMemo(() => {
    const set = new Set<string>();
    for (const [a, b] of findConflicts(filtered.map((o) => ({ id: o.id + o.occStart, title: o.title, starts_at: o.occStart, ends_at: o.occEnd, all_day: o.all_day })))) { set.add(a.id); set.add(b.id); }
    return set;
  }, [filtered]);
  const colorOf = (o: CalendarEvent) => o.color ?? categories.find((c) => c.id === o.category_id)?.color ?? "#7451A6";

  const move = (n: number) => setAnchor((a) => (view === "dia" ? addDays(a, n) : view === "semana" ? addDays(a, 7 * n) : view === "mes" ? addMonths(monthStart(a), n, 1) : addMonths(a, 12 * n, 1)));
  const title = view === "dia" ? formatShortLabel(anchor) : view === "semana" ? `${formatShortLabel(from)} – ${formatShortLabel(to)}` : view === "mes" ? formatMonthYear(anchor) : anchor.slice(0, 4);

  /** Arrastar e soltar (semana/dia): move o compromisso mantendo a duração. */
  async function dropOn(date: string, hour: number | null, payload: string) {
    const [id, occStart] = payload.split("|");
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    if (ev.recurrence) return toast.show("Para mover um compromisso recorrente, edite-o.", "info");
    const dur = new Date(ev.ends_at).getTime() - new Date(ev.starts_at).getTime();
    const time = hour === null ? localTimeHHMM(new Date(occStart), tz) : `${String(hour).padStart(2, "0")}:${localTimeHHMM(new Date(occStart), tz).slice(3)}`;
    const start = zonedToUtc(date, ev.all_day ? "00:00" : time, tz);
    await mutate({ action: "update", table: "events", id, values: { starts_at: start.toISOString(), ends_at: new Date(start.getTime() + dur).toISOString(), local_updated_at: new Date().toISOString() } });
    toast.show("Compromisso movido.", "success");
  }

  async function syncGoogle() {
    setSyncing(true);
    try {
      const res = await fetch("/api/google/sync", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Falha na sincronização");
      toast.show(`Google Agenda sincronizado: ${j.imported} recebido(s), ${j.exported} enviado(s).`, "success");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setSyncing(false);
    }
  }

  const EventChip = ({ o, tall }: { o: Occurrence; tall?: boolean }) => (
    <button
      draggable={!o.recurrence}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", `${o.id}|${o.occStart}`)}
      onClick={() => setDetail(o)}
      className={cn("w-full truncate rounded-xl px-2 py-1 text-left text-xs font-semibold text-white shadow-soft-sm", tall && "h-full", conflicts.has(o.id + o.occStart) && "ring-2 ring-warning")}
      style={{ background: colorOf(o) }}
      title={o.title}
    >
      {!o.all_day && <span className="mr-1 opacity-80">{localTimeHHMM(new Date(o.occStart), tz)}</span>}
      {o.title}
    </button>
  );

  const DayColumn = ({ date }: { date: string }) => {
    const list = filtered.filter((o) => !o.all_day && localDateISO(new Date(o.occStart), tz) === date);
    const nowMin = (() => { const p = new Date(); return date === today ? Number(localTimeHHMM(p, tz).slice(0, 2)) * 60 + Number(localTimeHHMM(p, tz).slice(3)) : null; })();
    return (
      <div className="relative border-l border-line" style={{ height: HOURS.length * HOUR_PX }}>
        {HOURS.map((h) => (
          <div key={h} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void dropOn(date, h, e.dataTransfer.getData("text/plain")); }} onDoubleClick={() => setCreating({ date, time: `${String(h).padStart(2, "0")}:00` })} className="border-b border-dashed border-line/70" style={{ height: HOUR_PX }} />
        ))}
        {nowMin !== null && nowMin >= 360 && <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((nowMin - 360) / 60) * HOUR_PX }}><span className="size-2 rounded-full bg-error" /><span className="h-px flex-1 bg-error" /></div>}
        {list.map((o) => {
          const s = new Date(o.occStart);
          const e = new Date(o.occEnd);
          const sMin = Number(localTimeHHMM(s, tz).slice(0, 2)) * 60 + Number(localTimeHHMM(s, tz).slice(3));
          const durMin = Math.max(25, (e.getTime() - s.getTime()) / 60000);
          const top = Math.max(0, ((sMin - 360) / 60) * HOUR_PX);
          return (
            <div key={o.id + o.occStart} className="absolute inset-x-1 z-[5]" style={{ top, height: Math.min((durMin / 60) * HOUR_PX - 2, HOURS.length * HOUR_PX - top) }}>
              <EventChip o={o} tall />
            </div>
          );
        })}
      </div>
    );
  };

  const allDay = (dates: string[]) => {
    const list = filtered.filter((o) => o.all_day && dates.includes(o.occDate));
    if (!list.length) return null;
    return <div className="mb-2 flex flex-wrap gap-1">{list.map((o) => <div key={o.id + o.occStart} className="min-w-28 flex-1"><EventChip o={o} /></div>)}</div>;
  };

  return (
    <>
      <PageHeader
        title="Minha agenda"
        icon={<CalendarDays className="size-5" />}
        subtitle={google?.status === "ativa" ? "Google Agenda conectado" : undefined}
        actions={<Button size="sm" onClick={() => setCreating({ date: anchor })} icon={<Plus className="size-4" />}>Novo</Button>}
      />
      <div className="space-y-3">
        <Segmented label="Visualização" value={view} onChange={setView} options={[{ value: "dia", label: "Dia" }, { value: "semana", label: "Semana" }, { value: "mes", label: "Mês" }, { value: "ano", label: "Ano" }]} />
        <div className="flex items-center gap-2">
          <button onClick={() => move(-1)} className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary" aria-label="Anterior"><ChevronLeft className="size-5" /></button>
          <p className="flex-1 text-center font-bold capitalize">{title}</p>
          <button onClick={() => move(1)} className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary" aria-label="Próximo"><ChevronRight className="size-5" /></button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(today)}>Hoje</Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar compromissos" className="pl-9" aria-label="Buscar compromissos" />
        </div>
        {conflicts.size > 0 && <p role="status" className="flex items-center gap-2 rounded-2xl bg-warning-soft px-3 py-2 text-sm text-warning"><AlertTriangle className="size-4" aria-hidden />Há compromissos com horários sobrepostos (destacados).</p>}
      </div>

      <section className="card mt-4 overflow-hidden p-3">
        {view === "dia" && (
          <>
            {allDay([anchor])}
            <div className="grid grid-cols-[3rem_1fr]">
              <div>{HOURS.map((h) => <div key={h} className="pr-2 text-right text-[0.7rem] text-muted" style={{ height: HOUR_PX }}>{String(h).padStart(2, "0")}:00</div>)}</div>
              <DayColumn date={anchor} />
            </div>
            <p className="mt-2 text-center text-xs text-muted">Dica: toque duas vezes num horário para criar; arraste para mover.</p>
          </>
        )}
        {view === "semana" && (
          <div className="scroll-x">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[3rem_repeat(7,1fr)] pb-2">
                <span />
                {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => (
                  <button key={d} onClick={() => { setAnchor(d); setView("dia"); }} className={cn("rounded-xl py-1 text-center text-xs", d === today && "bg-primary-soft font-bold text-primary")}>
                    {WEEKDAY_SHORT[weekdayOf(d)]} <span className="block text-base font-bold">{Number(d.slice(8))}</span>
                  </button>
                ))}
              </div>
              {allDay(Array.from({ length: 7 }, (_, i) => addDays(from, i)))}
              <div className="grid grid-cols-[3rem_repeat(7,1fr)]">
                <div>{HOURS.map((h) => <div key={h} className="pr-2 text-right text-[0.7rem] text-muted" style={{ height: HOUR_PX }}>{String(h).padStart(2, "0")}h</div>)}</div>
                {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => <DayColumn key={d} date={d} />)}
              </div>
            </div>
          </div>
        )}
        {view === "mes" && (
          <MonthGrid
            month={anchor}
            today={today}
            selected={anchor}
            onSelect={(d) => { setAnchor(d); setView("dia"); }}
            renderDay={(d) => {
              const list = filtered.filter((o) => o.occDate === d || localDateISO(new Date(o.occStart), tz) === d);
              return (
                <div className="flex w-full flex-col items-center" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void dropOn(d, null, e.dataTransfer.getData("text/plain")); }}>
                  <span className="text-sm font-semibold">{Number(d.slice(8))}</span>
                  <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">{list.slice(0, 3).map((o) => <span key={o.id + o.occStart} className="size-1.5 rounded-full" style={{ background: colorOf(o) }} />)}</div>
                </div>
              );
            }}
          />
        )}
        {view === "ano" && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, m) => `${anchor.slice(0, 4)}-${String(m + 1).padStart(2, "0")}-01`).map((m) => {
              const counts = countByDay(filtered, m, monthEnd(m), tz);
              return (
                <button key={m} onClick={() => { setAnchor(m); setView("mes"); }} className="rounded-2xl p-2 text-left hover:bg-surface-2" aria-label={`Abrir ${MONTHS[Number(m.slice(5, 7)) - 1]}`}>
                  <p className="mb-1 text-sm font-bold capitalize">{MONTHS_SHORT[Number(m.slice(5, 7)) - 1]}</p>
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: weekdayOf(m) }, (_, i) => <span key={`b${i}`} />)}
                    {Array.from({ length: Number(monthEnd(m).slice(8)) }, (_, i) => {
                      const d = `${m.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
                      const c = counts[d] ?? 0;
                      return <span key={d} className={cn("grid aspect-square place-items-center rounded text-[0.55rem]", d === today ? "bg-primary text-primary-ink" : c ? "bg-primary-soft text-primary-soft-ink" : "text-muted")}>{i + 1}</span>;
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {(view === "mes" || view === "ano" || query) && (
        <section className="mt-4 space-y-2" aria-label="Lista de compromissos">
          <h2 className="text-sm font-bold">{query ? "Resultados" : "No período"}</h2>
          {filtered.length === 0 ? <EmptyState icon="📅" title="Nenhum compromisso" /> : filtered.slice(0, 60).map((o) => (
            <button key={o.id + o.occStart} onClick={() => setDetail(o)} className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-soft-sm">
              <span className="h-10 w-1.5 rounded-full" style={{ background: colorOf(o) }} />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{o.title}</p><p className="text-xs text-muted">{formatShortLabel(localDateISO(new Date(o.occStart), tz))} · {o.all_day ? "Dia inteiro" : `${localTimeHHMM(new Date(o.occStart), tz)}–${localTimeHHMM(new Date(o.occEnd), tz)}`}</p></div>
            </button>
          ))}
        </section>
      )}

      {!isLocalMode && <section className="card mt-4 flex items-center gap-3 p-4">
        <span className="grid size-10 place-items-center rounded-xl bg-info-soft text-sm font-bold text-info">31</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Google Agenda</p>
          <p className="text-xs text-muted">{google?.status === "ativa" ? `Conectado${google.last_synced_at ? ` · última sincronização ${new Date(google.last_synced_at).toLocaleString("pt-BR", { timeZone: tz })}` : ""}` : google?.status === "erro" ? "Erro na sincronização — reconecte" : "Sincronize seus compromissos nos dois sentidos."}</p>
        </div>
        {google?.status === "ativa" ? <Button size="sm" variant="soft" loading={syncing} onClick={syncGoogle} icon={<RefreshCw className="size-4" />}>Sincronizar</Button> : <Link href="/configuracoes#integracoes" className="text-sm font-semibold text-primary">Conectar</Link>}
      </section>}

      <Sheet open={!!creating} onClose={() => setCreating(null)} title="Novo compromisso">{creating && <EventForm onDone={() => setCreating(null)} defaults={{ date: creating.date, time: creating.time }} />}</Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar compromisso">{editing && <EventForm event={editing} onDone={() => setEditing(null)} />}</Sheet>
      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? ""} footer={detail && (
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 text-error" onClick={() => { setDeleting(detail); setDetail(null); }}>Excluir</Button>
          <Button className="flex-1" onClick={() => { setEditing(events.find((e) => e.id === detail.id) ?? null); setDetail(null); }}>Editar</Button>
        </div>
      )}>
        {detail && (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{formatShortLabel(localDateISO(new Date(detail.occStart), tz))} · {detail.all_day ? "Dia inteiro" : `${localTimeHHMM(new Date(detail.occStart), tz)} – ${localTimeHHMM(new Date(detail.occEnd), tz)}`}</p>
            {detail.recurrence && <p className="flex items-center gap-1 text-muted"><Repeat className="size-4" aria-hidden />{describeRecurrence(detail.recurrence)}</p>}
            {detail.location && <p className="flex items-center gap-1 text-muted"><MapPin className="size-4" aria-hidden />{detail.location}</p>}
            {detail.description && <p className="whitespace-pre-wrap">{detail.description}</p>}
            {detail.source === "google" && <Badge tone="info">Google Agenda</Badge>}
            {conflicts.has(detail.id + detail.occStart) && <p className="flex items-center gap-1 text-warning"><AlertTriangle className="size-4" aria-hidden />Conflita com outro compromisso.</p>}
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={!!deleting}
        danger
        title="Excluir compromisso?"
        message={deleting?.recurrence ? "Este compromisso se repete. Todas as ocorrências serão excluídas." : "Esta ação não pode ser desfeita."}
        confirmLabel="Excluir"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const ev = deleting!;
          // eventos do Google são marcados como excluídos para propagar na sincronização
          if (ev.google_event_id) await mutate({ action: "update", table: "events", id: ev.id, values: { deleted_at: new Date().toISOString(), local_updated_at: new Date().toISOString() } });
          else await mutate({ action: "delete", table: "events", id: ev.id });
          setDeleting(null);
          toast.show("Compromisso excluído.", "success");
        }}
      />
    </>
  );
}

export default function AgendaPage() {
  return <Suspense><AgendaInner /></Suspense>;
}
