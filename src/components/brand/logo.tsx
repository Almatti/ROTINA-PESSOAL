"use client";
import { useId } from "react";

/** Monograma da Vilma: "V" estilizado com pétala, em gradiente orquídea. */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  const gid = `vg${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Vilma">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9A7BC8" />
          <stop offset="1" stopColor="#5E3F8F" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="#F7F4FB" />
      <path d="M17 18c4 0 6 2 7.5 6L32 42l7.5-18c1.5-4 3.5-6 7.5-6" stroke={`url(#${gid})`} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M32 47c-3.2-3.4-3.2-7 0-10 3.2 3 3.2 6.6 0 10Z" fill="#BAAAC8" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-display text-2xl font-semibold tracking-tight">Vilma</span>
      <span className="ml-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">minha vida</span>
    </span>
  );
}
