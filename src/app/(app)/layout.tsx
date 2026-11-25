"use client";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { SessionProvider } from "@/lib/session";
import { FocusProvider } from "@/components/focus/focus-provider";
import { QuickAddProvider } from "@/components/layout/quick-add";
import { AppShell } from "@/components/layout/app-shell";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Carregando">
      <div className="flex flex-col items-center gap-3">
        <LogoMark size={56} className="animate-pulse" />
        <span className="text-sm text-muted">Carregando…</span>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  // As telas internas dependem de dados locais (cache/offline), relógio e sessão:
  // renderizamos apenas no cliente para evitar divergência de hidratação.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return <Splash />;
  return (
    <SessionProvider>
      <FocusProvider>
        <Suspense>
          <QuickAddProvider>
            <AppShell>{children}</AppShell>
          </QuickAddProvider>
        </Suspense>
      </FocusProvider>
    </SessionProvider>
  );
}
