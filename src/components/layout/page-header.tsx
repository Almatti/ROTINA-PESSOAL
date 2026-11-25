"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Menu, ArrowLeft } from "lucide-react";
import { useMenu } from "./menu-context";

/** Cabeçalho das telas: botão de menu (mobile), título, ações e voltar opcional. */
export function PageHeader({ title, icon, actions, back, subtitle }: { title: ReactNode; icon?: ReactNode; actions?: ReactNode; back?: string; subtitle?: ReactNode }) {
  const { openMenu } = useMenu();
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-3 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] glass sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-3">
        {back ? (
          <Link href={back} aria-label="Voltar" className="grid size-10 place-items-center rounded-full bg-surface shadow-soft-sm"><ArrowLeft className="size-5" /></Link>
        ) : (
          <button onClick={openMenu} aria-label="Abrir menu" className="grid size-10 place-items-center rounded-full bg-surface text-primary shadow-soft-sm lg:hidden"><Menu className="size-5" /></button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {icon && <span className="text-primary" aria-hidden>{icon}</span>}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
