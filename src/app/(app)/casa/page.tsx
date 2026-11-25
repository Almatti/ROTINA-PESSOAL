"use client";
import { useState } from "react";
import { House, Plus, Trash2, Check, ShoppingCart, Wrench, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, Field, Input, Select, Textarea, Segmented, EmptyState, Badge, SectionTitle, cn } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { useSession } from "@/lib/session";
import { useTable } from "@/lib/data/hooks";
import { mutate, newId } from "@/lib/data/store";
import { addDays, formatDateBR, diffDays, startOfWeek, WEEKDAY_SHORT, formatDayMonth, weekdayOf } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { useToast } from "@/components/ui/toast";

interface Room { id: string; name: string; icon: string; color: string }
interface Chore { id: string; room_id: string | null; title: string; frequency: string; last_done_on: string | null; next_due_on: string | null; notes: string | null }
interface List { id: string; name: string }
interface Item { id: string; list_id: string; name: string; quantity: string; unit: string | null; section: string | null; price_estimate: string | null; checked: boolean }
interface Product { id: string; room_id: string | null; name: string; quantity: string; min_quantity: string; unit: string | null; expires_on: string | null }
interface Meal { id: string; meal_date: string; meal_type: string; description: string }
interface Maintenance { id: string; title: string; room_id: string | null; last_done_on: string | null; next_due_on: string | null; cost: string | null; provider: string | null; notes: string | null }

