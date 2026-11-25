"use client";
import { useMemo, useState } from "react";
import { Markdown } from "@/components/markdown";
import { NotebookPen, Plus, Search, Star, Pin, Folder, Trash2, Paperclip, Link2, CheckSquare, Eye, Pencil, Archive, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Chip, Field, Input, Select, Textarea, EmptyState, Badge, Segmented, cn } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { useSession } from "@/lib/session";
import { useTable, useCategories } from "@/lib/data/hooks";
import { mutate, newId } from "@/lib/data/store";
import { uploadUserFile, useFileUrl } from "@/lib/files";
import { getSupabase } from "@/lib/supabase/client";
import { formatDateBR, localDateISO } from "@/lib/domain/dates";
import { useToast } from "@/components/ui/toast";

interface Note { id: string; title: string; content: string; kind: "nota" | "lista" | "ideia" | "diario"; folder_id: string | null; category_id: string | null; tags: string[]; checklist: { id: string; label: string; done: boolean }[]; links: { label: string; url: string }[]; is_favorite: boolean; is_pinned: boolean; archived: boolean; task_id: string | null; project_id: string | null; event_id: string | null; updated_at: string }
interface FolderRow { id: string; name: string; color: string }
interface Attachment { id: string; note_id: string; storage_path: string; file_name: string; mime_type: string | null; size_bytes: number | null }

