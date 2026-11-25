import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-3 self-start" aria-label="Voltar para o início">
        <LogoMark size={44} />
        <span className="font-display text-2xl font-semibold">Vilma</span>
      </Link>
      <h1 className="font-display text-3xl font-semibold leading-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-ink-soft">{subtitle}</p>}
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-8 text-center text-sm text-ink-soft">{footer}</div>}
    </main>
  );
}