const FREQ_DAYS: Record<string, number> = { diaria: 1, semanal: 7, quinzenal: 15, mensal: 30, unica: 0 };
const FREQ_LABEL: Record<string, string> = { diaria: "Diária", semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal", unica: "Única" };
const MEALS = [{ v: "cafe", l: "Café" }, { v: "almoco", l: "Almoço" }, { v: "lanche", l: "Lanche" }, { v: "jantar", l: "Jantar" }];
const ROOM_PRESETS = [{ name: "Cozinha", icon: "🍳", color: "#F6E3CF" }, { name: "Banheiro", icon: "🛁", color: "#E5DCF3" }, { name: "Quarto", icon: "🛏️", color: "#DCE7F7" }, { name: "Sala", icon: "🛋️", color: "#DDF0E5" }, { name: "Lavanderia", icon: "🧺", color: "#F3E0EA" }, { name: "Escritório", icon: "💻", color: "#EAE4D3" }];

export default function HomePage() {
  const { today } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<"casa" | "compras" | "despensa" | "refeicoes" | "manutencao">("casa");
  const { data: rooms = [] } = useTable<Room>("rooms", { order: "created_at" });
  const { data: chores = [] } = useTable<Chore>("chores", { order: "next_due_on" });
  const { data: lists = [] } = useTable<List>("shopping_lists", { order: "created_at" });
  const { data: items = [] } = useTable<Item>("shopping_items", { order: "created_at" });
  const { data: products = [] } = useTable<Product>("household_products", { order: "name" });
  const { data: meals = [] } = useTable<Meal>("meals", { order: "meal_date" });
  const { data: maint = [] } = useTable<Maintenance>("maintenance_items", { order: "next_due_on" });
  const [room, setRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState<Room | null | "new">(null);
  const [choreForm, setChoreForm] = useState<Partial<Chore> | null>(null);
  const [del, setDel] = useState<{ table: string; id: string; label: string } | null>(null);
  const [listId, setListId] = useState<string>("");
  const [newItem, setNewItem] = useState("");
  const [productForm, setProductForm] = useState<Partial<Product> | null>(null);
  const [mealWeek, setMealWeek] = useState(startOfWeek(today));
  const [mealForm, setMealForm] = useState<{ date: string; type: string; existing?: Meal } | null>(null);
  const [maintForm, setMaintForm] = useState<Partial<Maintenance> | null>(null);

  const dueToday = chores.filter((c) => !c.next_due_on || c.next_due_on <= today);
  const activeList = lists.find((l) => l.id === listId) ?? lists[0];
  const listItems = items.filter((i) => i.list_id === activeList?.id);

  async function doneChore(c: Chore) {
    const days = FREQ_DAYS[c.frequency];
    if (!days) await mutate({ action: "delete", table: "chores", id: c.id });
    else await mutate({ action: "update", table: "chores", id: c.id, values: { last_done_on: today, next_due_on: addDays(today, days) } });
    toast.show("Feito! Casa mais leve ✨", "success");
  }

  async function ensureList(): Promise<string> {
    if (activeList) return activeList.id;
    const id = newId();
    await mutate({ action: "insert", table: "shopping_lists", values: { id, name: "Mercado" } });
    setListId(id);
    return id;
  }

  return (
    <>
      <PageHeader title="Casa & Compras" icon={<House className="size-5" />} />
      <div className="scroll-x -mx-4 px-4"><div className="min-w-[520px]"><Segmented label="Seções" value={tab} onChange={setTab} options={[{ value: "casa", label: "Minha casa" }, { value: "compras", label: "Compras" }, { value: "despensa", label: "Produtos" }, { value: "refeicoes", label: "Refeições" }, { value: "manutencao", label: "Manutenção" }]} /></div></div>

      {tab === "casa" && (
        <div className="mt-4 space-y-3">
          <Card>
            <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Hoje em casa</h2><span className="text-xs text-muted">{dueToday.length} tarefa(s)</span></div>
            {dueToday.length === 0 ? <p className="text-sm text-muted">Nada pendente hoje. Aproveite! 🌿</p> : (
              <ul className="space-y-1.5">
                {dueToday.map((c) => (
                  <li key={c.id} className="flex items-center gap-3">
                    <button onClick={() => doneChore(c)} aria-label={`Concluir ${c.title}`} className="grid size-6 place-items-center rounded-full border-2 border-iris hover:border-success"><Check className="size-3.5 opacity-0 hover:opacity-100" /></button>
                    <span className="flex-1 text-sm">{c.title} <span className="text-xs text-muted">· {rooms.find((r) => r.id === c.room_id)?.name ?? "Geral"}{c.next_due_on && c.next_due_on < today ? ` · atrasada ${diffDays(today, c.next_due_on)}d` : ""}</span></span>
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" className="mt-3 w-full" icon={<Plus className="size-4" />} onClick={() => setChoreForm({ frequency: "semanal" })}>Adicionar tarefa doméstica</Button>
          </Card>
          <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setRoomForm("new")}>+ Cômodo</Button>}>Seus cômodos</SectionTitle>
          {rooms.length === 0 ? (
            <Card><p className="mb-2 text-sm text-muted">Comece adicionando seus cômodos:</p><div className="flex flex-wrap gap-2">{ROOM_PRESETS.map((r) => <Button key={r.name} size="sm" variant="outline" onClick={() => mutate({ action: "insert", table: "rooms", values: r })}>{r.icon} {r.name}</Button>)}</div></Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {rooms.map((r) => {
                const n = chores.filter((c) => c.room_id === r.id).length;
                const late = chores.filter((c) => c.room_id === r.id && c.next_due_on && c.next_due_on <= today).length;
                return (
                  <button key={r.id} onClick={() => setRoom(r)} className="rounded-card p-4 text-left text-orchid transition hover:-translate-y-0.5 hover:shadow-soft" style={{ background: r.color }}>
                    <span className="text-2xl" aria-hidden>{r.icon}</span>
                    <p className="mt-6 font-bold">{r.name}</p>
                    <p className="text-xs opacity-75">{n} cuidado(s){late ? ` · ${late} para hoje` : ""}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "compras" && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Select value={activeList?.id ?? ""} onChange={(e) => setListId(e.target.value)} aria-label="Lista de compras">{lists.length === 0 && <option value="">Nenhuma lista</option>}{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
            <Button variant="soft" onClick={async () => { const name = prompt("Nome da nova lista:")?.trim(); if (name) { const id = newId(); await mutate({ action: "insert", table: "shopping_lists", values: { id, name: name.slice(0, 80) } }); setListId(id); } }}>Nova lista</Button>
          </div>
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!newItem.trim()) return; const id = await ensureList(); const m = newItem.trim().match(/^(\d+(?:[.,]\d+)?)\s*(\w+)?\s+(.+)$/); await mutate({ action: "insert", table: "shopping_items", values: m ? { list_id: id, name: m[3], quantity: Number(m[1].replace(",", ".")), unit: m[2] ?? null } : { list_id: id, name: newItem.trim() } }); setNewItem(""); }}>
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Ex.: 2 kg arroz, leite, café" aria-label="Novo item" />
            <Button type="submit" size="icon" aria-label="Adicionar item"><Plus className="size-5" /></Button>
          </form>
          {listItems.length === 0 ? <EmptyState icon="🛒" title="Lista vazia" description="Adicione itens ou peça para a Vilma montar uma lista." /> : (
            <Card className="divide-y divide-line py-1">
              {[...listItems].sort((a, b) => Number(a.checked) - Number(b.checked)).map((i) => (
                <div key={i.id} className="flex items-center gap-3 py-2.5">
                  <input type="checkbox" checked={i.checked} onChange={() => mutate({ action: "update", table: "shopping_items", id: i.id, values: { checked: !i.checked } })} className="size-5 accent-[var(--primary)]" aria-label={`Marcar ${i.name}`} />
                  <span className={cn("flex-1", i.checked && "text-muted line-through")}>{Number(i.quantity) !== 1 || i.unit ? `${Number(i.quantity)}${i.unit ? ` ${i.unit}` : ""} · ` : ""}{i.name}</span>
                  <Button size="icon" variant="ghost" aria-label={`Remover ${i.name}`} onClick={() => mutate({ action: "delete", table: "shopping_items", id: i.id })}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </Card>
          )}
          {listItems.some((i) => i.checked) && <Button variant="ghost" className="w-full" onClick={async () => { for (const i of listItems.filter((x) => x.checked)) await mutate({ action: "delete", table: "shopping_items", id: i.id }); }}>Limpar itens comprados</Button>}
          {activeList && <Button variant="ghost" className="w-full text-error" onClick={() => setDel({ table: "shopping_lists", id: activeList.id, label: `a lista “${activeList.name}”` })}>Excluir lista</Button>}
        </div>
      )}

      {tab === "despensa" && (
        <div className="mt-4 space-y-3">
          <Button variant="soft" className="w-full" icon={<Plus className="size-4" />} onClick={() => setProductForm({})}>Adicionar produto</Button>
          {products.length === 0 ? <EmptyState icon="🧴" title="Controle seus produtos" description="Limpeza, higiene, despensa: acompanhe quantidades e validade." /> : (
            <Card className="divide-y divide-line py-1">
              {products.map((p) => {
                const low = Number(p.quantity) <= Number(p.min_quantity);
                const exp = p.expires_on ? diffDays(p.expires_on, today) : null;
                return (
                  <div key={p.id} className="flex items-center gap-2 py-2.5">
                    <button onClick={() => setProductForm(p)} className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-xs text-muted">{Number(p.quantity)} {p.unit ?? "un"}{exp !== null ? ` · validade ${formatDateBR(p.expires_on)}` : ""}</p>
                    </button>
                    {low && <Badge tone="warning">Acabando</Badge>}
                    {exp !== null && exp <= 7 && <Badge tone="error">{exp < 0 ? "Vencido" : "Vence logo"}</Badge>}
                    <Button size="icon" variant="ghost" aria-label="Diminuir" onClick={() => mutate({ action: "update", table: "household_products", id: p.id, values: { quantity: Math.max(0, Number(p.quantity) - 1) } })}>−</Button>
                    <Button size="icon" variant="ghost" aria-label="Aumentar" onClick={() => mutate({ action: "update", table: "household_products", id: p.id, values: { quantity: Number(p.quantity) + 1 } })}>+</Button>
                    {low && <Button size="icon" variant="soft" aria-label={`Adicionar ${p.name} à lista`} onClick={async () => { const id = await ensureList(); await mutate({ action: "insert", table: "shopping_items", values: { list_id: id, name: p.name } }); toast.show("Adicionado à lista de compras.", "success"); }}><ShoppingCart className="size-4" /></Button>}
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {tab === "refeicoes" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setMealWeek(addDays(mealWeek, -7))} className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary" aria-label="Semana anterior"><ChevronLeft className="size-5" /></button>
            <p className="font-bold">Semana de {formatDayMonth(mealWeek)}</p>
            <button onClick={() => setMealWeek(addDays(mealWeek, 7))} className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary" aria-label="Próxima semana"><ChevronRight className="size-5" /></button>
          </div>
          {Array.from({ length: 7 }, (_, i) => addDays(mealWeek, i)).map((d) => (
            <Card key={d} className={cn(d === today && "ring-2 ring-primary/40")}>
              <p className="mb-2 text-sm font-bold capitalize">{WEEKDAY_SHORT[weekdayOf(d)]} · {formatDayMonth(d)}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEALS.map((m) => {
                  const meal = meals.find((x) => x.meal_date === d && x.meal_type === m.v);
                  return <button key={m.v} onClick={() => setMealForm({ date: d, type: m.v, existing: meal })} className="rounded-xl bg-surface-2 p-2 text-left text-xs"><span className="font-semibold text-muted">{m.l}</span><span className="mt-0.5 line-clamp-2 block text-ink">{meal?.description ?? "+ planejar"}</span></button>;
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "manutencao" && (
        <div className="mt-4 space-y-3">
          <Button variant="soft" className="w-full" icon={<Wrench className="size-4" />} onClick={() => setMaintForm({})}>Nova manutenção</Button>
          {maint.length === 0 ? <EmptyState icon="🔧" title="Nada cadastrado" description="Ar-condicionado, filtro de água, dedetização, revisão elétrica…" /> : maint.map((m) => {
            const d = m.next_due_on ? diffDays(m.next_due_on, today) : null;
            return (
              <button key={m.id} onClick={() => setMaintForm(m)} className="card flex w-full items-center gap-3 p-4 text-left">
                <Wrench className="size-5 text-primary" aria-hidden />
                <div className="flex-1"><p className="font-semibold">{m.title}</p><p className="text-xs text-muted">{m.next_due_on ? `Próxima: ${formatDateBR(m.next_due_on)}` : "Sem data"}{m.provider ? ` · ${m.provider}` : ""}{m.cost ? ` · ${formatBRL(m.cost)}` : ""}</p></div>
                {d !== null && d <= 15 && <Badge tone={d < 0 ? "error" : "warning"}>{d < 0 ? "Atrasada" : `${d} dias`}</Badge>}
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={!!room} onClose={() => setRoom(null)} title={room ? `${room.icon} ${room.name}` : ""} footer={room && <div className="flex gap-2"><Button variant="ghost" className="flex-1 text-error" onClick={() => { setDel({ table: "rooms", id: room.id, label: room.name }); setRoom(null); }}>Excluir cômodo</Button><Button variant="outline" className="flex-1" onClick={() => { setRoomForm(room); setRoom(null); }}>Editar</Button></div>}>
        {room && (
          <div className="space-y-3">
            {chores.filter((c) => c.room_id === room.id).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <button onClick={() => doneChore(c)} aria-label={`Concluir ${c.title}`} className="grid size-7 place-items-center rounded-full border-2 border-iris"><Check className="size-4 text-success" /></button>
                <button className="flex-1 text-left" onClick={() => setChoreForm(c)}><p className="font-semibold">{c.title}</p><p className="text-xs text-muted">{FREQ_LABEL[c.frequency]}{c.next_due_on ? ` · próxima ${formatDateBR(c.next_due_on)}` : ""}</p></button>
                <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => setDel({ table: "chores", id: c.id, label: c.title })}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button className="w-full" icon={<Plus className="size-4" />} onClick={() => setChoreForm({ room_id: room.id, frequency: "semanal" })}>Adicionar cuidado</Button>
          </div>
        )}
      </Sheet>
      <Sheet open={!!roomForm} onClose={() => setRoomForm(null)} title={roomForm === "new" ? "Novo cômodo" : "Editar cômodo"}>{roomForm && <RoomForm room={roomForm === "new" ? null : roomForm} onDone={() => setRoomForm(null)} />}</Sheet>
      <Sheet open={!!choreForm} onClose={() => setChoreForm(null)} title={choreForm?.id ? "Editar tarefa doméstica" : "Nova tarefa doméstica"}>{choreForm && <ChoreForm chore={choreForm} rooms={rooms} onDone={() => setChoreForm(null)} />}</Sheet>
      <Sheet open={!!productForm} onClose={() => setProductForm(null)} title={productForm?.id ? "Editar produto" : "Novo produto"} footer={productForm?.id && <Button variant="ghost" className="w-full text-error" onClick={() => { setDel({ table: "household_products", id: productForm.id!, label: productForm.name ?? "produto" }); setProductForm(null); }}>Excluir</Button>}>{productForm && <ProductForm product={productForm} rooms={rooms} onDone={() => setProductForm(null)} />}</Sheet>
      <Sheet open={!!mealForm} onClose={() => setMealForm(null)} title="Planejar refeição">{mealForm && <MealForm {...mealForm} onDone={() => setMealForm(null)} />}</Sheet>
      <Sheet open={!!maintForm} onClose={() => setMaintForm(null)} title={maintForm?.id ? "Editar manutenção" : "Nova manutenção"} footer={maintForm?.id && <Button variant="ghost" className="w-full text-error" onClick={() => { setDel({ table: "maintenance_items", id: maintForm.id!, label: maintForm.title ?? "" }); setMaintForm(null); }}>Excluir</Button>}>{maintForm && <MaintForm item={maintForm} rooms={rooms} onDone={() => setMaintForm(null)} />}</Sheet>
      <ConfirmDialog open={!!del} danger title="Confirmar exclusão" message={`Excluir ${del?.label}?`} confirmLabel="Excluir" onCancel={() => setDel(null)} onConfirm={async () => { await mutate({ action: "delete", table: del!.table, id: del!.id }); setDel(null); }} />
    </>
  );
}

function RoomForm({ room, onDone }: { room: Room | null; onDone: () => void }) {
  const [name, setName] = useState(room?.name ?? "");
  const [icon, setIcon] = useState(room?.icon ?? "🏠");
  const [color, setColor] = useState(room?.color ?? "#DAD0E5");
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; const values = { name: name.trim(), icon, color }; if (room) await mutate({ action: "update", table: "rooms", id: room.id, values }); else await mutate({ action: "insert", table: "rooms", values }); onDone(); }}>
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <Field label="Ícone">{(id) => <Input id={id} value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} className="text-center text-xl" />}</Field>
        <Field label="Nome">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />}</Field>
      </div>
      <Field label="Cor">{(id) => <Input id={id} type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 p-1" />}</Field>
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );
}

function ChoreForm({ chore, rooms, onDone }: { chore: Partial<Chore>; rooms: Room[]; onDone: () => void }) {
  const { today } = useSession();
  const [title, setTitle] = useState(chore.title ?? "");
  const [room, setRoom] = useState(chore.room_id ?? "");
  const [freq, setFreq] = useState(chore.frequency ?? "semanal");
  const [next, setNext] = useState(chore.next_due_on ?? today);
  const [notes, setNotes] = useState(chore.notes ?? "");
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (!title.trim()) return; const values = { title: title.trim(), room_id: room || null, frequency: freq, next_due_on: next || null, notes: notes || null }; if (chore.id) await mutate({ action: "update", table: "chores", id: chore.id, values }); else await mutate({ action: "insert", table: "chores", values }); onDone(); }}>
      <Field label="Tarefa">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Limpar a mesa" />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cômodo">{(id) => <Select id={id} value={room} onChange={(e) => setRoom(e.target.value)}><option value="">Geral</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}</Select>}</Field>
        <Field label="Frequência">{(id) => <Select id={id} value={freq} onChange={(e) => setFreq(e.target.value)}>{Object.entries(FREQ_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
      </div>
      <Field label="Próxima vez">{(id) => <Input id={id} type="date" value={next} onChange={(e) => setNext(e.target.value)} />}</Field>
      <Field label="Observações">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}</Field>
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );
}

function ProductForm({ product, rooms, onDone }: { product: Partial<Product>; rooms: Room[]; onDone: () => void }) {
  const [v, setV] = useState({ name: product.name ?? "", quantity: product.quantity ?? "1", min_quantity: product.min_quantity ?? "1", unit: product.unit ?? "", expires_on: product.expires_on ?? "", room_id: product.room_id ?? "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (!v.name.trim()) return; const values = { name: v.name.trim(), quantity: Math.max(0, Number(String(v.quantity).replace(",", ".")) || 0), min_quantity: Math.max(0, Number(String(v.min_quantity).replace(",", ".")) || 0), unit: v.unit || null, expires_on: v.expires_on || null, room_id: v.room_id || null }; if (product.id) await mutate({ action: "update", table: "household_products", id: product.id, values }); else await mutate({ action: "insert", table: "household_products", values }); onDone(); }}>
      <Field label="Produto">{(id) => <Input id={id} value={v.name} onChange={set("name")} />}</Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Quantidade">{(id) => <Input id={id} inputMode="decimal" value={v.quantity} onChange={set("quantity")} />}</Field>
        <Field label="Mínimo">{(id) => <Input id={id} inputMode="decimal" value={v.min_quantity} onChange={set("min_quantity")} />}</Field>
        <Field label="Unidade">{(id) => <Input id={id} value={v.unit} onChange={set("unit")} placeholder="un, kg" />}</Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Validade">{(id) => <Input id={id} type="date" value={v.expires_on} onChange={set("expires_on")} />}</Field>
        <Field label="Cômodo">{(id) => <Select id={id} value={v.room_id} onChange={set("room_id")}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>}</Field>
      </div>
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );
}

function MealForm({ date, type, existing, onDone }: { date: string; type: string; existing?: Meal; onDone: () => void }) {
  const [desc, setDesc] = useState(existing?.description ?? "");
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!desc.trim()) { if (existing) await mutate({ action: "delete", table: "meals", id: existing.id }); return onDone(); }
      if (existing) await mutate({ action: "update", table: "meals", id: existing.id, values: { description: desc.trim() } });
      else await mutate({ action: "insert", table: "meals", values: { meal_date: date, meal_type: type, description: desc.trim() } });
      onDone();
    }}>
      <p className="text-sm text-muted">{MEALS.find((m) => m.v === type)?.l} · {formatDateBR(date)}</p>
      <Field label="O que vai ter?">{(id) => <Input id={id} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Frango grelhado com legumes" maxLength={200} />}</Field>
      <p className="text-xs text-muted">Deixe em branco e salve para remover.</p>
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );
}

function MaintForm({ item, rooms, onDone }: { item: Partial<Maintenance>; rooms: Room[]; onDone: () => void }) {
  const [v, setV] = useState({ title: item.title ?? "", room_id: item.room_id ?? "", last_done_on: item.last_done_on ?? "", next_due_on: item.next_due_on ?? "", cost: item.cost ?? "", provider: item.provider ?? "", notes: item.notes ?? "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (!v.title.trim()) return; const values = { title: v.title.trim(), room_id: v.room_id || null, last_done_on: v.last_done_on || null, next_due_on: v.next_due_on || null, cost: v.cost ? Number(String(v.cost).replace(/\./g, "").replace(",", ".")) : null, provider: v.provider || null, notes: v.notes || null }; if (item.id) await mutate({ action: "update", table: "maintenance_items", id: item.id, values }); else await mutate({ action: "insert", table: "maintenance_items", values }); onDone(); }}>
      <Field label="Item">{(id) => <Input id={id} value={v.title} onChange={set("title")} placeholder="Ex.: Limpeza do ar-condicionado" />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Última vez">{(id) => <Input id={id} type="date" value={v.last_done_on} onChange={set("last_done_on")} />}</Field>
        <Field label="Próxima">{(id) => <Input id={id} type="date" value={v.next_due_on} onChange={set("next_due_on")} />}</Field>
        <Field label="Custo (R$)">{(id) => <Input id={id} inputMode="decimal" value={v.cost} onChange={set("cost")} />}</Field>
        <Field label="Cômodo">{(id) => <Select id={id} value={v.room_id} onChange={set("room_id")}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>}</Field>
      </div>
      <Field label="Prestador">{(id) => <Input id={id} value={v.provider} onChange={set("provider")} />}</Field>
      <Field label="Observações">{(id) => <Textarea id={id} value={v.notes} onChange={set("notes")} rows={2} />}</Field>
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );
}
