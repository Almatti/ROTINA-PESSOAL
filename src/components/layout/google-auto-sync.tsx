"use client";
import { useEffect, useRef } from "react";
import { isLocalMode } from "@/lib/env";
import { invalidate } from "@/lib/data/store";
import { useTable } from "@/lib/data/hooks";

/** Tabelas cujas alterações devem ir para o Google (Agenda e Tasks). */
const SYNCED = new Set(["tasks", "events", "habits", "habit_logs", "assessments", "project_stages", "chores", "maintenance_items", "outbox"]);
const AFTER_CHANGE_MS = 4000;
const ON_OPEN_EVERY_MS = 10 * 60_000;

/**
 * Sincroniza com o Google automaticamente: poucos segundos depois de cada alteração
 * e ao abrir/voltar para o app (se a última sincronização tiver mais de 10 minutos).
 */
export function GoogleAutoSync() {
  const { data: integrations = [] } = useTable<{ id: string; provider: string; status: string; last_synced_at: string | null }>("integrations", { select: "id,provider,status,last_synced_at" });
  const google = integrations.find((i) => i.provider === "google_calendar" && i.status !== "revogada");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const lastRun = useRef(0);

  useEffect(() => {
    if (isLocalMode || !google) return;
    const run = async () => {
      if (running.current || !navigator.onLine) return;
      running.current = true;
      lastRun.current = Date.now();
      try {
        const r = await fetch("/api/google/sync", { method: "POST" });
        if (r.ok) invalidate("integrations", "tasks", "events", "habit_logs", "assessments", "project_stages", "chores", "maintenance_items");
      } catch {
        /* sem rede: tenta na próxima alteração */
      } finally {
        running.current = false;
      }
    };
    const schedule = (ms: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(run, ms);
    };
    const onMutated = (e: Event) => {
      const tables = (e as CustomEvent<{ tables: string[] }>).detail?.tables ?? [];
      if (tables.some((t) => SYNCED.has(t))) schedule(AFTER_CHANGE_MS);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const last = Math.max(lastRun.current, google.last_synced_at ? new Date(google.last_synced_at).getTime() : 0);
      if (Date.now() - last > ON_OPEN_EVERY_MS) schedule(500);
    };
    window.addEventListener("vilma:mutated", onMutated);
    document.addEventListener("visibilitychange", onVisible);
    onVisible();
    return () => {
      window.removeEventListener("vilma:mutated", onMutated);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [google?.id, google?.last_synced_at]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
