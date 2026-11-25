"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pause, Play, Timer } from "lucide-react";
import { useFocus } from "./focus-provider";
import { formatClock } from "@/lib/domain/pomodoro";

/** Pílula flutuante: mantém o cronômetro visível ao navegar entre telas. */
export function FocusMini() {
  const f = useFocus();
  const path = usePathname();
  if (f.state.status === "parado" || path === "/foco") return null;
  const label = f.state.mode === "foco" ? "Foco" : "Pausa";
  return (
    <div className="no-print fixed bottom-24 right-4 z-40 flex items-center gap-1 rounded-pill bg-orchid py-1 pl-3 pr-1 text-white shadow-soft-lg lg:bottom-6">
      <Link href="/foco" className="flex items-center gap-2 text-sm font-semibold" aria-label={`${label}: ${formatClock(f.remainingMs)} restantes. Abrir modo foco`}>
        <Timer className="size-4 text-iris" aria-hidden />
        <span className="tabular-nums">{formatClock(f.remainingMs)}</span>
      </Link>
      <button onClick={f.state.status === "rodando" ? f.pause : f.start} className="grid size-8 place-items-center rounded-full bg-white/15" aria-label={f.state.status === "rodando" ? "Pausar" : "Continuar"}>
        {f.state.status === "rodando" ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
    </div>
  );
}
