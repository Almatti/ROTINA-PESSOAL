"use client";
import Link from "next/link";
import { clsx } from "clsx";
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, ChevronRight } from "lucide-react";

export const cn = clsx;

type Variant = "primary" | "soft" | "ghost" | "outline" | "danger" | "dark";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink shadow-soft hover:brightness-110",
  soft: "bg-primary-soft text-primary-soft-ink hover:brightness-[0.97]",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-2",
  outline: "border border-line bg-surface text-ink hover:bg-surface-2",
  danger: "bg-error text-white hover:brightness-110",
  dark: "bg-orchid text-white hover:brightness-125 dark:bg-surface-3",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-pill font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" && "h-9 px-3.5 text-sm",
        size === "md" && "h-11 px-5 text-[0.95rem]",
        size === "lg" && "h-13 px-6 text-base",
        size === "icon" && "size-10 shrink-0",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function Card({ className, children, as: As = "div", ...rest }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn("card p-4", className)} {...rest}>
      {children}
    </As>
  );
}

/** Cartão inteiro clicável que leva a um módulo. */
export function LinkCard({ href, className, children, label }: { href: string; className?: string; children: ReactNode; label?: string }) {
  return (
    <Link href={href} aria-label={label} className={cn("card card-hover block p-4", className)}>
      {children}
    </Link>
  );
}

export function SeeMore({ children = "Ver mais" }: { children?: ReactNode }) {
  return (
    <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
      {children} <ChevronRight className="size-4" aria-hidden />
    </span>
  );
}

export function Chip({ active, children, className, ...rest }: { active?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-medium transition",
        active ? "border-transparent bg-orchid text-white dark:bg-primary dark:text-primary-ink" : "border-line bg-surface text-ink-soft hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "primary", className }: { children: ReactNode; tone?: "primary" | "success" | "error" | "warning" | "info" | "neutral"; className?: string }) {
  const tones = {
    primary: "bg-primary-soft text-primary-soft-ink",
    success: "bg-success-soft text-success",
    error: "bg-error-soft text-error",
    warning: "bg-warning-soft text-warning",
    info: "bg-info-soft text-info",
    neutral: "bg-surface-2 text-ink-soft",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide", tones[tone], className)}>{children}</span>;
}

interface FieldProps { label: string; error?: string | null; hint?: string; children: (id: string, describedBy?: string) => ReactNode; className?: string }
export function Field({ label, error, hint, children, className }: FieldProps) {
  const id = useId();
  const msgId = error || hint ? `${id}-msg` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      {children(id, msgId)}
      {(error || hint) && (
        <p id={msgId} className={cn("mt-1 text-xs", error ? "text-error" : "text-muted")} role={error ? "alert" : undefined}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn("field", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn("field appearance-none bg-[length:16px] bg-[right_0.8rem_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%2388708E' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn("field min-h-24 resize-y", className)} {...rest} />;
});

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative h-7 w-12 shrink-0 rounded-pill transition", checked ? "bg-primary" : "bg-surface-3", disabled && "opacity-50")}
      >
        <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-all", checked ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-pill bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("flex-1 rounded-pill px-3 py-2 text-sm font-semibold transition", value === o.value ? "bg-surface text-ink shadow-soft-sm" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, className, tone = "primary", label }: { value: number; className?: string; tone?: "primary" | "success" | "error" | "warning" | "info" | "dark"; label?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const tones = { primary: "bg-primary", success: "bg-success", error: "bg-error", warning: "bg-warning", info: "bg-info", dark: "bg-orchid dark:bg-primary" };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-pill bg-surface-3", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-pill transition-[width] duration-700 ease-out", tones[tone])} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Ring({ value, size = 96, stroke = 10, color = "var(--primary)", track = "var(--surface-3)", children, label }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-surface-3/70", className)} aria-hidden />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line px-5 py-8 text-center">
      {icon && <div className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-2xl text-primary">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-error-soft px-4 py-3 text-sm text-error">
      <span>{message}</span>
      {onRetry && <button className="font-semibold underline" onClick={onRetry}>Tentar de novo</button>}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2 mt-6 flex items-center justify-between gap-3", className)}>
      <h2 className="text-base font-bold">{children}</h2>
      {action}
    </div>
  );
}

export function Stat({ icon, label, value, sub, tone }: { icon?: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: "success" | "error" | "primary" }) {
  return (
    <div className="card p-4">
      {icon && <div className="mb-1 text-lg" aria-hidden>{icon}</div>}
      <p className="eyebrow">{label}</p>
      <p className={cn("mt-1 text-xl font-bold", tone === "success" && "text-success", tone === "error" && "text-error", tone === "primary" && "text-primary")}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
