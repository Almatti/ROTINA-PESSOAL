"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type Kind = "success" | "error" | "info";
interface Toast { id: number; message: string; kind: Kind; action?: { label: string; onClick: () => void } }
interface ToastApi { show: (message: string, kind?: Kind, action?: Toast["action"]) => void }

const Ctx = createContext<ToastApi>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const show = useCallback((message: string, kind: Kind = "info", action?: Toast["action"]) => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l.slice(-2), { id, message, kind, action }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), action ? 6000 : 3800);
  }, []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm shadow-soft-lg"
            >
              {t.kind === "success" ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden /> : t.kind === "error" ? <AlertCircle className="size-5 shrink-0 text-error" aria-hidden /> : <Info className="size-5 shrink-0 text-primary" aria-hidden />}
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button className="font-semibold text-primary" onClick={() => { t.action!.onClick(); setItems((l) => l.filter((x) => x.id !== t.id)); }}>
                  {t.action.label}
                </button>
              )}
              <button aria-label="Fechar aviso" className="text-muted" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
