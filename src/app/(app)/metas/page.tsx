"use client";
import { useState } from "react";
import { Target, Plus, Trash2, Check, ImagePlus, Trophy, RefreshCw, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, Field, Input, Select, Textarea, Segmented, EmptyState, ProgressBar, Badge, SectionTitle, cn } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { useSession } from "@/lib/session";
import { useGoals, useAccounts, useTransactions } from "@/lib/data/hooks";
import { mutate, newId, DataError } from "@/lib/data/store";
import { award, unlock } from "@/lib/data/actions";
import { uploadUserFile, useFileUrl } from "@/lib/files";
import { goalSchema, zodFieldErrors } from "@/lib/validation/entities";
import { accountBalances } from "@/lib/domain/finance";
import { fromCents, formatBRL } from "@/lib/domain/money";
import { formatDateBR, diffDays, localDateISO } from "@/lib/domain/dates";
import { useToast } from "@/components/ui/toast";
import type { Goal } from "@/lib/types";

const HORIZON = { semanal: "Semanal", mensal: "Mensal", anual: "Anual", longo_prazo: "Longo prazo" } as const;
const AREA = { pessoal: "Pessoal", profissional: "Profissional", financeira: "Financeira", saude: "Saúde", estudos: "Estudos", relacionamentos: "Relacionamentos" } as const;

function VisionImage({ path, alt }: { path: string; alt: string }) {
  const url = useFileUrl(path);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={alt} className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-surface-3" />;
}

