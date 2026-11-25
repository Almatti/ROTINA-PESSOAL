"use client";
import { useState } from "react";
import { GraduationCap, Plus, Pencil, Trash2, Link2, Check, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, Field, Input, Select, Textarea, Segmented, EmptyState, ProgressBar, Badge, Stat, Toggle, cn } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { Bars, CHART_COLORS } from "@/components/charts";
import { useSession } from "@/lib/session";
import { useTable } from "@/lib/data/hooks";
import { mutate, newId, DataError } from "@/lib/data/store";
import { formatDateBR, addDays, startOfWeek, minutesToLabel, diffDays, formatDayMonth } from "@/lib/domain/dates";
import { useToast } from "@/components/ui/toast";

interface Course { id: string; name: string; kind: string; institution: string | null; color: string; weekly_goal_minutes: number | null; total_lessons: number | null; lessons_done: number; links: { label: string; url: string }[]; status: string; notes: string | null }
interface StudySession { id: string; course_id: string | null; studied_on: string; duration_minutes: number; topic: string | null }
interface Assessment { id: string; course_id: string | null; type: "prova" | "trabalho" | "revisao" | "aula"; title: string; due_date: string | null; grade: string | null; max_grade: string | null; weight: string | null; done: boolean; notes: string | null }
const TYPE_LABEL = { prova: "Prova", trabalho: "Trabalho", revisao: "Revisão", aula: "Aula" } as const;

