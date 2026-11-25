"use client";
import { useMemo, useState } from "react";
import { Briefcase, Plus, Pencil, Trash2, Link2, Clock, CalendarDays, Check } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, Field, Input, Select, Textarea, Segmented, EmptyState, ProgressBar, Badge, SectionTitle, Stat, cn } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { TaskForm } from "@/components/forms/task-form";
import { TaskRow } from "@/components/plan/task-row";
import { useSession } from "@/lib/session";
import { useTable, useTasks, useEvents } from "@/lib/data/hooks";
import { mutate, newId, DataError } from "@/lib/data/store";
import { setTaskDone } from "@/lib/data/actions";
import { formatDateBR, diffDays, addDays, startOfWeek, minutesToLabel, zonedToUtc, localTimeHHMM, localDateISO } from "@/lib/domain/dates";
import { expandEvents } from "@/lib/calendar";
import { useToast } from "@/components/ui/toast";
import type { Task } from "@/lib/types";

interface Project { id: string; name: string; description: string | null; objective: string | null; area: string; client: string | null; status: string; start_date: string | null; due_date: string | null; color: string; links: { label: string; url: string }[]; notes: string | null; project_stages?: Stage[] }
interface Stage { id: string; project_id: string; title: string; due_date: string | null; done: boolean; position: number }
interface TimeEntry { id: string; project_id: string | null; task_id: string | null; worked_on: string; duration_minutes: number; description: string | null }

const STATUS = [{ v: "planejamento", l: "Planejamento" }, { v: "em_andamento", l: "Em andamento" }, { v: "pausado", l: "Pausado" }, { v: "concluido", l: "Concluído" }, { v: "cancelado", l: "Cancelado" }];