export default function GoalsPage() {
  const { today, tz } = useSession();
  const toast = useToast();
  const { data: goals = [] } = useGoals();
  const { data: accounts = [] } = useAccounts();
  const { data: txs = [] } = useTransactions();
  const balances = accountBalances(accounts, txs);
  const [tab, setTab] = useState<"ativas" | "vision" | "conquistas">("ativas");
  const [horizon, setHorizon] = useState<string>("");
  const [form, setForm] = useState<Goal | null | "new">(null);
  const [detail, setDetail] = useState<Goal | null>(null);
  const [del, setDel] = useState<Goal | null>(null);

  const currentOf = (g: Goal) => (g.linked_account_id ? fromCents(balances.get(g.linked_account_id) ?? 0) : Number(g.current_value));
  const progressOf = (g: Goal) => {
    const steps = g.goal_steps ?? [];
    if (g.target_value) return Math.min(100, (currentOf(g) / Number(g.target_value)) * 100);
    if (steps.length) return (steps.filter((s) => s.done).length / steps.length) * 100;
    return g.status === "concluida" ? 100 : 0;
  };
  const active = goals.filter((g) => g.status === "ativa" || g.status === "pausada").filter((g) => !horizon || g.horizon === horizon);
  const done = goals.filter((g) => g.status === "concluida");
  const needReview = goals.filter((g) => g.status === "ativa" && (!g.last_reviewed_at || diffDays(today, localDateISO(new Date(g.last_reviewed_at), tz)) > 30));
  const current = detail ? goals.find((g) => g.id === detail.id) ?? null : null;

  async function complete(g: Goal) {
    await mutate({ action: "update", table: "goals", id: g.id, values: { status: "concluida", completed_at: new Date().toISOString() } });
    await award("meta_concluida", `meta:${g.id}`);
    void unlock("meta_concluida");
    toast.show("Meta concluída! Que orgulho 🏆", "success");
  }

  return (
    <>
      <PageHeader title="Metas" icon={<Target className="size-5" />} actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setForm("new")}>Nova</Button>} />
      <Segmented label="Seções" value={tab} onChange={setTab} options={[{ value: "ativas", label: "Minhas metas" }, { value: "vision", label: "Vision board" }, { value: "conquistas", label: "Conquistadas" }]} />

      {tab === "ativas" && (
        <div className="mt-4 space-y-3">
          {needReview.length > 0 && (
            <Card className="flex items-center gap-3 bg-primary-soft/60">
              <RefreshCw className="size-5 text-primary" aria-hidden />
              <p className="flex-1 text-sm">{needReview.length} meta(s) sem revisão há mais de 30 dias. Que tal revisitar?</p>
              <Button size="sm" variant="soft" onClick={() => setDetail(needReview[0])}>Revisar</Button>
            </Card>
          )}
          <div className="scroll-x -mx-4 flex gap-2 px-4">
            <button onClick={() => setHorizon("")} className={cn("shrink-0 rounded-pill px-3 py-1.5 text-sm", !horizon ? "bg-orchid text-white dark:bg-primary dark:text-primary-ink" : "bg-surface")}>Todas</button>
            {Object.entries(HORIZON).map(([k, l]) => <button key={k} onClick={() => setHorizon(k)} className={cn("shrink-0 rounded-pill px-3 py-1.5 text-sm", horizon === k ? "bg-orchid text-white dark:bg-primary dark:text-primary-ink" : "bg-surface")}>{l}</button>)}
          </div>
          {active.length === 0 ? <EmptyState icon="🎯" title="Defina sua primeira meta" description="Metas pequenas e claras ficam mais fáceis de alcançar. Divida em etapas!" action={<Button onClick={() => setForm("new")}>Criar meta</Button>} /> : (
            <div className="grid gap-3 md:grid-cols-2">
              {active.map((g) => {
                const pct = progressOf(g);
                const days = g.due_date ? diffDays(g.due_date, today) : null;
                return (
                  <button key={g.id} onClick={() => setDetail(g)} className="card card-hover overflow-hidden text-left">
                    {g.image_url && <div className="h-28"><VisionImage path={g.image_url} alt={g.title} /></div>}
                    <div className="p-4">
                      <div className="flex flex-wrap gap-1.5"><Badge>{HORIZON[g.horizon]}</Badge><Badge tone="neutral">{AREA[g.area]}</Badge>{g.status === "pausada" && <Badge tone="warning">Pausada</Badge>}</div>
                      <h3 className="mt-2 font-bold">{g.title}</h3>
                      <ProgressBar value={pct} className="mt-3" label={`Progresso de ${g.title}`} />
                      <p className="mt-1 text-xs text-muted">{Math.round(pct)}%{g.target_value ? ` · ${g.area === "financeira" ? formatBRL(currentOf(g)) : currentOf(g)} de ${g.area === "financeira" ? formatBRL(g.target_value) : `${Number(g.target_value)} ${g.unit ?? ""}`}` : ""}{days !== null ? ` · ${days < 0 ? "prazo vencido" : `${days} dias restantes`}` : ""}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "vision" && (
        <div className="mt-4">
          <p className="mb-3 text-sm text-ink-soft">Imagens que te lembram do porquê. Adicione uma foto a cada meta para montar seu vision board.</p>
          {goals.filter((g) => g.image_url).length === 0 ? <EmptyState icon="🖼️" title="Seu vision board está vazio" description="Abra uma meta e toque em “Adicionar imagem”." /> : (
            <div className="columns-2 gap-3 md:columns-3">
              {goals.filter((g) => g.image_url).map((g) => (
                <button key={g.id} onClick={() => setDetail(g)} className="relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-card">
                  <div className={g.id.charCodeAt(0) % 2 ? "aspect-[3/4]" : "aspect-square"}><VisionImage path={g.image_url!} alt={g.title} /></div>
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-orchid/85 to-transparent p-3 text-left text-sm font-semibold text-white">{g.title}{g.status === "concluida" && " ✓"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "conquistas" && (
        <div className="mt-4 space-y-2">
          {done.length === 0 ? <EmptyState icon="🏆" title="Suas conquistas aparecerão aqui" /> : done.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")).map((g) => (
            <Card key={g.id} className="flex items-center gap-3">
              <Trophy className="size-6 text-warning" aria-hidden />
              <div className="flex-1"><p className="font-semibold">{g.title}</p><p className="text-xs text-muted">Concluída em {g.completed_at ? formatDateBR(localDateISO(new Date(g.completed_at), tz)) : "—"} · {AREA[g.area]}</p></div>
              <Button size="sm" variant="ghost" onClick={() => mutate({ action: "update", table: "goals", id: g.id, values: { status: "ativa", completed_at: null } })}>Reabrir</Button>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!current} onClose={() => setDetail(null)} title={current?.title ?? ""} wide footer={current && (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="text-error" icon={<Trash2 className="size-4" />} onClick={() => { setDel(current); setDetail(null); }}>Excluir</Button>
          <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => { setForm(current); setDetail(null); }}>Editar</Button>
          {current.status !== "concluida" && <Button className="flex-1" icon={<Trophy className="size-4" />} onClick={async () => { await complete(current); setDetail(null); }}>Concluir meta</Button>}
        </div>
      )}>
        {current && <GoalDetail goal={current} current={currentOf(current)} progress={progressOf(current)} />}
      </Sheet>
      <Sheet open={!!form} onClose={() => setForm(null)} title={form === "new" ? "Nova meta" : "Editar meta"} wide>{form && <GoalForm goal={form === "new" ? null : form} accounts={accounts} onDone={() => setForm(null)} />}</Sheet>
      <ConfirmDialog open={!!del} danger title="Excluir meta?" message={`“${del?.title}” e suas etapas serão excluídas.`} confirmLabel="Excluir" onCancel={() => setDel(null)} onConfirm={async () => { await mutate({ action: "delete", table: "goals", id: del!.id }); setDel(null); }} />
    </>
  );
}

function GoalDetail({ goal, current, progress }: { goal: Goal; current: number; progress: number }) {
  const { user, today } = useSession();
  const toast = useToast();
  const [step, setStep] = useState("");
  const [due, setDue] = useState("");
  const [value, setValue] = useState("");
  const steps = [...(goal.goal_steps ?? [])].sort((a, b) => a.position - b.position);
  return (
    <div className="space-y-4">
      {goal.image_url && <div className="h-44 overflow-hidden rounded-2xl"><VisionImage path={goal.image_url} alt={goal.title} /></div>}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-pill border border-line px-3.5 py-2 text-sm font-semibold">
        <ImagePlus className="size-4" aria-hidden />{goal.image_url ? "Trocar imagem" : "Adicionar imagem"}
        <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f || !user) return; try { const path = await uploadUserFile(user.id, "vision", f); await mutate({ action: "update", table: "goals", id: goal.id, values: { image_url: path } }); } catch (err) { toast.show((err as Error).message, "error"); } }} />
      </label>
      {goal.description && <p className="whitespace-pre-wrap text-sm text-ink-soft">{goal.description}</p>}
      <div><ProgressBar value={progress} label="Progresso" /><p className="mt-1 text-xs text-muted">{Math.round(progress)}% concluído{goal.due_date ? ` · prazo ${formatDateBR(goal.due_date)}` : ""}</p></div>
      {goal.target_value && !goal.linked_account_id && (
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); const v = Number(value.replace(/\./g, "").replace(",", ".")); if (!(v >= 0)) return; await mutate({ action: "update", table: "goals", id: goal.id, values: { current_value: v } }); setValue(""); toast.show("Progresso atualizado.", "success"); }}>
          <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Valor atual (${current})`} aria-label="Atualizar valor atual" />
          <Button type="submit" variant="soft">Atualizar</Button>
        </form>
      )}
      {goal.linked_account_id && <p className="text-xs text-muted">O progresso acompanha automaticamente o saldo da conta vinculada.</p>}
      <div>
        <SectionTitle className="mt-0">Etapas</SectionTitle>
        <ul className="space-y-1.5">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <button onClick={async () => { await mutate({ action: "update", table: "goal_steps", id: s.id, values: { done: !s.done } }); if (!s.done) await award("meta_etapa", `etapa:${s.id}`); }} aria-pressed={s.done} aria-label={`Concluir etapa ${s.title}`} className={cn("grid size-6 place-items-center rounded-full border-2", s.done ? "border-success bg-success text-white" : "border-iris")}>{s.done && <Check className="size-3.5" />}</button>
              <span className={cn("flex-1", s.done && "text-muted line-through")}>{s.title}</span>
              {s.due_date && <span className={cn("text-xs", !s.done && s.due_date < today ? "text-error" : "text-muted")}>{formatDateBR(s.due_date)}</span>}
              <button aria-label="Remover etapa" onClick={() => mutate({ action: "delete", table: "goal_steps", id: s.id })} className="text-muted"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
        <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!step.trim()) return; await mutate({ action: "insert", table: "goal_steps", values: { goal_id: goal.id, title: step.trim(), due_date: due || null, position: steps.length } }); setStep(""); setDue(""); }}>
          <Input value={step} onChange={(e) => setStep(e.target.value)} placeholder="Nova etapa" aria-label="Nova etapa" />
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-40" aria-label="Prazo da etapa" />
          <Button type="submit" size="icon" variant="soft" aria-label="Adicionar etapa"><Plus className="size-4" /></Button>
        </form>
      </div>
      <div className="rounded-2xl bg-surface-2 p-3">
        <p className="text-sm font-semibold">Revisão</p>
        <p className="text-xs text-muted">{goal.last_reviewed_at ? `Última revisão: ${formatDateBR(goal.last_reviewed_at.slice(0, 10))}` : "Nunca revisada."} Esta meta ainda faz sentido? O prazo é realista?</p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="soft" onClick={async () => { await mutate({ action: "update", table: "goals", id: goal.id, values: { last_reviewed_at: new Date().toISOString() } }); toast.show("Revisão registrada.", "success"); }}>Marcar como revisada</Button>
          <Button size="sm" variant="ghost" onClick={() => mutate({ action: "update", table: "goals", id: goal.id, values: { status: goal.status === "pausada" ? "ativa" : "pausada" } })}>{goal.status === "pausada" ? "Retomar" : "Pausar"}</Button>
        </div>
      </div>
    </div>
  );
}

function GoalForm({ goal, accounts, onDone }: { goal: Goal | null; accounts: { id: string; name: string }[]; onDone: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ title: goal?.title ?? "", description: goal?.description ?? "", horizon: goal?.horizon ?? "anual", area: goal?.area ?? "pessoal", target_value: goal?.target_value ?? "", current_value: goal?.current_value ?? "0", unit: goal?.unit ?? "", due_date: goal?.due_date ?? "", linked_account_id: goal?.linked_account_id ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form className="space-y-4" noValidate onSubmit={async (e) => {
      e.preventDefault();
      const num = (s: string) => (s === "" ? null : Number(String(s).replace(/\.(?=\d{3})/g, "").replace(",", ".")));
      const parsed = goalSchema.safeParse({ ...v, description: v.description || null, target_value: num(String(v.target_value)), current_value: num(String(v.current_value)) ?? 0, unit: v.unit || null, due_date: v.due_date || null });
      if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));
      try {
        const values = { ...parsed.data, linked_account_id: v.area === "financeira" && v.linked_account_id ? v.linked_account_id : null };
        if (goal) await mutate({ action: "update", table: "goals", id: goal.id, values });
        else await mutate({ action: "insert", table: "goals", values: { id: newId(), ...values } });
        toast.show("Meta salva.", "success");
        onDone();
      } catch (ex) {
        toast.show(ex instanceof DataError ? ex.message : "Erro ao salvar.", "error");
      }
    }}>
      <Field label="Meta" error={errors.title}>{(id) => <Input id={id} value={v.title} onChange={set("title")} placeholder="Ex.: Montar reserva de emergência" invalid={!!errors.title} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Horizonte">{(id) => <Select id={id} value={v.horizon} onChange={set("horizon")}>{Object.entries(HORIZON).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
        <Field label="Área">{(id) => <Select id={id} value={v.area} onChange={set("area")}>{Object.entries(AREA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
        <Field label="Alvo numérico (opcional)" error={errors.target_value}>{(id) => <Input id={id} inputMode="decimal" value={v.target_value} onChange={set("target_value")} placeholder={v.area === "financeira" ? "10.000,00" : "Ex.: 12"} />}</Field>
        <Field label="Unidade">{(id) => <Input id={id} value={v.area === "financeira" ? "R$" : v.unit} onChange={set("unit")} disabled={v.area === "financeira"} placeholder="livros, kg, km" />}</Field>
        <Field label="Valor atual">{(id) => <Input id={id} inputMode="decimal" value={v.current_value} onChange={set("current_value")} disabled={!!v.linked_account_id} />}</Field>
        <Field label="Prazo">{(id) => <Input id={id} type="date" value={v.due_date} onChange={set("due_date")} />}</Field>
      </div>
      {v.area === "financeira" && <Field label="Vincular a uma conta (progresso automático)" hint="Ex.: conta de Reserva de emergência">{(id, d) => <Select id={id} aria-describedby={d} value={v.linked_account_id} onChange={set("linked_account_id")}><option value="">Não vincular</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>}</Field>}
      <Field label="Por que essa meta importa?">{(id) => <Textarea id={id} value={v.description} onChange={set("description")} rows={3} />}</Field>
      <Button type="submit" className="w-full">Salvar meta</Button>
    </form>
  );
}
