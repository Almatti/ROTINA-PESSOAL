"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, LogOut, CloudOff, RefreshCw } from "lucide-react";
import { BOTTOM_NAV, SIDE_MENU } from "./nav-config";
import { MenuContext } from "./menu-context";
import { LogoMark } from "@/components/brand/logo";
import { useSession } from "@/lib/session";
import { useOutboxCount } from "@/lib/data/store";
import { cn } from "@/components/ui/primitives";
import { FocusMini } from "@/components/focus/focus-mini";
import { ReminderScheduler } from "./reminders";

function isActive(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { profile, displayName, signOut } = useSession();
  const modules = profile?.modules ?? {};
  return (
    <nav aria-label="Menu completo" className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <Link href="/inicio" onClick={onNavigate} className="flex items-center gap-3 px-2">
        <LogoMark size={40} />
        <div>
          <p className="font-display text-xl font-semibold leading-none">Vilma</p>
          <p className="text-xs text-muted">{displayName ? `Olá, ${displayName}` : "Minha vida"}</p>
        </div>
      </Link>
      <ul className="space-y-1">
        {BOTTOM_NAV.map((i) => (
          <li key={i.href}>
            <Link href={i.href} onClick={onNavigate} aria-current={isActive(path, i.href) ? "page" : undefined} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold", isActive(path, i.href) ? "bg-primary-soft text-primary-soft-ink" : "text-ink-soft hover:bg-surface-2")}>
              <i.icon className="size-5" aria-hidden /> {i.label}
            </Link>
          </li>
        ))}
      </ul>
      {SIDE_MENU.map((g) => {
        const items = g.items.filter((i) => !i.module || modules[i.module] !== false);
        if (!items.length) return null;
        return (
          <div key={g.title}>
            <p className="eyebrow px-3 pb-1">{g.title}</p>
            <ul className="space-y-0.5">
              {items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} onClick={onNavigate} aria-current={isActive(path, i.href) ? "page" : undefined} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2 text-sm", isActive(path, i.href) ? "bg-primary-soft font-semibold text-primary-soft-ink" : "text-ink-soft hover:bg-surface-2")}>
                    <i.icon className="size-[18px]" aria-hidden /> {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <button onClick={signOut} className="mt-auto flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-ink-soft hover:bg-surface-2">
        <LogOut className="size-[18px]" aria-hidden /> Sair
      </button>
    </nav>
  );
}

function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal" className="no-print fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] lg:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between rounded-[26px] bg-nav px-2 py-1.5 shadow-soft-lg">
        {BOTTOM_NAV.map((i) => {
          const active = isActive(path, i.href);
          return (
            <li key={i.href} className="flex-1">
              <Link href={i.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[0.7rem] font-medium transition", active ? "text-white" : "text-nav-ink hover:text-white")}>
                <span className={cn("grid h-8 w-12 place-items-center rounded-2xl transition", active && "bg-white/12")}>
                  <i.icon className={cn("size-[22px]", active && "text-iris")} aria-hidden strokeWidth={active ? 2.3 : 1.8} />
                </span>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const pending = useOutboxCount();
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    up();
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
    };
  }, []);
  if (online && !pending) return null;
  return (
    <div role="status" className="mb-3 flex items-center gap-2 rounded-2xl bg-warning-soft px-4 py-2 text-sm text-warning">
      {online ? <RefreshCw className="size-4 animate-spin" aria-hidden /> : <CloudOff className="size-4" aria-hidden />}
      {online ? `Sincronizando ${pending} alteração(ões)…` : `Você está offline.${pending ? ` ${pending} alteração(ões) aguardando sincronização.` : " Suas alterações serão salvas quando a conexão voltar."}`}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile, loading, user } = useSession();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/entrar?next=${encodeURIComponent(path)}`);
    if (!loading && user && profile && !profile.onboarding_completed) router.replace("/onboarding");
  }, [loading, user, profile, router, path]);

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  return (
    <MenuContext.Provider value={{ openMenu: () => setMenuOpen(true) }}>
      <div className="lg:grid lg:grid-cols-[264px_1fr]">
        <aside className="no-print sticky top-0 hidden h-dvh border-r border-line bg-surface/70 backdrop-blur lg:block">
          <SideNav />
        </aside>
        <AnimatePresence>
          {menuOpen && (
            <div className="fixed inset-0 z-[70] lg:hidden">
              <motion.div className="absolute inset-0 bg-orchid/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} />
              <motion.aside
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="absolute inset-y-0 left-0 w-[82%] max-w-[300px] bg-surface shadow-soft-lg"
              >
                <button onClick={() => setMenuOpen(false)} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Fechar menu"><X className="size-5" /></button>
                <SideNav onNavigate={() => setMenuOpen(false)} />
              </motion.aside>
            </div>
          )}
        </AnimatePresence>
        <div className="min-w-0">
          <main id="conteudo" className="mx-auto w-full max-w-5xl px-4 pb-32 sm:px-6 lg:pb-12">
            <OfflineBanner />
            {children}
          </main>
        </div>
      </div>
      <FocusMini />
      <BottomNav />
      <ReminderScheduler />
    </MenuContext.Provider>
  );
}
