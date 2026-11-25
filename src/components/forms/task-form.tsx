"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { RecurrenceField } from "./recurrence-field";
import { taskSchema, zodFieldErrors, type TaskInput } from "@/lib/validation/entities";
import { useCategories, useTable } from "@/lib/data/hooks";
import { mutate, newId, DataError } from "@/lib/data/store";
import { useToast } from "@/components/ui/toast";
import type { Task, Subtask } from "@/lib/types";

interface Props { task?: Partial<Task> | null; onDone: () => void; defaults?: Partial<TaskInput> }

export function TaskForm({ task, onDone, defaults }: Props) {
  const toast = useToast();
  const { data: categories } = useCategories("tarefa");
  const { data: projects } = useTable<{ id: string; name: string }>("projects", { order: "name", select: "id,name" });
  const isEdit = !!task?.id;
  const [v, setV] = useState({
    title: task?.title ?? defaults?.title ?? "",
    description: task?.description ?? "",
    notes: task?.notes ?? "",
    category_id: task?.category_id ?? "",
    area: task?.area ?? defaults?.area ?? "pessoal",
    project_id: task?.project_id ?? defaults?.project_id ?? "",
    due_date: task?.due_date ?? defaults?.due_date ?? "",
    due_time: task?.due_time?.slice(0, 5) ?? defaults?.due_time ?? "",
    deadline: task?.deadline ?? "",
    priority: task?.priority ?? "media",
    status: task?.status ?? "pendente",
    reminder_minutes: task?.reminder_minutes?.toString() ?? "",
    estimated_minutes: task?.estimated_minutes?.toString() ?? "",
    tags: (task?.tags ?? []).join(", "),
  });
  const [recurrence, setRecurrence] = useState(task?.recurrence ?? null);
  const [subtasks, setSubtasks] = useState<Pick<Subtask, "id" | "title" | "done">[]>(task?.subtasks?.sort((a, b) => a.position - b.position) ?? []);
  const [newSub, setNewSub] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = taskSchema.safeParse({
      ...v,
      description: v.description || null,
      notes: v.notes || null,
      category_id: v.category_id || null,
      project_id: v.project_id || null,
      due_date: v.due_date || null,
      due_time: v.due_time || null,
      deadline: v.deadline || null,
      reminder_minutes: v.reminder_minutes ? Number(v.reminder_minutes) : null,
      estimated_minutes: v.estimated_minutes ? Number(v.estimated_minutes) : null,
      tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
      recurrence: recurrence ? { ...recurrence, weekdays: recurrence.freq === "semanal" ? recurrence.weekdays : undefined } : null,
    });
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));
    if (recurrence && !parsed.data.due_date) return setErrors({ due_date: "Tarefas recorrentes precisam de uma data inicial." });
    setErrors({});
    setSaving(true);
    try {
      const id = task?.id ?? newId();
      const values = { ...parsed.data, completed_at: parsed.data.status === "concluida" ? task?.completed_at ?? new Date().toISOString() : null };
      if (isEdit) await mutate({ action: "update", table: "tasks", id, values });
      else await mutate({ action: "insert", table: "tasks", values: { id, ...values } });
      // subtarefas: sincroniza lista
      const original = task?.subtasks ?? [];
      for (const s of original) if (!subtasks.find((x) => x.id === s.id)) await mutate({ action: "delete", table: "subtasks", id: s.id });
      for (const [i, s] of subtasks.entries()) {
        const before = original.find((o) => o.id === s.id);
        if (!before) await mutate({ action: "insert", table: "subtasks", values: { id: s.id, task_id: id, title: s.title, done: s.done, position: i } });
        else if (before.title !== s.title || before.done !== s.done || before.position !== i) await mutate({ action: "update", table: "subtasks", id: s.id, values: { title: s.title, done: s.done, position: i } });
      }
      toast.show(isEdit ? "Tarefa atualizada." : "Tarefa criada!", "success");
      onDone();
    } catch (err) {
      toast.show(err instanceof DataError ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <Field label="Título" error={errors.title}>{(id, d) => <Input id={id} value={v.title} onChange={set("title")} aria-describedby={d} invalid={!!errors.title} placeholder="Ex.: Responder e-mails" maxLength={200} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data" error={errors.due_date}>{(id) => <Input id={id} type="date" value={v.due_date} onChange={set("due_date")} />}</Field>
        <Field label="Horário" error={errors.due_time}>{(id) => <Input id={id} type="time" value={v.due_time} onChange={set("due_time")} />}</Field>
        <Field label="Prioridade">{(id) => (
          <Select id={id} value={v.priority} onChange={set("priority")}>
            <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
          </Select>)}
        </Field>
        <Field label="Status">{(id) => (
          <Select id={id} value={v.status} onChange={set("status")}>
            <option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option><option value="cancelada">Cancelada</option>
          </Select>)}
        </Field>
        <Field label="Área">{(id) => (
          <Select id={id} value={v.area} onChange={set("area")}>
            <option value="pessoal">Pessoal</option><option value="trabalho">Trabalho</option><option value="estudos">Estudos</option><option value="casa">Casa</option>
          </Select>)}
        </Field>
        <Field label="Categoria">{(id) => (
          <Select id={id} value={v.category_id} onChange={set("category_id")}>
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </Select>)}
        </Field>
        <Field label="Prazo final" error={errors.deadline}>{(id) => <Input id={id} type="date" value={v.deadline} onChange={set("deadline")} />}</Field>
        <Field label="Tempo estimado (min)" error={errors.estimated_minutes}>{(id) => <Input id={id} type="number" min={1} max={1440} inputMode="numeric" value={v.estimated_minutes} onChange={set("estimated_minutes")} />}</Field>
        <Field label="Lembrete">{(id) => (
          <Select id={id} value={v.reminder_minutes} onChange={set("reminder_minutes")}>
            <option value="">Sem lembrete</option><option value="0">Na hora</option><option value="10">10 min antes</option><option value="30">30 min antes</option><option value="60">1 h antes</option><option value="1440">1 dia antes</option>
          </Select>)}
        </Field>
        <Field label="Projeto">{(id) => (
          <Select id={id} value={v.project_id} onChange={set("project_id")}>
            <option value="">Nenhum</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>)}
        </Field>
      </div>
      <Field label="Repetição">{(id) => <RecurrenceField id={id} value={recurrence} onChange={setRecurrence} />}</Field>
      <div>
        <span className="label">Subtarefas / checklist</span>
        <ul className="space-y-1.5">
          {subtasks.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <input type="checkbox" checked={s.done} onChange={(e) => setSubtasks((l) => l.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} className="size-5 accent-[var(--primary)]" aria-label={`Concluir ${s.title}`} />
              <Input value={s.title} onChange={(e) => setSubtasks((l) => l.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="min-h-10 py-1.5" aria-label="Título da subtarefa" />
              <Button variant="ghost" size="icon" onClick={() => setSubtasks((l) => l.filter((_, j) => j !== i))} aria-label="Remover subtarefa"><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <Input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Adicionar item" aria-label="Nova subtarefa" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newSub.trim()) { setSubtasks((l) => [...l, { id: newId(), title: newSub.trim(), done: false }]); setNewSub(""); } } }} />
          <Button variant="soft" size="icon" aria-label="Adicionar subtarefa" onClick={() => { if (newSub.trim()) { setSubtasks((l) => [...l, { id: newId(), title: newSub.trim(), done: false }]); setNewSub(""); } }}><Plus className="size-4" /></Button>
        </div>
      </div>
      <Field label="Descrição">{(id) => <Textarea id={id} value={v.description} onChange={set("description")} rows={2} />}</Field>
      <Field label="Anotações">{(id) => <Textarea id={id} value={v.notes} onChange={set("notes")} rows={2} />}</Field>
      <Field label="Etiquetas" hint="Separe por vírgulas">{(id, d) => <Input id={id} value={v.tags} onChange={set("tags")} aria-describedby={d} />}</Field>
      <Button type="submit" className="w-full" loading={saving}>{isEdit ? "Salvar alterações" : "Criar tarefa"}</Button>
    </form>
  );
}
