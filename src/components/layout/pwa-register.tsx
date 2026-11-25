"use client";
import { useEffect } from "react";
import { withBase } from "@/lib/env";

/** Erros típicos de quando o app aberto tenta carregar partes de uma versão que já foi substituída. */
const STALE_RE = /ChunkLoadError|Loading (CSS )?chunk|Failed to fetch dynamically imported module|Importing a module script failed/i;
const GUARD = "vilma:reloaded-for-update";

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(GUARD) || 0);
    if (Date.now() - last < 30_000) return; // evita laço de recarga
    sessionStorage.setItem(GUARD, String(Date.now()));
  } catch {}
  location.reload();
}

export function PwaRegister() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => { if (STALE_RE.test(String(e.message ?? e.error))) reloadOnce(); };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string } | undefined;
      if (STALE_RE.test(`${r?.name ?? ""} ${r?.message ?? r ?? ""}`)) reloadOnce();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(withBase("/sw.js"), { scope: withBase("/") }).then((reg) => {
        // procura versão nova ao voltar para o app
        const check = () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); };
        document.addEventListener("visibilitychange", check);
      }).catch(() => {});
    }
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
