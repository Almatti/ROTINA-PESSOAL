"use client";
/**
 * MODO LOCAL — cliente compatível com o subconjunto da API do supabase-js usado
 * pelo app, guardando tudo no próprio aparelho (localStorage).
 * - Mesmo esquema do Supabase (gerado das migrations): colunas, padrões,
 *   restrições únicas e exclusões em cascata.
 * - Isolamento por conta local (equivalente ao RLS).
 * - Usado quando NEXT_PUBLIC_LOCAL_MODE=1. Na versão online, nada disto roda.
 */
import { LOCAL_SCHEMA, LOCAL_SEED } from "./schema.generated";

type Row = Record<string, unknown>;
type Result<T = unknown> = { data: T; error: { message: string; code?: string } | null; count?: number | null; status?: number };
type Pred = (r: Row) => boolean;

const NS = "vilma-local";
const schema = LOCAL_SCHEMA as unknown as Record<string, { columns: Record<string, { type: string; default: { fn?: string; value?: unknown } | null }>; unique: string[][]; cascade: { parent: string; column: string }[]; setNull: { parent: string; column: string }[] }>;

// ---------------------------------------------------------------- armazenamento
const memo = new Map<string, Row[]>();
function load(table: string): Row[] {
  if (!memo.has(table)) {
    let rows: Row[] = [];
    try {
      rows = JSON.parse(localStorage.getItem(`${NS}:db:${table}`) || "[]");
    } catch {}
    memo.set(table, rows);
  }
  return memo.get(table)!;
}
function save(table: string, rows: Row[]) {
  memo.set(table, rows);
  try {
    localStorage.setItem(`${NS}:db:${table}`, JSON.stringify(rows));
  } catch {
    throw Object.assign(new Error("Espaço de armazenamento do aparelho esgotado. Exporte seus dados e remova anexos grandes."), { code: "53100" });
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith(`${NS}:db:`)) memo.delete(e.key.slice(`${NS}:db:`.length));
  });
}

