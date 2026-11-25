"use client";
import { useMemo, useState } from "react";
import { CheckSquare, Search, Plus, List, Columns3, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Chip, Input, Select, Segmented, EmptyState, Skeleton, Stat, cn, ErrorNote } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { TaskForm } from "@/components/forms/task-form";
import { TaskRow } from "@/components/plan/task-row";
import { useSession } from "@/lib/session";
import { useTasks, useCategories } from "@/lib/data/hooks";
import { mutate } from "@/lib/data/store";
import { setTaskDone } from "@/lib/data/actions";
import { effectiveStatus, sortTasks, productivityStats, PRIORITY_WEIGHT, STATUS_LABEL, type EffectiveStatus } from "@/lib/domain/tasks";
import { localDateISO, minutesToLabel } from "@/lib/domain/dates";
import { useToast } from "@/components/ui/toast";
import type { Task } from "@/lib/types";

const COLUMNS: { status: Task["status"]; label: string; tone: string }[] = [
  { status: "pendente", label: "Pendente", tone: "bg-surface-2" },
  { status: "em_andamento", label: "Em andamento", tone: "bg-info-soft/60" },
  { status: "concluida", label: "Concluída", tone: "bg-success-soft/60" },
  { status: "cancelada", label: "Cancelada", tone: "bg-surface-3/60" },
];

