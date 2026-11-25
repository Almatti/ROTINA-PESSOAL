"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, CalendarDays, CheckSquare, Wallet, Moon, Heart, Sparkles, Plus, Bell, SlidersHorizontal, BarChart3, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { useSession } from "@/lib/session";
import { useMenu } from "@/components/layout/menu-context";
import { useQuickAdd } from "@/components/layout/quick-add";
import { WeekStrip } from "@/components/calendar-bits";
import { DayProgress, useWidgetRenderer } from "@/components/dashboard/widgets";
import { DEFAULT_WIDGETS, resolveWidgets } from "@/components/dashboard/widgets-config";
import { Sheet } from "@/components/ui/sheet";
import { Button, Toggle } from "@/components/ui/primitives";
import { useNotifications, usePoints, useEvents } from "@/lib/data/hooks";
import { formatShortLabel, greeting, addDays, startOfWeek, zonedToUtc } from "@/lib/domain/dates";
import { expandEvents, countByDay } from "@/lib/calendar";
import { useToast } from "@/components/ui/toast";
import { LogoMark } from "@/components/brand/logo";

const SHORTCUTS = [
  { href: "/agenda", label: "Agenda", icon: CalendarDays, tone: "bg-primary-soft text-primary" },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare, tone: "bg-warning-soft text-warning" },
  { href: "/financas", label: "Finanças", icon: Wallet, tone: "bg-success-soft text-success" },
  { href: "/sono", label: "Sono", icon: Moon, tone: "bg-info-soft text-info" },
  { href: "/bem-estar", label: "Bem-estar", icon: Heart, tone: "bg-error-soft text-error" },
];

const ENCOURAGE = ["Você está fazendo um ótimo trabalho 💜", "Um passo de cada vez já é progresso.", "Cuide de você hoje também ✨", "Pequenas rotinas, grandes mudanças."];