export default function StudiesPage() {
  const { today } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<"cursos" | "agenda" | "horas" | "notas">("cursos");
  const { data: courses = [] } = useTable<Course>("courses", { order: "created_at" });
  const { data: sessions = [] } = useTable<StudySession>("study_sessions", { order: "studied_on", ascending: false, limit: 1000 });
  const { data: items = [] } = useTable<Assessment>("assessments", { order: "due_date" });
  const [courseForm, setCourseForm] = useState<Course | null | "new">(null);
  const [itemForm, setItemForm] = useState<Assessment | null | { type: Assessment["type"]; course_id?: string }>(null);
  const [sessionForm, setSessionForm] = useState<{ course_id?: string } | null>(null);
  const [del, setDel] = useState<{ table: string; id: string; label: string } | null>(null);
  const ws = startOfWeek(today);
  const weekMin = sessions.filter((s) => s.studied_on >= ws).reduce((t, s) => t + s.duration_minutes, 0);
  const graded = items.filter((i) => i.grade && i.max_grade);
  const avgGrade = graded.length ? graded.reduce((t, i) => t + (Number(i.grade) / Number(i.max_grade)) * 10, 0) / graded.length : null;
  const upcoming = items.filter((i) => !i.done && i.due_date && i.due_date >= addDays(today, -30)).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name ?? "Geral";
  const chart = Array.from({ length: 8 }, (_, i) => {
    const s = addDays(ws, -7 * (7 - i));
    return { semana: formatDayMonth(s), Horas: Math.round((sessions.filter((x) => x.studied_on >= s && x.studied_on < addDays(s, 7)).reduce((t, x) => t + x.duration_minutes, 0) / 60) * 10) / 10 };
  });

  return (
    <>
      <PageHeader title="Estudos" icon={<GraduationCap className="size-5" />} actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setSessionForm({})}>Estudei</Button>} />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Nesta semana" value={minutesToLabel(weekMin)} icon="📚" />
        <Stat label="Próximas entregas" value={upcoming.filter((u) => u.type !== "aula" && u.due_date! >= today).length} icon="🗓️" />
        <Stat label="Média geral" value={avgGrade !== null ? avgGrade.toFixed(1) : "—"} sub="escala 0–10" icon="⭐" />
      </div>
      <div className="mt-4"><Segmented label="Seções" value={tab} onChange={setTab} options={[{ value: "cursos", label: "Cursos" }, { value: "agenda", label: "Cronograma" }, { value: "horas", label: "Horas" }, { value: "notas", label: "Notas" }]} /></div>

      {tab === "cursos" && (
        <div className="mt-4 space-y-3">
          <Button variant="soft" className="w-full" icon={<Plus className="size-4" />} onClick={() => setCourseForm("new")}>Novo curso ou disciplina</Button>
          {courses.length === 0 ? <EmptyState icon="🎓" title="Cadastre seus cursos e disciplinas" /> : courses.map((c) => {
            const min = sessions.filter((s) => s.course_id === c.id && s.studied_on >= ws).reduce((t, s) => t + s.duration_minutes, 0);
            return (
              <Card key={c.id} className="space-y-2" style={{ borderLeft: `5px solid ${c.color}` }}>
                <div className="flex items-start gap-2">
                  <div className="flex-1"><h3 className="font-bold">{c.name}</h3><p className="text-xs text-muted">{({ curso: "Curso", disciplina: "Disciplina", idioma: "Idioma", certificacao: "Certificação" } as Record<string, string>)[c.kind]}{c.institution ? ` · ${c.institution}` : ""} · {c.status.replace("_", " ")}</p></div>
                  <Button size="icon" variant="ghost" aria-label={`Editar ${c.name}`} onClick={() => setCourseForm(c)}><Pencil className="size-4" /></Button>
                </div>
                {c.weekly_goal_minutes ? <div><div className="flex justify-between text-xs"><span>Meta semanal</span><span>{minutesToLabel(min)} / {minutesToLabel(c.weekly_goal_minutes)}</span></div><ProgressBar value={(min / c.weekly_goal_minutes) * 100} className="mt-1" label="Meta semanal de estudo" /></div> : null}
                {c.total_lessons ? (
                  <div className="flex items-center gap-2 text-xs"><span className="flex-1">Aulas: {c.lessons_done}/{c.total_lessons}</span>
                    <Button size="sm" variant="soft" onClick={() => mutate({ action: "update", table: "courses", id: c.id, values: { lessons_done: Math.min(c.total_lessons!, c.lessons_done + 1) } })}>+1 aula assistida</Button>
                  </div>
                ) : null}
                {c.links.length > 0 && <div className="flex flex-wrap gap-2">{c.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2.5 py-1 text-xs text-primary"><Link2 className="size-3" aria-hidden />{l.label || "Material"}</a>)}</div>}
                <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSessionForm({ course_id: c.id })}>Registrar estudo</Button><Button size="sm" variant="outline" onClick={() => setItemForm({ type: "prova", course_id: c.id })}>+ Prova/trabalho</Button></div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "agenda" && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(Object.keys(TYPE_LABEL) as Assessment["type"][]).map((t) => <Button key={t} size="sm" variant="outline" onClick={() => setItemForm({ type: t })}>+ {TYPE_LABEL[t]}</Button>)}</div>
          {upcoming.length === 0 ? <EmptyState icon="🗓️" title="Nada no cronograma" /> : upcoming.map((i) => {
            const days = i.due_date ? diffDays(i.due_date, today) : null;
            return (
              <div key={i.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft-sm">
                <button onClick={() => mutate({ action: "update", table: "assessments", id: i.id, values: { done: !i.done } })} aria-pressed={i.done} aria-label={`Concluir ${i.title}`} className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2", i.done ? "border-success bg-success text-white" : "border-iris")}>{i.done && <Check className="size-4" />}</button>
                <button onClick={() => setItemForm(i)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5"><Badge tone={i.type === "prova" ? "error" : i.type === "trabalho" ? "warning" : i.type === "revisao" ? "primary" : "info"}>{TYPE_LABEL[i.type]}</Badge><span className="truncate text-xs text-muted">{courseName(i.course_id)}</span></div>
                  <p className="truncate font-semibold">{i.title}</p>
                </button>
                <span className={cn("text-xs font-semibold", days !== null && days < 0 ? "text-error" : days !== null && days <= 3 ? "text-warning" : "text-muted")}>{i.due_date ? (days === 0 ? "Hoje" : days! < 0 ? `${-days!}d atrás` : `em ${days}d`) : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === "horas" && (
        <div className="mt-4 space-y-3">
          <Card><h2 className="mb-2 font-bold">Horas estudadas por semana</h2><Bars data={chart} xKey="semana" series={[{ key: "Horas", label: "Horas", color: CHART_COLORS[3] }]} format={(v) => `${v}h`} /></Card>
          <Card className="divide-y divide-line py-1">
            {sessions.length === 0 && <p className="py-3 text-sm text-muted">Nenhuma sessão registrada.</p>}
            {sessions.slice(0, 40).map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5">
                <BookOpen className="size-4 text-primary" aria-hidden />
                <div className="flex-1"><p className="font-semibold">{minutesToLabel(s.duration_minutes)} · {courseName(s.course_id)}</p><p className="text-xs text-muted">{formatDateBR(s.studied_on)}{s.topic ? ` · ${s.topic}` : ""}</p></div>
                <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => setDel({ table: "study_sessions", id: s.id, label: "esta sessão" })}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === "notas" && (
        <div className="mt-4 space-y-3">
          {courses.map((c) => {
            const g = items.filter((i) => i.course_id === c.id && i.grade && i.max_grade);
            if (!g.length) return null;
            const totalW = g.reduce((t, i) => t + (Number(i.weight) || 1), 0);
            const avg = g.reduce((t, i) => t + (Number(i.grade) / Number(i.max_grade)) * 10 * (Number(i.weight) || 1), 0) / totalW;
            return (
              <Card key={c.id}>
                <div className="flex justify-between"><h3 className="font-bold">{c.name}</h3><span className={cn("font-bold", avg >= 7 ? "text-success" : avg >= 5 ? "text-warning" : "text-error")}>{avg.toFixed(1)}</span></div>
                <ul className="mt-2 divide-y divide-line text-sm">{g.map((i) => <li key={i.id} className="flex justify-between py-1.5"><span>{i.title}</span><span>{Number(i.grade)} / {Number(i.max_grade)}{i.weight ? ` · peso ${Number(i.weight)}` : ""}</span></li>)}</ul>
              </Card>
            );
          })}
          {graded.length === 0 && <EmptyState icon="⭐" title="Nenhuma nota registrada" description="Edite uma prova ou trabalho do cronograma para lançar a nota." />}
        </div>
      )}

      <Sheet open={!!courseForm} onClose={() => setCourseForm(null)} title={courseForm === "new" ? "Novo curso" : "Editar curso"} footer={courseForm && courseForm !== "new" && <Button variant="ghost" className="w-full text-error" onClick={() => { setDel({ table: "courses", id: courseForm.id, label: courseForm.name }); setCourseForm(null); }}>Excluir curso</Button>}>
        {courseForm && <CourseForm course={courseForm === "new" ? null : courseForm} onDone={() => setCourseForm(null)} />}
      </Sheet>
      <Sheet open={!!itemForm} onClose={() => setItemForm(null)} title={itemForm && "id" in itemForm ? "Editar" : `Novo(a) ${itemForm ? TYPE_LABEL[itemForm.type].toLowerCase() : ""}`} footer={itemForm && "id" in itemForm && <Button variant="ghost" className="w-full text-error" onClick={() => { setDel({ table: "assessments", id: itemForm.id, label: itemForm.title }); setItemForm(null); }}>Excluir</Button>}>
        {itemForm && <AssessmentForm item={"id" in itemForm ? itemForm : null} defaults={"id" in itemForm ? undefined : itemForm} courses={courses} onDone={() => setItemForm(null)} />}
      </Sheet>
      <Sheet open={!!sessionForm} onClose={() => setSessionForm(null)} title="Registrar estudo">{sessionForm && <SessionForm courses={courses} courseId={sessionForm.course_id} onDone={() => setSessionForm(null)} />}</Sheet>
      <ConfirmDialog open={!!del} danger title="Confirmar exclusão" message={`Excluir ${del?.label}?`} confirmLabel="Excluir" onCancel={() => setDel(null)} onConfirm={async () => { await mutate({ action: "delete", table: del!.table, id: del!.id }); setDel(null); toast.show("Excluído.", "success"); }} />
    </>
  );
}

function CourseForm({ course, onDone }: { course: Course | null; onDone: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ name: course?.name ?? "", kind: course?.kind ?? "curso", institution: course?.institution ?? "", color: course?.color ?? "#88708E", weekly: course?.weekly_goal_minutes ? String(course.weekly_goal_minutes / 60) : "", lessons: course?.total_lessons?.toString() ?? "", status: course?.status ?? "em_andamento", notes: course?.notes ?? "" });
  const [links, setLinks] = useState(course?.links ?? []);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!v.name.trim()) return toast.show("Dê um nome.", "error");
      const values = { name: v.name.trim(), kind: v.kind, institution: v.institution || null, color: v.color, weekly_goal_minutes: v.weekly ? Math.round(Number(v.weekly.replace(",", ".")) * 60) : null, total_lessons: v.lessons ? Number(v.lessons) : null, status: v.status, notes: v.notes || null, links: links.filter((l) => l.url.trim()).map((l) => ({ label: l.label, url: /^https?:\/\//.test(l.url) ? l.url : `https://${l.url}` })) };
      try {
        if (course) await mutate({ action: "update", table: "courses", id: course.id, values });
        else await mutate({ action: "insert", table: "courses", values });
        onDone();
      } catch (ex) {
        toast.show(ex instanceof DataError ? ex.message : "Erro ao salvar.", "error");
      }
    }}>
      <Field label="Nome">{(id) => <Input id={id} value={v.name} onChange={set("name")} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">{(id) => <Select id={id} value={v.kind} onChange={set("kind")}><option value="curso">Curso</option><option value="disciplina">Disciplina</option><option value="idioma">Idioma</option><option value="certificacao">Certificação</option></Select>}</Field>
        <Field label="Status">{(id) => <Select id={id} value={v.status} onChange={set("status")}><option value="planejado">Planejado</option><option value="em_andamento">Em andamento</option><option value="pausado">Pausado</option><option value="concluido">Concluído</option></Select>}</Field>
        <Field label="Instituição">{(id) => <Input id={id} value={v.institution} onChange={set("institution")} />}</Field>
        <Field label="Cor">{(id) => <Input id={id} type="color" value={v.color} onChange={set("color")} className="h-11 p-1" />}</Field>
        <Field label="Meta semanal (horas)">{(id) => <Input id={id} inputMode="decimal" value={v.weekly} onChange={set("weekly")} />}</Field>
        <Field label="Total de aulas">{(id) => <Input id={id} type="number" min={0} value={v.lessons} onChange={set("lessons")} />}</Field>
      </div>
      <div>
        <span className="label">Materiais e links</span>
        {links.map((l, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <Input value={l.label} onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} placeholder="Nome" className="w-1/3" aria-label="Nome do material" />
            <Input value={l.url} onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} placeholder="https://" aria-label="Link" />
            <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => setLinks((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setLinks((x) => [...x, { label: "", url: "" }])}>Adicionar link</Button>
      </div>
      <Field label="Anotações">{(id) => <Textarea id={id} value={v.notes} onChange={set("notes")} rows={2} />}</Field>
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );
}

function AssessmentForm({ item, defaults, courses, onDone }: { item: Assessment | null; defaults?: { type: Assessment["type"]; course_id?: string }; courses: Course[]; onDone: () => void }) {
  const { today } = useSession();
  const toast = useToast();
  const [v, setV] = useState({ type: item?.type ?? defaults?.type ?? "prova", title: item?.title ?? "", course_id: item?.course_id ?? defaults?.course_id ?? "", due_date: item?.due_date ?? today, grade: item?.grade ?? "", max_grade: item?.max_grade ?? "10", weight: item?.weight ?? "", done: item?.done ?? false, notes: item?.notes ?? "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!v.title.trim()) return toast.show("Dê um título.", "error");
      const g = v.grade ? Number(String(v.grade).replace(",", ".")) : null;
      const m = v.max_grade ? Number(String(v.max_grade).replace(",", ".")) : null;
      if (g !== null && m !== null && g > m) return toast.show("A nota não pode ser maior que a nota máxima.", "error");
      const values = { type: v.type, title: v.title.trim(), course_id: v.course_id || null, due_date: v.due_date || null, grade: g, max_grade: m, weight: v.weight ? Number(String(v.weight).replace(",", ".")) : null, done: v.done || g !== null, notes: v.notes || null };
      if (item) await mutate({ action: "update", table: "assessments", id: item.id, values });
      else await mutate({ action: "insert", table: "assessments", values });
      onDone();
    }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">{(id) => <Select id={id} value={v.type} onChange={set("type")}>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
        <Field label="Curso">{(id) => <Select id={id} value={v.course_id} onChange={set("course_id")}><option value="">Geral</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
      </div>
      <Field label="Título">{(id) => <Input id={id} value={v.title} onChange={set("title")} />}</Field>
      <Field label="Data">{(id) => <Input id={id} type="date" value={v.due_date} onChange={set("due_date")} />}</Field>
      {(v.type === "prova" || v.type === "trabalho") && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Nota">{(id) => <Input id={id} inputMode="decimal" value={v.grade} onChange={set("grade")} />}</Field>
          <Field label="Nota máxima">{(id) => <Input id={id} inputMode="decimal" value={v.max_grade} onChange={set("max_grade")} />}</Field>
          <Field label="Peso">{(id) => <Input id={id} inputMode="decimal" value={v.weight} onChange={set("weight")} />}</Field>
        </div>
      )}
      <Toggle checked={v.done} onChange={(b) => setV((s) => ({ ...s, done: b }))} label="Concluído" />
      <Field label="Observações">{(id) => <Textarea id={id} value={v.notes} onChange={set("notes")} rows={2} />}</Field>
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );
}

function SessionForm({ courses, courseId, onDone }: { courses: Course[]; courseId?: string; onDone: () => void }) {
  const { today } = useSession();
  const toast = useToast();
  const [course, setCourse] = useState(courseId ?? "");
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState("30");
  const [topic, setTopic] = useState("");
  const [reviews, setReviews] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const m = Number(minutes);
      if (!(m >= 1 && m <= 1440)) return toast.show("Informe a duração em minutos.", "error");
      await mutate({ action: "insert", table: "study_sessions", values: { course_id: course || null, studied_on: date, duration_minutes: m, topic: topic || null } });
      if (reviews && topic.trim()) {
        // revisões espaçadas: 1, 7 e 30 dias
        await mutate({ action: "insert", table: "assessments", values: [1, 7, 30].map((d) => ({ id: newId(), type: "revisao", title: `Revisar: ${topic.trim()}`, course_id: course || null, due_date: addDays(date, d) })) });
      }
      toast.show("Estudo registrado! 📚", "success");
      onDone();
    }}>
      <Field label="Curso/disciplina">{(id) => <Select id={id} value={course} onChange={(e) => setCourse(e.target.value)}><option value="">Geral</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Minutos">{(id) => <Input id={id} type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />}</Field>
      </div>
      <Field label="Assunto">{(id) => <Input id={id} value={topic} onChange={(e) => setTopic(e.target.value)} />}</Field>
      <Toggle checked={reviews} onChange={setReviews} label="Agendar revisões" description="Cria revisões em 1, 7 e 30 dias (repetição espaçada)." />
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );
}
