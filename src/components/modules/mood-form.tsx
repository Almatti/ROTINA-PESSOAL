"use client";
import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/toast";
import { mutate, DataError } from "@/lib/data/store";
import { award } from "@/lib/data/actions";
import { getSupabase } from "@/lib/supabase/client";
import { moodSchema, zodFieldErrors } from "@/lib/validation/entities";
import { MOODS, FEELINGS, REFLECTION_PROMPTS } from "./mood-meta";
import type { MoodLog } from "@/lib/types";

export function MoodForm({ onDone, date: initialDate }: { onDone: () => void; date?: string }) {
  const { today } = useSession();
  const toast = useToast();
  const [date, setDate] = useState(initialDate ?? today);
  const [existing, setExisting] = useState<MoodLog | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [energy, setEnergy] = useState(3);
  const [feelings, setFeelings] = useState<string[]>([]);
  const [journal, setJournal] = useState("");
  const [gratitude, setGratitude] = useState("");
  const [highlights, setHighlights] = useState("");
  const [prompt, setPrompt] = useState(REFLECTION_PROMPTS[0]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setPrompt(REFLECTION_PROMPTS[new Date().getDate() % REFLECTION_PROMPTS.length]);
    getSupabase().from("mood_logs").select("*").eq("log_date", date).maybeSingle().then(({ data }) => {
      const m = data as MoodLog | null;
      setExisting(m);
      setMood(m?.mood ?? null);
      setIntensity(m?.intensity ?? 5);
      setEnergy(m?.energy ?? 3);
      setFeelings(m?.feelings ?? []);
      setJournal(m?.journal ?? "");
      setGratitude(m?.gratitude ?? "");
      setHighlights(m?.highlights ?? "");
    });
  }, [date]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const emoji = MOODS.find((m) => m.value === mood)?.emoji ?? "";
    const parsed = moodSchema.safeParse({ log_date: date, mood, emoji, intensity, energy, feelings, journal: journal || null, gratitude: gratitude || null, highlights: highlights || null });
    if (!parsed.success) return setErrors(mood ? zodFieldErrors(parsed.error) : { mood: "Escolha como você está." });
    setErrors({});
    setSaving(true);
    try {
      if (existing) await mutate({ action: "update", table: "mood_logs", id: existing.id, values: parsed.data });
      else await mutate({ action: "insert", table: "mood_logs", values: parsed.data });
      await award("humor", `humor:${date}`);
      toast.show("Registro salvo. Obrigada por se ouvir hoje 💜", "success");
      onDone();
    } catch (err) {
      toast.show(err instanceof DataError ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      <Field label="Dia">{(id) => <Input id={id} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      <fieldset>
        <legend className="label">Humor</legend>
        <div className="grid grid-cols-5 gap-2">
          {MOODS.map((m) => (
            <button key={m.value} type="button" aria-pressed={mood === m.value} onClick={() => setMood(m.value)} className={`flex flex-col items-center gap-1 rounded-2xl border p-2 text-[0.7rem] transition ${mood === m.value ? "scale-105 border-primary bg-primary-soft" : "border-line"}`}>
              <span className="text-3xl" aria-hidden>{m.emoji}</span>{m.label}
            </button>
          ))}
        </div>
        {errors.mood && <p className="mt-1 text-xs text-error" role="alert">{errors.mood}</p>}
      </fieldset>
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm"><span className="label">Intensidade: {intensity}/10</span><input type="range" min={1} max={10} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full accent-[var(--primary)]" /></label>
        <label className="text-sm"><span className="label">Energia: {energy}/5</span><input type="range" min={1} max={5} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} className="w-full accent-[var(--primary)]" /></label>
      </div>
      <fieldset>
        <legend className="label">Sentimentos</legend>
        <div className="flex flex-wrap gap-1.5">
          {FEELINGS.map((f) => {
            const on = feelings.includes(f);
            return <button key={f} type="button" aria-pressed={on} onClick={() => setFeelings((l) => (on ? l.filter((x) => x !== f) : [...l, f]))} className={`rounded-pill px-3 py-1.5 text-sm ${on ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-soft"}`}>{f}</button>;
          })}
        </div>
      </fieldset>
      <div className="flex gap-2 rounded-2xl bg-surface-2 p-3 text-sm text-ink-soft">
        <Lightbulb className="size-4 shrink-0 text-primary" aria-hidden />
        <span><strong>Para refletir:</strong> {prompt}</span>
      </div>
      <Field label="Diário (escrita livre)">{(id) => <Textarea id={id} value={journal} onChange={(e) => setJournal(e.target.value)} rows={4} placeholder="Escreva sem julgamentos…" />}</Field>
      <Field label="Gratidão">{(id) => <Textarea id={id} value={gratitude} onChange={(e) => setGratitude(e.target.value)} rows={2} placeholder="Hoje sou grata por…" />}</Field>
      <Field label="Acontecimentos do dia">{(id) => <Textarea id={id} value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={2} />}</Field>
      <p className="text-xs text-muted">Seu diário é privado e não é enviado à assistente de IA. Este registro não substitui acompanhamento profissional.</p>
      <Button type="submit" className="w-full" loading={saving}>{existing ? "Atualizar registro" : "Salvar registro"}</Button>
    </form>
  );
}