export default function WorkPage() {
  const { today, tz } = useSession();
  const toast = useToast();
  const [area, setArea] = useState<"trabalho" | "estudos" | "pessoal">("trabalho");
  const [tab, setTab] = useState<"tarefas" | "projetos" | "horas" | "reunioes">("projetos");
  const { data: projects = [] } = useTable<Project>("projects", { select: "*, project_stages(*)", order: "created_at", ascending: false, key: "full" });
  const { data: entries = [] } = useTable<TimeEntry>("time_entries", { order: "worked_on", ascending: false, limit: 500 });
  const { data: tasks = [] } = useTasks({ includeDone: true, key: "all" });
  const ws = startOfWeek(today);
  const { data: events = [] } = useEvents(zonedToUtc(ws, "00:00", tz).toISOString(), zonedToUtc(addDays(ws, 14), "00:00", tz).toISOString());
  const [projForm, setProjForm] = useState<Project | null | "new">(null);
  const [detail, setDetail] = useState<Project | null>(null);
  const [taskForm, setTaskForm] = useState<{ task?: Task; project_id?: string } | null>(null);
  const [timeForm, setTimeForm] = useState<{ project_id?: string } | null>(null);
  const [del, setDel] = useState<{ table: string; id: string; label: string } | null>(null);

  const areaProjects = projects.filter((p) => p.area === area);
  const areaTasks = tasks.filter((t) => t.area === area || (t.project_id && areaProjects.some((p) => p.id === t.project_id)));
  const weekMinutes = entries.filter((e) => e.worked_on >= ws).reduce((s, e) => s + e.duration_minutes, 0);
  const meetings = expandEvents(events.filter((e) => e.area === area), today, addDays(today, 13), tz);
  const progress = (p: Project) => {
    const st = p.project_stages ?? [];
    const pt = tasks.filter((t) => t.project_id === p.id && t.status !== "cancelada");
    const total = st.length + pt.length;
    return total ? Math.round(((st.filter((s) => s.done).length + pt.filter((t) => t.status === "concluida").length) / total) * 100) : p.status === "concluido" ? 100 : 0;
  };
  const current = detail ? projects.find((p) => p.id === detail.id) ?? detail : null;

  return (
    <>
      <PageHeader title={area === "trabalho" ? "Trabalho" : area === "estudos" ? "Projetos acadêmicos" : "Projetos pessoais"} icon={<Briefcase className="size-5" />} actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => (tab === "tarefas" ? setTaskForm({}) : tab === "horas" ? setTimeForm({}) : setProjForm("new"))}>Novo</Button>} />
      <Segmented label="Área" value={area} onChange={setArea} options={[{ value: "trabalho", label: "Profissional" }, { value: "estudos", label: "Acadêmico" }, { value: "pessoal", label: "Pessoal" }]} />
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Projetos ativos" value={areaProjects.filter((p) => p.status === "em_andamento").length} icon="📁" />
        <Stat label="Tarefas abertas" value={areaTasks.filter((t) => t.status === "pendente" || t.status === "em_andamento").length} icon="📝" />
        <Stat label="Horas na semana" value={minutesToLabel(weekMinutes)} icon="⏱️" />
      </div>
      <div className="mt-4"><Segmented label="Seções" value={tab} onChange={setTab} options={[{ value: "projetos", label: "Projetos" }, { value: "tarefas", label: "Tarefas" }, { value: "horas", label: "Horas" }, { value: "reunioes", label: "Reuniões" }]} /></div>

      {tab === "projetos" && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {areaProjects.length === 0 ? <div className="md:col-span-2"><EmptyState icon="📁" title="Nenhum projeto aqui" description="Organize objetivos, etapas, prazos, arquivos e horas." action={<Button onClick={() => setProjForm("new")}>Criar projeto</Button>} /></div> : areaProjects.map((p) => {
            const pct = progress(p);
            const late = p.due_date && p.due_date < today && p.status !== "concluido";
            return (
              <button key={p.id} onClick={() => setDetail(p)} className="card card-hover p-4 text-left" style={{ borderTop: `4px solid ${p.color}` }}>
                <div className="flex items-start justify-between gap-2"><h3 className="font-bold">{p.name}</h3><Badge tone={p.status === "concluido" ? "success" : p.status === "pausado" ? "warning" : "primary"}>{STATUS.find((s) => s.v === p.status)?.l}</Badge></div>
                {p.client && <p className="text-xs text-muted">Cliente: {p.client}</p>}
                <ProgressBar value={pct} className="mt-3" label={`Progresso de ${p.name}`} />
                <p className={cn("mt-1 text-xs", late ? "text-error" : "text-muted")}>{pct}% concluído{p.due_date ? ` · prazo ${formatDateBR(p.due_date)}${late ? " (atrasado)" : ` (${diffDays(p.due_date, today)} dias)`}` : ""}</p>
              </button>
            );
          })}
        </div>
      )}

      {tab === "tarefas" && (
        <div className="mt-4 space-y-2.5">
          {areaTasks.filter((t) => t.status !== "concluida" && t.status !== "cancelada").length === 0 ? <EmptyState icon="✅" title="Sem tarefas abertas" action={<Button onClick={() => setTaskForm({})}>Nova tarefa</Button>} /> :
            areaTasks.filter((t) => t.status !== "concluida" && t.status !== "cancelada").map((t) => <div key={t.id}><TaskRow task={t} today={today} onEdit={() => setTaskForm({ task: t })} />{t.project_id && <p className="px-3 pt-1 text-xs text-muted">📁 {projects.find((p) => p.id === t.project_id)?.name}</p>}</div>)}
        </div>
      )}

      {tab === "horas" && (
        <div className="mt-4 space-y-3">
          <Button variant="soft" className="w-full" icon={<Clock className="size-4" />} onClick={() => setTimeForm({})}>Registrar horas</Button>
          <Card className="divide-y divide-line py-1">
            {entries.filter((e) => !e.project_id || areaProjects.some((p) => p.id === e.project_id)).length === 0 && <p className="py-3 text-sm text-muted">Nenhum registro de horas.</p>}
            {entries.filter((e) => !e.project_id || areaProjects.some((p) => p.id === e.project_id)).slice(0, 50).map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1"><p className="font-semibold">{minutesToLabel(e.duration_minutes)} · {projects.find((p) => p.id === e.project_id)?.name ?? "Sem projeto"}</p><p className="text-xs text-muted">{formatDateBR(e.worked_on)}{e.description ? ` · ${e.description}` : ""}</p></div>
                <Button size="icon" variant="ghost" aria-label="Excluir registro" onClick={() => setDel({ table: "time_entries", id: e.id, label: "este registro de horas" })}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === "reunioes" && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted">Compromissos da área “{area}” nas próximas duas semanas. Crie reuniões na agenda escolhendo a área correspondente.</p>
          {meetings.length === 0 ? <EmptyState icon="📅" title="Nenhuma reunião agendada" action={<Link href="/agenda" className="text-sm font-semibold text-primary">Abrir agenda</Link>} /> : meetings.map((m) => (
            <Link key={m.id + m.occStart} href={`/agenda?dia=${localDateISO(new Date(m.occStart), tz)}`} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft-sm">
              <CalendarDays className="size-5 text-info" aria-hidden />
              <div className="flex-1"><p className="font-semibold">{m.title}</p><p className="text-xs text-muted">{formatDateBR(localDateISO(new Date(m.occStart), tz))} · {m.all_day ? "dia inteiro" : localTimeHHMM(new Date(m.occStart), tz)}</p></div>
            </Link>
          ))}
        </div>
      )}

      <Sheet open={!!current} onClose={() => setDetail(null)} title={current?.name ?? ""} wide footer={current && (
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 text-error" onClick={() => { setDel({ table: "projects", id: current.id, label: current.name }); setDetail(null); }}>Excluir</Button>
          <Button variant="outline" className="flex-1" icon={<Pencil className="size-4" />} onClick={() => { setProjForm(current); setDetail(null); }}>Editar</Button>
        </div>
      )}>
        {current && (
          <div className="space-y-4">
            {current.objective && <div><p className="eyebrow">Objetivo</p><p className="text-sm">{current.objective}</p></div>}
            {current.description && <p className="whitespace-pre-wrap text-sm text-ink-soft">{current.description}</p>}
            <div><p className="eyebrow">Progresso</p><ProgressBar value={progress(current)} className="mt-1" label="Progresso do projeto" /><p className="mt-1 text-xs text-muted">{progress(current)}% · {minutesToLabel(entries.filter((e) => e.project_id === current.id).reduce((s, e) => s + e.duration_minutes, 0))} trabalhadas</p></div>
            <StagesEditor project={current} />
            <div>
              <SectionTitle className="mt-2" action={<Button size="sm" variant="soft" onClick={() => setTaskForm({ project_id: current.id })}>+ Tarefa</Button>}>Tarefas</SectionTitle>
              <div className="space-y-2">{tasks.filter((t) => t.project_id === current.id).map((t) => (
                <label key={t.id} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2 text-sm"><input type="checkbox" checked={t.status === "concluida"} onChange={() => setTaskDone(t, t.status !== "concluida", today)} className="size-4 accent-[var(--primary)]" /><span className={cn("flex-1", t.status === "concluida" && "text-muted line-through")}>{t.title}</span>{t.due_date && <span className="text-xs text-muted">{formatDateBR(t.due_date)}</span>}</label>
              ))}</div>
            </div>
            {current.links.length > 0 && <div><p className="eyebrow mb-1">Arquivos e links</p><ul className="space-y-1">{current.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline"><Link2 className="size-3.5" aria-hidden />{l.label || l.url}</a></li>)}</ul></div>}
            {current.notes && <div><p className="eyebrow">Anotações</p><p className="whitespace-pre-wrap text-sm">{current.notes}</p></div>}
            <Button variant="outline" className="w-full" icon={<Clock className="size-4" />} onClick={() => setTimeForm({ project_id: current.id })}>Registrar horas neste projeto</Button>
          </div>
        )}
      </Sheet>
      <Sheet open={!!projForm} onClose={() => setProjForm(null)} title={projForm === "new" ? "Novo projeto" : "Editar projeto"} wide>{projForm && <ProjectForm project={projForm === "new" ? null : projForm} area={area} onDone={() => setProjForm(null)} />}</Sheet>
      <Sheet open={!!taskForm} onClose={() => setTaskForm(null)} title={taskForm?.task ? "Editar tarefa" : "Nova tarefa"}>{taskForm && <TaskForm task={taskForm.task} onDone={() => setTaskForm(null)} defaults={{ area: area === "pessoal" ? "pessoal" : area, project_id: taskForm.project_id }} />}</Sheet>
      <Sheet open={!!timeForm} onClose={() => setTimeForm(null)} title="Registrar horas">{timeForm && <TimeForm projects={areaProjects} projectId={timeForm.project_id} onDone={() => setTimeForm(null)} />}</Sheet>
      <ConfirmDialog open={!!del} danger title="Confirmar exclusão" message={`Excluir ${del?.label}?${del?.table === "projects" ? " As tarefas ficam sem projeto; etapas e horas do projeto serão apagadas." : ""}`} confirmLabel="Excluir" onCancel={() => setDel(null)} onConfirm={async () => { await mutate({ action: "delete", table: del!.table, id: del!.id }); setDel(null); toast.show("Excluído.", "success"); }} />
    </>
  );
}

function StagesEditor({ project }: { project: Project }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const stages = [...(project.project_stages ?? [])].sort((a, b) => a.position - b.position);
  return (
    <div>
      <p className="eyebrow mb-1">Etapas</p>
      <ul className="space-y-1.5">
        {stages.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <button onClick={() => mutate({ action: "update", table: "project_stages", id: s.id, values: { done: !s.done } }).then(() => undefined)} aria-pressed={s.done} aria-label={`Concluir etapa ${s.title}`} className={cn("grid size-6 place-items-center rounded-full border-2", s.done ? "border-success bg-success text-white" : "border-iris")}>{s.done && <Check className="size-3.5" />}</button>
            <span className={cn("flex-1", s.done && "text-muted line-through")}>{s.title}</span>
            {s.due_date && <span className="text-xs text-muted">{formatDateBR(s.due_date)}</span>}
            <button aria-label="Remover etapa" onClick={() => mutate({ action: "delete", table: "project_stages", id: s.id })} className="text-muted"><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!title.trim()) return; await mutate({ action: "insert", table: "project_stages", values: { project_id: project.id, title: title.trim(), due_date: due || null, position: stages.length } }); setTitle(""); setDue(""); }}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nova etapa" aria-label="Nova etapa" />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-40" aria-label="Prazo da etapa" />
        <Button type="submit" size="icon" variant="soft" aria-label="Adicionar etapa"><Plus className="size-4" /></Button>
      </form>
    </div>
  );
}

