"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { CheckSquare, CalendarDays, ArrowDownCircle, ArrowUpCircle, Repeat, NotebookPen, Droplets, Moon, Smile, Wand2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { TaskForm } from "@/components/forms/task-form";
import { EventForm } from "@/components/forms/event-form";
import { TransactionForm } from "@/components/forms/transaction-form";
import { HabitForm } from "@/components/forms/habit-form";
import { SleepForm } from "@/components/modules/sleep-form";
import { MoodForm } from "@/components/modules/mood-form";
import { parseQuickCommand, type QuickParse } from "@/lib/domain/nlp";
import { useSession } from "@/lib/session";
import { addWater } from "@/lib/data/actions";
import { mutate } from "@/lib/data/store";
import { useToast } from "@/components/ui/toast";

export type QuickKind = "tarefa" | "compromisso" | "despesa" | "receita" | "habito" | "nota" | "agua" | "sono" | "humor";

interface Api { open: (kind?: QuickKind, prefill?: Partial<QuickParse>) => void }
const Ctx = createContext<Api>({ open: () => {} });
export const useQuickAdd = () => useContext(Ctx);

const TILES: { kind: QuickKind; label: string; icon: typeof CheckSquare; tone: string }[] = [
  { kind: "tarefa", label: "Tarefa", icon: CheckSquare, tone: "bg-primary-soft text-primary-soft-ink" },
  { kind: "compromisso", label: "Compromisso", icon: CalendarDays, tone: "bg-info-soft text-info" },
  { kind: "despesa", label: "Gasto", icon: ArrowDownCircle, tone: "bg-error-soft text-error" },
  { kind: "receita", label: "Entrada", icon: ArrowUpCircle, tone: "bg-success-soft text-success" },
  { kind: "habito", label: "Hábito", icon: Repeat, tone: "bg-primary-soft text-primary-soft-ink" },
  { kind: "nota", label: "Nota", icon: NotebookPen, tone: "bg-warning-soft text-warning" },
  { kind: "agua", label: "Água", icon: Droplets, tone: "bg-info-soft text-info" },
  { kind: "sono", label: "Sono", icon: Moon, tone: "bg-primary-soft text-primary-soft-ink" },
  { kind: "humor", label: "Humor", icon: Smile, tone: "bg-warning-soft text-warning" },
];

const TITLES: Record<QuickKind, string> = {
  tarefa: "Nova tarefa", compromisso: "Novo compromisso", despesa: "Novo gasto", receita: "Nova entrada", habito: "Novo hábito",
  nota: "Nova nota", agua: "Registrar água", sono: "Registrar noite", humor: "Como você está?",
};

function QuickNote({ initial, onDone }: { initial?: string; onDone: () => void }) {
  const [title, setTitle] = useState(initial ?? "");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!title.trim() && !content.trim()) return toast.show("Escreva algo na nota.", "error");
      setSaving(true);
      try {
        await mutate({ action: "insert", table: "notes", values: { title: title.trim(), content, kind: "ideia" } });
        toast.show("Nota salva!", "success");
        onDone();
      } catch {
        toast.show("Não foi possível salvar.", "error");
      } finally {
        setSaving(false);
      }
    }}>
      <Field label="Título">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />}</Field>
      <Field label="Conteúdo">{(id) => <Textarea id={id} value={content} onChange={(e) => setContent(e.target.value)} rows={5} />}</Field>
      <Button type="submit" className="w-full" loading={saving}>Salvar nota</Button>
    </form>
  );
}

function QuickWater({ initial, onDone }: { initial?: number | null; onDone: () => void }) {
  const { today } = useSession();
  const toast = useToast();
  const [ml, setMl] = useState(String(initial ?? 250));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {[150, 250, 350, 500].map((v) => (
          <button key={v} onClick={() => setMl(String(v))} aria-pressed={ml === String(v)} className={`rounded-2xl border p-3 text-sm font-semibold ${ml === String(v) ? "border-info bg-info-soft text-info" : "border-line"}`}>{v} ml</button>
        ))}
      </div>
      <Field label="Quantidade (ml)">{(id) => <Input id={id} type="number" min={1} max={5000} value={ml} onChange={(e) => setMl(e.target.value)} />}</Field>
      <Button className="w-full" onClick={async () => {
        const n = Number(ml);
        if (!n || n < 1 || n > 5000) return toast.show("Informe entre 1 e 5000 ml.", "error");
        await addWater(n, today);
        toast.show(`+${n} ml registrados 💧`, "success");
        onDone();
      }}>Registrar</Button>
    </div>
  );
}

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<QuickKind | null>(null);
  const [prefill, setPrefill] = useState<Partial<QuickParse> | undefined>();
  const [text, setText] = useState("");
  const { today } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();

  const openFn = useCallback((k?: QuickKind, p?: Partial<QuickParse>) => {
    setKind(k ?? null);
    setPrefill(p);
    setText("");
    setOpen(true);
  }, []);

  useEffect(() => {
    if (params.get("nova") === "1") {
      openFn();
      router.replace(path);
    }
  }, [params, openFn, router, path]);

  const close = () => setOpen(false);

  function interpret() {
    if (!text.trim()) return;
    const p = parseQuickCommand(text, today);
    const map: Record<QuickParse["intent"], QuickKind> = { despesa: "despesa", receita: "receita", compromisso: "compromisso", tarefa: "tarefa", sono: "sono", agua: "agua", habito: "habito", nota: "nota" };
    setPrefill(p);
    setKind(map[p.intent]);
  }

  return (
    <Ctx.Provider value={{ open: openFn }}>
      {children}
      <Sheet open={open} onClose={close} title={kind ? TITLES[kind] : "Nova ação"}>
        {!kind && (
          <div className="space-y-5">
            <form onSubmit={(e) => { e.preventDefault(); interpret(); }} className="space-y-2">
              <label htmlFor="quick-text" className="label">Escreva do seu jeito</label>
              <div className="flex gap-2">
                <Input id="quick-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: gastei 45,90 no mercado · academia amanhã às 7h" />
                <Button type="submit" size="icon" aria-label="Interpretar"><Wand2 className="size-5" /></Button>
              </div>
              <p className="text-xs text-muted">Entendemos datas, horários e valores. Você revisa antes de salvar.</p>
            </form>
            <div className="grid grid-cols-3 gap-2.5">
              {TILES.map((t) => (
                <button key={t.kind} onClick={() => setKind(t.kind)} className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-soft">
                  <span className={`grid size-11 place-items-center rounded-2xl ${t.tone}`}><t.icon className="size-5" aria-hidden /></span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {kind === "tarefa" && <TaskForm onDone={close} defaults={{ title: prefill?.title, due_date: prefill?.date ?? today, due_time: prefill?.time ?? undefined }} />}
        {kind === "compromisso" && <EventForm onDone={close} defaults={{ title: prefill?.title, date: prefill?.date ?? today, time: prefill?.time ?? undefined }} />}
        {(kind === "despesa" || kind === "receita") && <TransactionForm onDone={close} initialType={kind} defaults={{ description: prefill?.title, amountCents: prefill?.amountCents, date: prefill?.date }} />}
        {kind === "habito" && <HabitForm onDone={close} />}
        {kind === "nota" && <QuickNote initial={prefill?.title} onDone={close} />}
        {kind === "agua" && <QuickWater initial={prefill?.waterMl} onDone={close} />}
        {kind === "sono" && <SleepForm onDone={close} durationHint={prefill?.durationMinutes ?? undefined} />}
        {kind === "humor" && <MoodForm onDone={close} />}
      </Sheet>
    </Ctx.Provider>
  );
}
