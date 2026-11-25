"use client";
/**
 * Agendador de lembretes local: enquanto o app está aberto (ou instalado e
 * em segundo plano recente), dispara notificações de compromissos e tarefas
 * com lembrete. Lembretes com o app totalmente fechado exigem Web Push
 * (ver "Integrações pendentes" no README).
 */
import { useEffect, useRef } from "react";
import { useSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { localTimeHHMM, zonedToUtc } from "@/lib/domain/dates";

export function ReminderScheduler() {
  const { user, profile, today, tz } = useSession();
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !profile) return;
    try {
      fired.current = new Set(JSON.parse(localStorage.getItem("vilma:fired") || "[]"));
    } catch {}
    const prefs = profile.notification_prefs ?? {};
    const check = async () => {
      if (!navigator.onLine || typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const sb = getSupabase();
      const now = Date.now();
      const horizon = new Date(now + 24 * 3600_000).toISOString();
      const remember = (k: string) => {
        fired.current.add(k);
        localStorage.setItem("vilma:fired", JSON.stringify([...fired.current].slice(-300)));
      };
      if (prefs.compromissos !== false) {
        const { data: events } = await sb.from("events").select("id,title,starts_at,reminder_minutes").is("deleted_at", null).gte("starts_at", new Date(now).toISOString()).lte("starts_at", horizon).not("reminder_minutes", "is", null);
        for (const e of events ?? []) {
          const at = new Date(e.starts_at).getTime() - (e.reminder_minutes ?? 0) * 60000;
          const k = `ev:${e.id}:${e.starts_at}`;
          if (at <= now && !fired.current.has(k)) {
            remember(k);
            await notify("Compromisso chegando", `${e.title} às ${localTimeHHMM(new Date(e.starts_at), tz)}`, "/agenda", k);
          }
        }
      }
      if (prefs.tarefas !== false) {
        const { data: tasks } = await sb.from("tasks").select("id,title,due_date,due_time,reminder_minutes").eq("due_date", today).in("status", ["pendente", "em_andamento"]).not("due_time", "is", null).not("reminder_minutes", "is", null);
        for (const t of tasks ?? []) {
          const at = zonedToUtc(t.due_date, t.due_time.slice(0, 5), tz).getTime() - (t.reminder_minutes ?? 0) * 60000;
          const k = `tk:${t.id}:${t.due_date}`;
          if (at <= now && at > now - 3600_000 && !fired.current.has(k)) {
            remember(k);
            await notify("Lembrete de tarefa", t.title, "/meu-plano", k);
          }
        }
      }
    };
    void check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [user, profile, today, tz]);

  return null;
}