export default function NotesPage() {
  const { today, tz } = useSession();
  const toast = useToast();
  const { data: notes = [] } = useTable<Note>("notes", { order: "updated_at", ascending: false });
  const { data: folders = [] } = useTable<FolderRow>("note_folders", { order: "name" });
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState<string>("");
  const [filter, setFilter] = useState<"todas" | "favoritas" | "listas" | "ideias" | "arquivadas">("todas");
  const [tag, setTag] = useState("");
  const [open, setOpen] = useState<Note | null | "new">(null);
  const [folderForm, setFolderForm] = useState(false);
  const allTags = [...new Set(notes.flatMap((n) => n.tags))].sort();

  const list = useMemo(() => notes
    .filter((n) => (filter === "arquivadas" ? n.archived : !n.archived))
    .filter((n) => filter !== "favoritas" || n.is_favorite)
    .filter((n) => filter !== "listas" || n.kind === "lista")
    .filter((n) => filter !== "ideias" || n.kind === "ideia")
    .filter((n) => !folder || n.folder_id === folder)
    .filter((n) => !tag || n.tags.includes(tag))
    .filter((n) => !q || `${n.title} ${n.content} ${n.tags.join(" ")} ${n.checklist.map((c) => c.label).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned)), [notes, filter, folder, tag, q]);

  return (
    <>
      <PageHeader title="Anotações" icon={<NotebookPen className="size-5" />} subtitle="Tire da cabeça. Guarde num lugar só." actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setOpen("new")}>Nova</Button>} />
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar em todas as notas" className="pl-9" aria-label="Pesquisar notas" /></div>
      <div className="scroll-x -mx-4 mt-3 flex gap-2 px-4">
        {(["todas", "favoritas", "listas", "ideias", "arquivadas"] as const).map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</Chip>)}
      </div>
      <div className="scroll-x -mx-4 mt-2 flex gap-2 px-4">
        <Chip active={!folder} onClick={() => setFolder("")}><Folder className="size-4" aria-hidden />Todas as pastas</Chip>
        {folders.map((f) => <Chip key={f.id} active={folder === f.id} onClick={() => setFolder(f.id)}><span className="size-2.5 rounded-full" style={{ background: f.color }} aria-hidden />{f.name}</Chip>)}
        <Chip onClick={() => setFolderForm(true)}><Plus className="size-4" aria-hidden />Pasta</Chip>
      </div>
      {allTags.length > 0 && <div className="scroll-x -mx-4 mt-2 flex gap-1.5 px-4">{allTags.map((t) => <button key={t} onClick={() => setTag(tag === t ? "" : t)} className={cn("shrink-0 rounded-pill px-2.5 py-1 text-xs", tag === t ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-soft")}>#{t}</button>)}</div>}

      {list.length === 0 ? <div className="mt-6"><EmptyState icon="💭" title="Nenhuma nota por aqui" description="Ideias, listas, referências e lembretes — tudo num lugar só." action={<Button onClick={() => setOpen("new")}>Criar nota</Button>} /></div> : (
        <div className="mt-4 columns-1 gap-3 sm:columns-2 lg:columns-3">
          {list.map((n) => (
            <button key={n.id} onClick={() => setOpen(n)} className="card card-hover mb-3 block w-full break-inside-avoid p-4 text-left">
              <div className="flex items-start gap-2">
                <p className="flex-1 font-semibold">{n.title || "Sem título"}</p>
                {n.is_pinned && <Pin className="size-4 text-primary" aria-label="Fixada" />}
                {n.is_favorite && <Star className="size-4 fill-warning text-warning" aria-label="Favorita" />}
              </div>
              {n.kind === "lista" && n.checklist.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">{n.checklist.slice(0, 5).map((c) => <li key={c.id} className={cn(c.done && "line-through opacity-60")}>☐ {c.label}</li>)}</ul>
              ) : <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-ink-soft">{n.content}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <Badge tone={n.kind === "ideia" ? "warning" : n.kind === "lista" ? "info" : "neutral"}>{n.kind}</Badge>
                {n.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}
                <span className="ml-auto">{formatDateBR(localDateISO(new Date(n.updated_at), tz))}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open === "new" ? "Nova nota" : "Nota"} wide>{open && <NoteEditor note={open === "new" ? null : open} folders={folders} defaultFolder={folder} onDone={() => setOpen(null)} today={today} />}</Sheet>
      <Sheet open={folderForm} onClose={() => setFolderForm(false)} title="Nova pasta">
        <FolderForm onDone={() => setFolderForm(false)} folders={folders} onDelete={async (id) => { await mutate({ action: "delete", table: "note_folders", id }); toast.show("Pasta removida (as notas foram mantidas).", "success"); }} />
      </Sheet>
    </>
  );
}

function FolderForm({ onDone, folders, onDelete }: { onDone: () => void; folders: FolderRow[]; onDelete: (id: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#BAAAC8");
  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await mutate({ action: "insert", table: "note_folders", values: { name: name.trim().slice(0, 60), color } }); setName(""); onDone(); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da pasta" aria-label="Nome da pasta" />
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-14 p-1" aria-label="Cor" />
        <Button type="submit">Criar</Button>
      </form>
      {folders.length > 0 && <ul className="divide-y divide-line">{folders.map((f) => <li key={f.id} className="flex items-center gap-2 py-2"><span className="size-3 rounded-full" style={{ background: f.color }} /><span className="flex-1">{f.name}</span><Button size="icon" variant="ghost" aria-label={`Excluir pasta ${f.name}`} onClick={() => onDelete(f.id)}><Trash2 className="size-4" /></Button></li>)}</ul>}
    </div>
  );
}

function AttachmentItem({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  const url = useFileUrl(a.storage_path);
  return (
    <li className="flex items-center gap-2 rounded-xl bg-surface-2 p-2 text-sm">
      <Paperclip className="size-4 text-muted" aria-hidden />
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary underline">{a.file_name}</a> : <span className="flex-1 truncate">{a.file_name}</span>}
      <button onClick={onRemove} aria-label={`Remover ${a.file_name}`} className="text-muted"><X className="size-4" /></button>
    </li>
  );
}

function NoteEditor({ note, folders, defaultFolder, onDone, today }: { note: Note | null; folders: FolderRow[]; defaultFolder: string; onDone: () => void; today: string }) {
  const toast = useToast();
  const { user } = useSession();
  const { data: tasks = [] } = useTable<{ id: string; title: string }>("tasks", { select: "id,title", order: "created_at", ascending: false, limit: 200, key: "picker" });
  const { data: projects = [] } = useTable<{ id: string; name: string }>("projects", { select: "id,name", order: "name", key: "picker" });
  const { data: events = [] } = useTable<{ id: string; title: string }>("events", { select: "id,title", order: "starts_at", ascending: false, limit: 200, key: "picker" });
  const { data: categories } = useCategories("nota");
  const { data: attachments = [] } = useTable<Attachment>("note_attachments", { filter: note ? { note_id: note.id } : { note_id: "00000000-0000-0000-0000-000000000000" }, key: note?.id ?? "none" });
  const [id] = useState(note?.id ?? newId());
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [kind, setKind] = useState<Note["kind"]>(note?.kind ?? "nota");
  const [folder, setFolder] = useState(note?.folder_id ?? defaultFolder ?? "");
  const [category, setCategory] = useState(note?.category_id ?? "");
  const [tags, setTags] = useState((note?.tags ?? []).join(", "));
  const [checklist, setChecklist] = useState(note?.checklist ?? []);
  const [links, setLinks] = useState(note?.links ?? []);
  const [fav, setFav] = useState(note?.is_favorite ?? false);
  const [pinned, setPinned] = useState(note?.is_pinned ?? false);
  const [rel, setRel] = useState({ task_id: note?.task_id ?? "", project_id: note?.project_id ?? "", event_id: note?.event_id ?? "" });
  const [preview, setPreview] = useState(false);
  const [item, setItem] = useState("");
  const [del, setDel] = useState(false);
  const [saving, setSaving] = useState(false);

  const values = () => ({
    title: title.trim().slice(0, 200), content, kind, folder_id: folder || null, category_id: category || null,
    tags: tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 20), checklist,
    links: links.filter((l) => l.url.trim()).map((l) => ({ label: l.label, url: /^https?:\/\//.test(l.url) ? l.url : `https://${l.url}` })),
    is_favorite: fav, is_pinned: pinned, task_id: rel.task_id || null, project_id: rel.project_id || null, event_id: rel.event_id || null,
  });

  async function save(close = true) {
    if (!title.trim() && !content.trim() && !checklist.length) { toast.show("A nota está vazia.", "error"); return false; }
    setSaving(true);
    try {
      if (note) await mutate({ action: "update", table: "notes", id, values: values() });
      else await mutate({ action: "insert", table: "notes", values: { id, ...values() } });
      if (close) { toast.show("Nota salva.", "success"); onDone(); }
      return true;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64"><Segmented label="Tipo" value={kind} onChange={setKind} options={[{ value: "nota", label: "Nota" }, { value: "lista", label: "Lista" }, { value: "ideia", label: "Ideia" }]} /></div>
        <Button size="sm" variant={fav ? "soft" : "ghost"} aria-pressed={fav} icon={<Star className={cn("size-4", fav && "fill-warning text-warning")} />} onClick={() => setFav(!fav)}>Favorita</Button>
        <Button size="sm" variant={pinned ? "soft" : "ghost"} aria-pressed={pinned} icon={<Pin className="size-4" />} onClick={() => setPinned(!pinned)}>Fixar</Button>
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="text-lg font-bold" aria-label="Título" maxLength={200} />
      {kind === "lista" ? (
        <div>
          <ul className="space-y-1.5">
            {checklist.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2">
                <input type="checkbox" checked={c.done} onChange={(e) => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} className="size-5 accent-[var(--primary)]" aria-label={`Marcar ${c.label}`} />
                <Input value={c.label} onChange={(e) => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="min-h-9 py-1" aria-label="Item" />
                <Button size="icon" variant="ghost" aria-label="Remover item" onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
              </li>
            ))}
          </ul>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (item.trim()) { setChecklist((l) => [...l, { id: newId(), label: item.trim(), done: false }]); setItem(""); } }}>
            <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Novo item" aria-label="Novo item da lista" />
            <Button type="submit" size="icon" variant="soft" aria-label="Adicionar"><Plus className="size-4" /></Button>
          </form>
        </div>
      ) : (
        <div>
          <div className="mb-1 flex justify-end gap-1"><Button size="sm" variant={preview ? "ghost" : "soft"} icon={<Pencil className="size-3.5" />} onClick={() => setPreview(false)}>Editar</Button><Button size="sm" variant={preview ? "soft" : "ghost"} icon={<Eye className="size-3.5" />} onClick={() => setPreview(true)}>Visualizar</Button></div>
          {preview ? <div className="min-h-40 rounded-2xl bg-surface-2 p-4"><Markdown text={content || "_Nada escrito ainda_"} /></div> : <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder={"Escreva livremente…\n\nDicas: # título, **negrito**, *itálico*, - lista, [link](https://...)"} aria-label="Conteúdo" />}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pasta">{(i) => <Select id={i} value={folder} onChange={(e) => setFolder(e.target.value)}><option value="">Sem pasta</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>}</Field>
        <Field label="Categoria">{(i) => <Select id={i} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Sem categoria</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</Select>}</Field>
      </div>
      <Field label="Tags" hint="Separe por vírgulas">{(i, d) => <Input id={i} aria-describedby={d} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="trabalho, ideias" />}</Field>
      <details className="rounded-2xl bg-surface-2 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Relacionar com tarefa, projeto ou compromisso</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Select value={rel.task_id} onChange={(e) => setRel((r) => ({ ...r, task_id: e.target.value }))} aria-label="Tarefa"><option value="">Tarefa…</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select>
          <Select value={rel.project_id} onChange={(e) => setRel((r) => ({ ...r, project_id: e.target.value }))} aria-label="Projeto"><option value="">Projeto…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          <Select value={rel.event_id} onChange={(e) => setRel((r) => ({ ...r, event_id: e.target.value }))} aria-label="Compromisso"><option value="">Compromisso…</option>{events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</Select>
        </div>
      </details>
      <div>
        <span className="label">Links</span>
        {links.map((l, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <Input value={l.label} onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} placeholder="Nome" className="w-1/3" aria-label="Nome do link" />
            <Input value={l.url} onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} placeholder="https://" aria-label="Link" />
            <Button size="icon" variant="ghost" aria-label="Remover link" onClick={() => setLinks((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" icon={<Link2 className="size-4" />} onClick={() => setLinks((x) => [...x, { label: "", url: "" }])}>Adicionar link</Button>
      </div>
      <div>
        <span className="label">Anexos</span>
        <ul className="space-y-1.5">{attachments.map((a) => <AttachmentItem key={a.id} a={a} onRemove={async () => { await getSupabase().storage.from("user-files").remove([a.storage_path]); await mutate({ action: "delete", table: "note_attachments", id: a.id }); }} />)}</ul>
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-pill border border-line px-3.5 py-2 text-sm font-semibold">
          <Paperclip className="size-4" aria-hidden />Anexar arquivo (até 10 MB)
          <input type="file" className="sr-only" accept="image/*,application/pdf,text/plain" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !user) return;
            if (!note && !(await save(false))) return;
            try {
              const path = await uploadUserFile(user.id, "notas", file);
              await mutate({ action: "insert", table: "note_attachments", values: { note_id: id, storage_path: path, file_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size } });
              toast.show("Arquivo anexado.", "success");
            } catch (err) {
              toast.show((err as Error).message, "error");
            }
          }} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button className="flex-1" loading={saving} onClick={() => save()}>Salvar</Button>
        <Button variant="outline" icon={<CheckSquare className="size-4" />} onClick={async () => {
          await mutate({ action: "insert", table: "tasks", values: { id: newId(), title: (title || content.split("\n")[0] || "Tarefa da nota").slice(0, 200), description: content.slice(0, 5000) || null, due_date: today } });
          toast.show("Tarefa criada a partir da nota.", "success");
        }}>Virar tarefa</Button>
        {note && <Button variant="ghost" icon={<Archive className="size-4" />} onClick={async () => { await mutate({ action: "update", table: "notes", id, values: { archived: !note.archived } }); onDone(); }}>{note.archived ? "Desarquivar" : "Arquivar"}</Button>}
        {note && <Button variant="ghost" className="text-error" icon={<Trash2 className="size-4" />} onClick={() => setDel(true)}>Excluir</Button>}
      </div>
      <ConfirmDialog open={del} danger title="Excluir nota?" message="A nota e seus anexos serão apagados." confirmLabel="Excluir" onCancel={() => setDel(false)} onConfirm={async () => {
        if (attachments.length) await getSupabase().storage.from("user-files").remove(attachments.map((a) => a.storage_path));
        await mutate({ action: "delete", table: "notes", id });
        setDel(false);
        onDone();
      }} />
    </div>
  );
}