export default function TasksPage() {
  const { today, tz } = useSession();
  const toast = useToast();
  const { data: tasks, loading, error, refresh } = useTasks({ includeDone: true, key: "all" });
  const { data: categories } = useCategories("tarefa");
  const [mode, setMode] = useState<"lista" | "kanban">("lista");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<EffectiveStatus | "abertas" | "todas">("abertas");
  const [area, setArea] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"padrao" | "prioridade" | "criacao" | "titulo">("padrao");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const all = useMemo(() => tasks ?? [], [tasks]);
  const stats = productivityStats(all, today, (iso) => localDateISO(new Date(iso), tz));

  const list = useMemo(() => {
    let l = all.filter((t) => {
      const st = effectiveStatus(t, today);
      if (status === "abertas" && (st === "concluida" || st === "cancelada")) return false;
      if (status !== "abertas" && status !== "todas" && st !== status) return false;
      if (area && t.area !== area) return false;
      if (priority && t.priority !== priority) return false;
      if (category && t.category_id !== category) return false;
      if (q && !`${t.title} ${t.description ?? ""} ${t.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    if (sort === "padrao") l = sortTasks(l, today);
    else if (sort === "prioridade") l = [...l].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
    else if (sort === "criacao") l = [...l].sort((a, b) => b.created_at.localeCompare(a.created_at));
    else l = [...l].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    return l;
  }, [all, status, area, priority, category, q, sort, today]);

  async function moveTo(id: string, st: Task["status"]) {
    const t = all.find((x) => x.id === id);
    if (!t || t.status === st) return;
    if (st === "concluida") await setTaskDone(t, true, today);
    else await mutate({ action: "update", table: "tasks", id, values: { status: st, completed_at: null } });
  }

  return (
    <>
      <PageHeader title="Tarefas" icon={<CheckSquare className="size-5" />} actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nova</Button>} />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Indicadores de produtividade">
        <Stat label="Concluídas hoje" value={stats.completedToday} icon="✅" />
        <Stat label="Na semana" value={stats.completedWeek} icon="📈" />
        <Stat label="Em aberto" value={stats.open} sub={stats.overdue ? `${stats.overdue} atrasada(s)` : "nenhuma atrasada"} icon="📋" />
        <Stat label="Conclusão (7 dias)" value={`${stats.completionRateWeek}%`} sub={stats.plannedMinutesToday ? `${minutesToLabel(stats.plannedMinutesToday)} planejadas hoje` : undefined} icon="🎯" />
      </section>

      <div className="mt-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar tarefas" className="pl-9" aria-label="Pesquisar tarefas" />
          </div>
          <div className="w-36"><Segmented label="Modo de visualização" value={mode} onChange={(m) => { setMode(m); if (m === "kanban") setStatus("todas"); }} options={[{ value: "lista", label: <List className="mx-auto size-4" aria-label="Lista" /> }, { value: "kanban", label: <Columns3 className="mx-auto size-4" aria-label="Kanban" /> }]} /></div>
        </div>
        <div className="scroll-x -mx-4 flex gap-2 px-4">
          {(["abertas", "pendente", "em_andamento", "atrasada", "concluida", "cancelada", "todas"] as const).map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s === "abertas" ? "Em aberto" : s === "todas" ? "Todas" : STATUS_LABEL[s]}</Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por área"><option value="">Todas as áreas</option><option value="pessoal">Pessoal</option><option value="trabalho">Trabalho</option><option value="estudos">Estudos</option><option value="casa">Casa</option></Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filtrar por prioridade"><option value="">Toda prioridade</option><option value="urgente">Urgente</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Ordenar"><option value="padrao">Ordenar: prazo</option><option value="prioridade">Prioridade</option><option value="criacao">Mais recentes</option><option value="titulo">A–Z</option></Select>
        </div>
      </div>

      {error && <div className="mt-4"><ErrorNote message={error} onRetry={refresh} /></div>}
      {loading && !tasks ? (
        <div className="mt-4 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : mode === "lista" ? (
        <div className="mt-4 space-y-2.5">
          {list.length === 0 ? <EmptyState icon="📝" title="Nenhuma tarefa encontrada" description="Crie uma tarefa ou ajuste os filtros." action={<Button onClick={() => setCreating(true)}>Nova tarefa</Button>} /> : list.map((t) => <TaskRow key={t.id} task={t} today={today} onEdit={() => setEditing(t)} />)}
        </div>
      ) : (
        <div className="scroll-x -mx-4 mt-4 flex gap-3 px-4 pb-2">
          {COLUMNS.map((c) => {
            const items = all.filter((t) => t.status === c.status && list.some((x) => x.id === t.id));
            return (
              <section key={c.status} aria-label={c.label} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void moveTo(e.dataTransfer.getData("text/plain"), c.status); }} className={cn("w-72 shrink-0 rounded-card p-3", c.tone)}>
                <h2 className="mb-2 flex justify-between text-sm font-bold">{c.label}<span className="text-muted">{items.length}</span></h2>
                <div className="space-y-2">
                  {items.map((t) => (
                    <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)} className="cursor-grab active:cursor-grabbing">
                      <TaskRow task={t} today={today} onEdit={() => setEditing(t)} compact />
                      <label className="sr-only" htmlFor={`mv-${t.id}`}>Mover {t.title}</label>
                      <select id={`mv-${t.id}`} value={t.status} onChange={(e) => moveTo(t.id, e.target.value as Task["status"])} className="mt-1 w-full rounded-xl bg-surface px-2 py-1 text-xs text-muted">
                        {COLUMNS.map((x) => <option key={x.status} value={x.status}>Mover para: {x.label}</option>)}
                      </select>
                    </div>
                  ))}
                  {!items.length && <p className="py-6 text-center text-xs text-muted">Arraste tarefas para cá</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="Nova tarefa">{creating && <TaskForm onDone={() => setCreating(false)} defaults={{ due_date: today }} />}</Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar tarefa" footer={editing && <Button variant="ghost" className="w-full text-error" icon={<Trash2 className="size-4" />} onClick={() => { setDeleting(editing); setEditing(null); }}>Excluir tarefa</Button>}>
        {editing && <TaskForm task={editing} onDone={() => setEditing(null)} />}
      </Sheet>
      <ConfirmDialog open={!!deleting} danger title="Excluir tarefa?" message={`“${deleting?.title}” e suas subtarefas serão excluídas.`} confirmLabel="Excluir" onCancel={() => setDeleting(null)} onConfirm={async () => { await mutate({ action: "delete", table: "tasks", id: deleting!.id }); setDeleting(null); toast.show("Tarefa excluída.", "success"); }} />
    </>
  );
}
