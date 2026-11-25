"use client";
import { Suspense, type ReactNode } from "react";
import { SessionProvider } from "@/lib/session";
import { FocusProvider } from "@/components/focus/focus-provider";
import { QuickAddProvider } from "@/components/layout/quick-add";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
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