function ProjectForm({ project, area, onDone }: { project: Project | null; area: string; onDone: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ name: project?.name ?? "", objective: project?.objective ?? "", description: project?.description ?? "", client: project?.client ?? "", status: project?.status ?? "em_andamento", start_date: project?.start_date ?? "", due_date: project?.due_date ?? "", color: project?.color ?? "#7451A6", notes: project?.notes ?? "", area: project?.area ?? area });
  const [links, setLinks] = useState(project?.links ?? []);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!v.name.trim()) return toast.show("Dê um nome ao projeto.", "error");
      if (v.start_date && v.due_date && v.due_date < v.start_date) return toast.show("O prazo deve ser depois do início.", "error");
      const cleanLinks = links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim(), url: /^https?:\/\//.test(l.url) ? l.url.trim() : `https://${l.url.trim()}` }));
      setSaving(true);
      try {
        const values = { ...v, name: v.name.trim(), start_date: v.start_date || null, due_date: v.due_date || null, client: v.client || null, objective: v.objective || null, description: v.description || null, notes: v.notes || null, links: cleanLinks };
        if (project) await mutate({ action: "update", table: "projects", id: project.id, values });
        else await mutate({ action: "insert", table: "projects", values: { id: newId(), ...values } });
        toast.show("Projeto salvo.", "success");
        onDone();
      } catch (ex) {
        toast.show(ex instanceof DataError ? ex.message : "Erro ao salvar.", "error");
      } finally {
        setSaving(false);
      }
    }}>
      <Field label="Nome">{(id) => <Input id={id} value={v.name} onChange={set("name")} maxLength={120} />}</Field>
      <Field label="Objetivo">{(id) => <Input id={id} value={v.objective} onChange={set("objective")} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Área">{(id) => <Select id={id} value={v.area} onChange={set("area")}><option value="trabalho">Profissional</option><option value="estudos">Acadêmico</option><option value="pessoal">Pessoal</option></Select>}</Field>
        <Field label="Status">{(id) => <Select id={id} value={v.status} onChange={set("status")}>{STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</Select>}</Field>
        <Field label="Cliente">{(id) => <Input id={id} value={v.client} onChange={set("client")} />}</Field>
        <Field label="Cor">{(id) => <Input id={id} type="color" value={v.color} onChange={set("color")} className="h-11 p-1" />}</Field>
        <Field label="Início">{(id) => <Input id={id} type="date" value={v.start_date} onChange={set("start_date")} />}</Field>
        <Field label="Prazo">{(id) => <Input id={id} type="date" value={v.due_date} onChange={set("due_date")} />}</Field>
      </div>
      <Field label="Descrição">{(id) => <Textarea id={id} value={v.description} onChange={set("description")} rows={3} />}</Field>
      <div>
        <span className="label">Arquivos e links</span>
        {links.map((l, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <Input value={l.label} onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} placeholder="Nome" aria-label="Nome do link" className="w-1/3" />
            <Input value={l.url} onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} placeholder="https://" aria-label="Endereço do link" />
            <Button size="icon" variant="ghost" aria-label="Remover link" onClick={() => setLinks((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" icon={<Link2 className="size-4" />} onClick={() => setLinks((x) => [...x, { label: "", url: "" }])}>Adicionar link</Button>
      </div>
      <Field label="Anotações">{(id) => <Textarea id={id} value={v.notes} onChange={set("notes")} rows={3} />}</Field>
      <Button type="submit" className="w-full" loading={saving}>Salvar projeto</Button>
    </form>
  );
}

function TimeForm({ projects, projectId, onDone }: { projects: Project[]; projectId?: string; onDone: () => void }) {
  const { today } = useSession();
  const toast = useToast();
  const [project, setProject] = useState(projectId ?? "");
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const [desc, setDesc] = useState("");
  const total = useMemo(() => (Number(hours) || 0) * 60 + (Number(minutes) || 0), [hours, minutes]);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!(total >= 1 && total <= 1440)) return toast.show("Informe entre 1 minuto e 24 horas.", "error");
      await mutate({ action: "insert", table: "time_entries", values: { project_id: project || null, worked_on: date, duration_minutes: total, description: desc || null } });
      toast.show("Horas registradas.", "success");
      onDone();
    }}>
      <Field label="Projeto">{(id) => <Select id={id} value={project} onChange={(e) => setProject(e.target.value)}><option value="">Sem projeto</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Data">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Horas">{(id) => <Input id={id} type="number" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} />}</Field>
        <Field label="Minutos">{(id) => <Input id={id} type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} />}</Field>
      </div>
      <Field label="Descrição">{(id) => <Input id={id} value={desc} onChange={(e) => setDesc(e.target.value)} />}</Field>
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );
}