// ---------------------------------------------------------------- sessão
interface LocalUser { id: string; email: string; pass: string; user_metadata: Row; created_at: string }
const users = (): LocalUser[] => { try { return JSON.parse(localStorage.getItem(`${NS}:users`) || "[]"); } catch { return []; } };
const setUsers = (u: LocalUser[]) => localStorage.setItem(`${NS}:users`, JSON.stringify(u));
const sessionUid = (): string | null => { try { return localStorage.getItem(`${NS}:session`); } catch { return null; } };
const publicUser = (u: LocalUser) => ({ id: u.id, email: u.email, user_metadata: u.user_metadata, app_metadata: { provider: "email", providers: ["email"] }, aud: "authenticated", created_at: u.created_at });
async function hash(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`vilma-local:${s}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
type AuthCb = (event: string, session: unknown) => void;
const authListeners = new Set<AuthCb>();
const emit = (event: string) => {
  const uid = sessionUid();
  const u = users().find((x) => x.id === uid);
  authListeners.forEach((cb) => cb(event, u ? { user: publicUser(u) } : null));
};

// ---------------------------------------------------------------- utilidades
const nowIso = () => new Date().toISOString();
const todayLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const err = (message: string, code?: string) => ({ message, code });

function defaults(table: string, values: Row, uid: string | null): Row {
  const cols = schema[table]?.columns ?? {};
  const row: Row = {};
  for (const [c, def] of Object.entries(cols)) {
    if (c in values && values[c] !== undefined) continue;
    const d = def.default;
    if (!d) { row[c] = null; continue; }
    if (d.fn === "uuid") row[c] = crypto.randomUUID();
    else if (d.fn === "uid") row[c] = uid;
    else if (d.fn === "now") row[c] = nowIso();
    else if (d.fn === "now+30m") row[c] = new Date(Date.now() + 30 * 60000).toISOString();
    else if (d.fn === "today") row[c] = todayLocal();
    else row[c] = structuredClone(d.value);
  }
  const out = { ...row, ...Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) };
  // normaliza tipos numéricos (como o PostgREST, numeric/int voltam como número)
  for (const [c, def] of Object.entries(cols)) {
    if (out[c] !== null && out[c] !== undefined && /^(numeric|integer|smallint|bigint)/.test(def.type) && typeof out[c] === "string" && out[c] !== "") out[c] = Number(out[c]);
  }
  return out;
}

function ownerFilter(table: string, uid: string | null): Pred {
  if (table === "achievements") return () => true;
  if (table === "profiles") return (r) => r.id === uid;
  if (schema[table]?.columns.user_id) return (r) => r.user_id === uid;
  return () => true;
}

function cmp(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "number" || typeof b === "number") return Number(a) - Number(b);
  const sa = String(a), sb = String(b);
  if (/^\d{4}-\d{2}-\d{2}T/.test(sa) && /^\d{4}-\d{2}-\d{2}T/.test(sb)) return new Date(sa).getTime() - new Date(sb).getTime();
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}
const looseEq = (a: unknown, b: unknown) => (a === null || a === undefined ? b === null || b === undefined : typeof a === "boolean" || typeof b === "boolean" ? String(a) === String(b) : cmp(a, b) === 0);

function literal(v: string): unknown {
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return v.replace(/^"(.*)"$/, "$1");
}
function splitTop(s: string) {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function opPred(col: string, op: string, val: unknown, negate = false): Pred {
  let p: Pred;
  switch (op) {
    case "eq": p = (r) => looseEq(r[col], val); break;
    case "neq": p = (r) => !looseEq(r[col], val); break;
    case "gt": p = (r) => r[col] !== null && r[col] !== undefined && cmp(r[col], val) > 0; break;
    case "gte": p = (r) => r[col] !== null && r[col] !== undefined && cmp(r[col], val) >= 0; break;
    case "lt": p = (r) => r[col] !== null && r[col] !== undefined && cmp(r[col], val) < 0; break;
    case "lte": p = (r) => r[col] !== null && r[col] !== undefined && cmp(r[col], val) <= 0; break;
    case "is": p = (r) => (val === null ? r[col] === null || r[col] === undefined : r[col] === val); break;
    case "in": { const set = (val as unknown[]).map(String); p = (r) => set.includes(String(r[col])); break; }
    case "ilike":
    case "like": { const rx = new RegExp("^" + String(val).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*") + "$", op === "ilike" ? "i" : ""); p = (r) => rx.test(String(r[col] ?? "")); break; }
    default: throw new Error(`filtro não suportado no modo local: ${op}`);
  }
  return negate ? (r) => !p(r) : p;
}
/** Converte expressões PostgREST de `.or()` em predicados. */
function parseLogic(expr: string, joiner: "or" | "and"): Pred {
  const parts = splitTop(expr).map((part): Pred => {
    const m = part.match(/^(and|or)\((.*)\)$/);
    if (m) return parseLogic(m[2], m[1] as "and" | "or");
    const first = part.indexOf(".");
    const col = part.slice(0, first);
    let rest = part.slice(first + 1);
    let neg = false;
    if (rest.startsWith("not.")) { neg = true; rest = rest.slice(4); }
    const dot = rest.indexOf(".");
    const op = rest.slice(0, dot);
    const raw = rest.slice(dot + 1);
    const val = op === "in" ? splitTop(raw.replace(/^\(|\)$/g, "")).map(literal) : literal(raw);
    return opPred(col, op, val, neg);
  });
  return joiner === "or" ? (r) => parts.some((p) => p(r)) : (r) => parts.every((p) => p(r));
}

function checkUnique(table: string, rows: Row[], candidate: Row, ignoreId?: unknown) {
  for (const cols of schema[table]?.unique ?? []) {
    if (cols.some((c) => candidate[c] === null || candidate[c] === undefined)) continue;
    if (rows.some((r) => r.id !== ignoreId && cols.every((c) => looseEq(r[c], candidate[c])))) return cols;
  }
  return null;
}

function cascadeDelete(table: string, ids: unknown[]) {
  if (!ids.length) return;
  for (const [child, meta] of Object.entries(schema)) {
    for (const fk of meta.cascade) {
      if (fk.parent !== table) continue;
      const rows = load(child);
      const removed = rows.filter((r) => ids.includes(r[fk.column]));
      if (removed.length) {
        save(child, rows.filter((r) => !ids.includes(r[fk.column])));
        cascadeDelete(child, removed.map((r) => r.id));
      }
    }
    for (const fk of meta.setNull) {
      if (fk.parent !== table) continue;
      const rows = load(child);
      if (rows.some((r) => ids.includes(r[fk.column]))) save(child, rows.map((r) => (ids.includes(r[fk.column]) ? { ...r, [fk.column]: null } : r)));
    }
  }
}

// ---------------------------------------------------------------- query builder
class Query implements PromiseLike<Result> {
  private filters: Pred[] = [];
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private columns = "*";
  private wantReturn = false;
  private orders: { col: string; asc: boolean; nullsFirst?: boolean }[] = [];
  private lim: number | null = null;
  private from_: number | null = null;
  private to_: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private countMode = false;
  private head = false;
  private conflict: string | null = null;
  private ignoreDup = false;

  constructor(private table: string) {
    if (!schema[table]) throw new Error(`tabela desconhecida: ${table}`);
  }

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    this.columns = cols;
    if (this.op !== "select") this.wantReturn = true;
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(v: Row | Row[]) { this.op = "insert"; this.payload = v; return this; }
  upsert(v: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) { this.op = "upsert"; this.payload = v; this.conflict = opts?.onConflict ?? null; this.ignoreDup = !!opts?.ignoreDuplicates; return this; }
  update(v: Row, opts?: { count?: string }) { this.op = "update"; this.payload = v; if (opts?.count) this.countMode = true; return this; }
  delete(opts?: { count?: string }) { this.op = "delete"; if (opts?.count) this.countMode = true; return this; }
  eq(c: string, v: unknown) { this.filters.push(opPred(c, "eq", v)); return this; }
  neq(c: string, v: unknown) { this.filters.push(opPred(c, "neq", v)); return this; }
  gt(c: string, v: unknown) { this.filters.push(opPred(c, "gt", v)); return this; }
  gte(c: string, v: unknown) { this.filters.push(opPred(c, "gte", v)); return this; }
  lt(c: string, v: unknown) { this.filters.push(opPred(c, "lt", v)); return this; }
  lte(c: string, v: unknown) { this.filters.push(opPred(c, "lte", v)); return this; }
  in(c: string, v: unknown[]) { this.filters.push(opPred(c, "in", v)); return this; }
  is(c: string, v: unknown) { this.filters.push(opPred(c, "is", v)); return this; }
  ilike(c: string, v: string) { this.filters.push(opPred(c, "ilike", v)); return this; }
  like(c: string, v: string) { this.filters.push(opPred(c, "like", v)); return this; }
  not(c: string, op: string, v: unknown) { this.filters.push(opPred(c, op, op === "in" ? splitTop(String(v).replace(/^\(|\)$/g, "")).map(literal) : v === "null" ? null : v, true)); return this; }
  or(expr: string) { this.filters.push(parseLogic(expr, "or")); return this; }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false, nullsFirst: opts?.nullsFirst }); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.from_ = a; this.to_ = b; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, ko?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, ko);
  }

  private project(rows: Row[]): Row[] {
    const parts = splitTop(this.columns.replace(/\s/g, ""));
    const plain = parts.filter((p) => !p.includes("("));
    const embeds = parts.filter((p) => p.includes("(")).map((p) => p.match(/^(\w+)\(/)![1]);
    return rows.map((r) => {
      const out: Row = plain.includes("*") || !plain.length ? { ...r } : Object.fromEntries(plain.map((c) => [c, r[c] ?? null]));
      for (const child of embeds) {
        const fk = schema[child]?.cascade.find((f) => f.parent === this.table) ?? schema[child]?.setNull.find((f) => f.parent === this.table);
        out[child] = fk ? load(child).filter((c) => c[fk.column] === r.id).map((c) => ({ ...c })) : [];
      }
      return out;
    });
  }

  private finish(rows: Row[], total: number): Result {
    if (this.head) return { data: null, error: null, count: total };
    if (this.mode === "single") {
      if (rows.length !== 1) return { data: null, error: err("JSON object requested, multiple (or no) rows returned", "PGRST116"), count: null };
      return { data: rows[0], error: null };
    }
    if (this.mode === "maybe") {
      if (rows.length > 1) return { data: null, error: err("multiple rows returned", "PGRST116") };
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null, count: this.countMode ? total : null };
  }

  private run(): Result {
    const uid = sessionUid();
    const own = ownerFilter(this.table, uid);
    const all = load(this.table);
    const match = (r: Row) => own(r) && this.filters.every((f) => f(r));
    try {
      if (this.op === "select") {
        let rows = all.filter(match);
        for (const o of [...this.orders].reverse()) {
          rows = [...rows].sort((a, b) => {
            const an = a[o.col] === null || a[o.col] === undefined, bn = b[o.col] === null || b[o.col] === undefined;
            if (an !== bn) return (an ? -1 : 1) * (o.nullsFirst ?? !o.asc ? 1 : -1);
            const c = cmp(a[o.col], b[o.col]);
            return o.asc ? c : -c;
          });
        }
        const total = rows.length;
        if (this.from_ !== null) rows = rows.slice(this.from_, (this.to_ ?? this.from_) + 1);
        if (this.lim !== null) rows = rows.slice(0, this.lim);
        return this.finish(this.project(rows), total);
      }
      if (this.op === "insert" || this.op === "upsert") {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
        const rows = [...all];
        const changed: Row[] = [];
        for (const v of list) {
          if ("user_id" in v && schema[this.table].columns.user_id && v.user_id !== uid) return { data: null, error: err("new row violates row-level security policy", "42501") };
          if (this.op === "upsert") {
            const keys = (this.conflict ?? "id").split(",").map((s) => s.trim());
            const idx = rows.findIndex((r) => own(r) && keys.every((k) => looseEq(r[k], v[k] ?? (k === "user_id" ? uid : undefined))));
            if (idx >= 0) {
              if (this.ignoreDup) continue;
              const merged = { ...rows[idx], ...Object.fromEntries(Object.entries(v).filter(([k, val]) => val !== undefined && k !== "id")) };
              if ("updated_at" in merged) merged.updated_at = nowIso();
              rows[idx] = defaults(this.table, merged, uid);
              changed.push(rows[idx]);
              continue;
            }
          }
          const row = defaults(this.table, v, uid);
          const dup = checkUnique(this.table, rows, row);
          if (dup) return { data: null, error: err(`duplicate key value violates unique constraint (${dup.join(", ")})`, "23505") };
          rows.push(row);
          changed.push(row);
        }
        save(this.table, rows);
        return this.finish(this.wantReturn ? this.project(changed) : [], changed.length);
      }
      if (this.op === "update") {
        const patch = this.payload as Row;
        const changed: Row[] = [];
        const rows = all.map((r) => {
          if (!match(r)) return r;
          const next = defaults(this.table, { ...r, ...patch, ...("updated_at" in r ? { updated_at: nowIso() } : {}) }, uid);
          changed.push(next);
          return next;
        });
        save(this.table, rows);
        return this.finish(this.wantReturn ? this.project(changed) : [], changed.length);
      }
      // delete
      const removed = all.filter(match);
      save(this.table, all.filter((r) => !match(r)));
      cascadeDelete(this.table, removed.map((r) => r.id));
      return { data: null, error: null, count: removed.length };
    } catch (e) {
      return { data: null, error: err((e as Error).message, (e as { code?: string }).code) };
    }
  }
}

// ---------------------------------------------------------------- nova conta (equivale ao gatilho do banco)
function seedNewUser(u: LocalUser) {
  const ins = (table: string, rows: Row[]) => save(table, [...load(table), ...rows.map((r) => defaults(table, r, u.id))]);
  ins("profiles", [{ id: u.id, full_name: (u.user_metadata.full_name as string) ?? null }]);
  ins("automations", LOCAL_SEED.automations.map((key) => ({ user_id: u.id, key, enabled: true })));
  ins("categories", LOCAL_SEED.categories.map((c) => ({ user_id: u.id, ...c })));
  if (!load("achievements").length) save("achievements", LOCAL_SEED.achievements.map((a) => ({ ...a })));
}

// ---------------------------------------------------------------- arquivos (fotos, anexos)
const fileKey = (path: string) => `${NS}:file:${path}`;
const storage = {
  from: () => ({
    async upload(path: string, file: File) {
      if (!path.startsWith(`${sessionUid()}/`)) return { data: null, error: err("sem permissão") };
      const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file); });
      try {
        localStorage.setItem(fileKey(path), dataUrl);
      } catch {
        return { data: null, error: err("Sem espaço no aparelho para este arquivo.") };
      }
      return { data: { path }, error: null };
    },
    async createSignedUrl(path: string) {
      const v = localStorage.getItem(fileKey(path));
      return v ? { data: { signedUrl: v }, error: null } : { data: null, error: err("arquivo não encontrado") };
    },
    async remove(paths: string[]) {
      paths.forEach((p) => localStorage.removeItem(fileKey(p)));
      return { data: paths, error: null };
    },
    async list() {
      return { data: [], error: null };
    },
  }),
};

// ---------------------------------------------------------------- cliente
export function createLocalClient() {
  const channel = { on() { return channel; }, subscribe() { return channel; }, unsubscribe() {} };
  return {
    from: (table: string) => new Query(table),
    async rpc(fn: string, args: Row) {
      const uid = sessionUid();
      if (!uid) return { data: null, error: err("não autenticada") };
      if (fn === "consume_rate_limit") return { data: true, error: null };
      if (fn === "award_points") {
        const rows = load("point_events");
        if (!rows.some((r) => r.user_id === uid && r.dedupe_key === args.p_dedupe)) save("point_events", [...rows, defaults("point_events", { user_id: uid, source: args.p_source, points: args.p_points, dedupe_key: args.p_dedupe }, uid)]);
        return { data: load("point_events").filter((r) => r.user_id === uid).reduce((s, r) => s + Number(r.points), 0), error: null };
      }
      return { data: null, error: err(`função indisponível no modo local: ${fn}`) };
    },
    channel: () => channel,
    removeChannel: async () => "ok",
    storage,
    auth: {
      async getUser() {
        const u = users().find((x) => x.id === sessionUid());
        return { data: { user: u ? publicUser(u) : null }, error: null };
      },
      async getSession() {
        const u = users().find((x) => x.id === sessionUid());
        return { data: { session: u ? { user: publicUser(u), access_token: "local" } : null }, error: null };
      },
      onAuthStateChange(cb: AuthCb) {
        authListeners.add(cb);
        return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
      },
      async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Row } }) {
        const list = users();
        if (list.some((u) => u.email.toLowerCase() === email.toLowerCase())) return { data: { user: null, session: null }, error: err("User already registered") };
        const u: LocalUser = { id: crypto.randomUUID(), email, pass: await hash(password), user_metadata: options?.data ?? {}, created_at: nowIso() };
        setUsers([...list, u]);
        seedNewUser(u);
        localStorage.setItem(`${NS}:session`, u.id);
        emit("SIGNED_IN");
        return { data: { user: publicUser(u), session: { user: publicUser(u), access_token: "local" } }, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const u = users().find((x) => x.email.toLowerCase() === email.toLowerCase());
        if (!u || u.pass !== (await hash(password))) return { data: { user: null, session: null }, error: err("Invalid login credentials") };
        localStorage.setItem(`${NS}:session`, u.id);
        emit("SIGNED_IN");
        return { data: { user: publicUser(u), session: { user: publicUser(u) } }, error: null };
      },
      async signOut() {
        localStorage.removeItem(`${NS}:session`);
        emit("SIGNED_OUT");
        return { error: null };
      },
      async updateUser({ password }: { password?: string }) {
        const uid = sessionUid();
        const list = users();
        const u = list.find((x) => x.id === uid);
        if (!u) return { data: { user: null }, error: err("session missing") };
        if (password) u.pass = await hash(password);
        setUsers(list);
        return { data: { user: publicUser(u) }, error: null };
      },
      async resetPasswordForEmail() {
        return { data: null, error: err("local-mode") };
      },
      async signInWithOAuth() {
        return { data: null, error: err("Login com Google disponível na versão online.") };
      },
    },
  };
}

// ---------------------------------------------------------------- ferramentas de dados (exportar/excluir)
export function exportLocalData() {
  const uid = sessionUid();
  const u = users().find((x) => x.id === uid);
  const out: Row = { exportado_em: nowIso(), modo: "local", conta: u ? { id: u.id, email: u.email, criada_em: u.created_at } : null };
  for (const table of Object.keys(schema)) {
    const own = ownerFilter(table, uid);
    out[table === "profiles" ? "perfil" : table] = load(table).filter(own);
  }
  return out;
}

export function deleteLocalAccount() {
  const uid = sessionUid();
  if (!uid) return;
  for (const table of Object.keys(schema)) {
    if (table === "achievements") continue;
    const own = ownerFilter(table, uid);
    save(table, load(table).filter((r) => !own(r)));
  }
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith(`${NS}:file:${uid}/`)) localStorage.removeItem(k);
  }
  setUsers(users().filter((u) => u.id !== uid));
  localStorage.removeItem(`${NS}:session`);
  emit("SIGNED_OUT");
}
