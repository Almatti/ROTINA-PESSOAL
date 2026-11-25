import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main id="conteudo" className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/" className="inline-flex items-center gap-2"><LogoMark size={36} /><span className="font-display text-xl font-semibold">Vilma</span></Link>
      <h1 className="mt-8 font-display text-4xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">Última atualização: {updated}</p>
      <article className="mt-8 space-y-5 leading-relaxed text-ink-soft [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">{children}</article>
    </main>
  );
}