export default function Dashboard() {
  const { displayName, hour, today, profile, updateProfile, tz } = useSession();
  const { openMenu } = useMenu();
  const qa = useQuickAdd();
  const toast = useToast();
  const [day, setDay] = useState(today);
  const [customize, setCustomize] = useState(false);
  const { data: notifications = [] } = useNotifications();
  const { total: points } = usePoints();
  const unread = notifications.filter((n) => !n.read_at).length;
  const render = useWidgetRenderer(day);
  const widgets = resolveWidgets(profile?.dashboard_widgets);
  const [draft, setDraft] = useState(widgets);
  const gamification = profile?.modules?.gamificacao !== false;
  const ws = startOfWeek(day);
  const { data: weekEvents = [] } = useEvents(zonedToUtc(ws, "00:00", tz).toISOString(), zonedToUtc(addDays(ws, 7), "00:00", tz).toISOString());
  const marks = countByDay(expandEvents(weekEvents, ws, addDays(ws, 6), tz), ws, addDays(ws, 6), tz);

  return (
    <div className="pt-[max(env(safe-area-inset-top),0.75rem)]">
      <header className="flex items-center gap-3">
        <button onClick={openMenu} aria-label="Abrir menu" className="grid size-10 place-items-center rounded-full bg-surface text-primary shadow-soft-sm lg:hidden"><Menu className="size-5" /></button>
        <span className="hidden lg:block"><LogoMark size={36} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{greeting(hour)}{displayName ? `, ${displayName}` : ""}</h1>
          <p className="text-sm capitalize text-muted">{formatShortLabel(today)}</p>
        </div>
        {gamification && (
          <Link href="/conquistas" className="flex h-9 items-center gap-1 rounded-pill bg-orchid px-3 text-sm font-semibold text-white dark:bg-surface-3" aria-label={`${points} pontos`}>
            <Sparkles className="size-4 text-iris" aria-hidden /> {points}
          </Link>
        )}
        <Link href="/notificacoes" className="relative grid size-10 place-items-center rounded-full bg-surface shadow-soft-sm" aria-label={`Notificações${unread ? `: ${unread} não lidas` : ""}`}>
          <Bell className="size-5 text-ink-soft" />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-error px-1 text-[0.65rem] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
        </Link>
      </header>

      <nav aria-label="Atalhos" className="scroll-x -mx-4 mt-5 flex gap-3 px-4 sm:justify-between">
        {SHORTCUTS.map((s) => (
          <Link key={s.href} href={s.href} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-xs font-medium text-ink-soft">
            <span className={`grid size-14 place-items-center rounded-full shadow-soft-sm ${s.tone}`}><s.icon className="size-6" aria-hidden /></span>
            {s.label}
          </Link>
        ))}
      </nav>

      <Link href="/vilma" className="mt-5 flex items-center gap-3 rounded-card bg-gradient-to-r from-wisteria/70 via-plum/50 to-primary-soft p-3.5 shadow-soft-sm dark:from-primary-soft dark:via-surface-2 dark:to-surface-2">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface"><LogoMark size={40} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Vilma <span className="font-normal text-ink-soft">· sua assistente</span> ✨</p>
          <p className="truncate text-xs text-ink-soft">{ENCOURAGE[new Date().getDate() % ENCOURAGE.length]} Posso te ajudar hoje?</p>
        </div>
        <span className="rounded-pill bg-surface px-3.5 py-2 text-sm font-semibold text-primary">Conversar</span>
      </Link>

      <section className="card mt-4 space-y-4 p-4" aria-label="Seu dia">
        <div className="flex items-center justify-between text-xs">
          <Link href="/vilma?pedido=revisao-semana" className="inline-flex items-center gap-1 rounded-pill bg-surface-2 px-3 py-1.5 font-semibold text-ink-soft"><BarChart3 className="size-3.5" aria-hidden />Revisão da semana</Link>
          <Link href="/agenda" className="inline-flex items-center gap-0.5 font-semibold text-primary">Calendário <ChevronRight className="size-3.5" aria-hidden /></Link>
        </div>
        <WeekStrip selected={day} onSelect={setDay} today={today} marks={marks} />
        <DayProgress day={day} />
      </section>

      <button onClick={() => qa.open()} className="mt-4 flex w-full items-center gap-3 rounded-card bg-primary-soft p-4 text-left transition hover:brightness-[0.98]">
        <span className="grid size-10 place-items-center rounded-full bg-surface text-primary shadow-soft-sm"><Plus className="size-5" aria-hidden /></span>
        <span><span className="block font-bold text-primary-soft-ink">Nova ação</span><span className="block text-xs text-ink-soft">Tarefas, hábitos, compromissos, gastos…</span></span>
      </button>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-bold">{day === today ? "Hoje" : formatShortLabel(day)}</h2>
        <button onClick={() => { setDraft(widgets); setCustomize(true); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"><SlidersHorizontal className="size-4" aria-hidden />Personalizar</button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:grid-cols-3">
        {widgets.filter((w) => w.visible && (w.key !== "conquistas" || gamification)).map((w) => <div key={w.key}>{render(w.key)}</div>)}
      </div>

      <Sheet open={customize} onClose={() => setCustomize(false)} title="Personalizar tela inicial" footer={
        <Button className="w-full" onClick={async () => { await updateProfile({ dashboard_widgets: draft }); setCustomize(false); toast.show("Tela inicial atualizada.", "success"); }}>Salvar</Button>
      }>
        <p className="mb-3 text-sm text-muted">Escolha os cartões e a ordem em que aparecem.</p>
        <ul className="divide-y divide-line">
          {draft.map((w, i) => (
            <li key={w.key} className="flex items-center gap-2">
              <div className="flex flex-col">
                <button aria-label="Mover para cima" disabled={i === 0} onClick={() => setDraft((d) => { const n = [...d]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} className="p-1 text-muted disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button aria-label="Mover para baixo" disabled={i === draft.length - 1} onClick={() => setDraft((d) => { const n = [...d]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} className="p-1 text-muted disabled:opacity-30"><ArrowDown className="size-4" /></button>
              </div>
              <div className="flex-1"><Toggle checked={w.visible} onChange={(b) => setDraft((d) => d.map((x) => (x.key === w.key ? { ...x, visible: b } : x)))} label={DEFAULT_WIDGETS.find((d) => d.key === w.key)?.label ?? w.key} /></div>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
