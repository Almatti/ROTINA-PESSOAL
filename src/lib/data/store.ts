"use client";
/**
 * Camada de dados do cliente.
 *  - useQuery: busca com cache em memória + localStorage (leitura offline).
 *  - mutate: grava no Supabase; sem conexão, guarda numa fila (outbox) e
 *    aplica a alteração de forma otimista; sincroniza ao reconectar.
 *  - Realtime: alterações feitas em outro dispositivo invalidam o cache.
 * Toda autorização é garantida pelo RLS do banco.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";

type Row = Record<string, unknown> & { id?: string };
type Listener = () => void;

const memory = new Map<string, unknown>();
const tableListeners = new Map<string, Set<Listener>>();
const outboxListeners = new Set<Listener>();
let currentUser: string | null = null;

export function setDataUser(id: string | null) {
  if (currentUser !== id) memory.clear();
  currentUser = id;
}

const storageKey = (k: string) => `vilma:${currentUser ?? "anon"}:${k}`;

function readStorage<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(storageKey(key));
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}
function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    // cota excedida ou modo privado: segue apenas em memória
  }
}

export function invalidate(...tables: string[]) {
  for (const t of tables) tableListeners.get(t)?.forEach((fn) => fn());
}

function subscribeTables(tables: string[], fn: Listener) {
  for (const t of tables) {
    if (!tableListeners.has(t)) tableListeners.set(t, new Set());
    tableListeners.get(t)!.add(fn);
  }
  return () => tables.forEach((t) => tableListeners.get(t)?.delete(fn));
}

// ---------------------------------------------------------------------
// Outbox (fila offline)
// ---------------------------------------------------------------------
export type MutationOp =
  | { action: "insert"; table: string; values: Row | Row[] }
  | { action: "upsert"; table: string; values: Row | Row[]; onConflict?: string }
  | { action: "update"; table: string; id: string; values: Row }
  | { action: "delete"; table: string; id: string };

interface QueuedOp {
  qid: string;
  op: MutationOp;
  at: number;
}

function getOutbox(): QueuedOp[] {
  return readStorage<QueuedOp[]>("outbox") ?? [];
}
function setOutbox(list: QueuedOp[]) {
  writeStorage("outbox", list);
  outboxListeners.forEach((fn) => fn());
}

export function useOutboxCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const update = () => setN(getOutbox().length);
    update();
    outboxListeners.add(update);
    return () => {
      outboxListeners.delete(update);
    };
  }, []);
  return n;
}

/** Aplica operações pendentes sobre o resultado em cache (visão otimista). */
function overlay<T>(table: string | undefined, data: T): T {
  if (!table || !Array.isArray(data)) return data;
  const ops = getOutbox().filter((q) => q.op.table === table);
  if (!ops.length) return data;
  let rows = [...(data as Row[])];
  for (const { op } of ops) {
    if (op.action === "insert" || op.action === "upsert") {
      const vals = Array.isArray(op.values) ? op.values : [op.values];
      for (const v of vals) {
        const i = rows.findIndex((r) => r.id && r.id === v.id);
        if (i >= 0) rows[i] = { ...rows[i], ...v };
        else rows.push({ ...v, __pending: true });
      }
    } else if (op.action === "update") {
      rows = rows.map((r) => (r.id === op.id ? { ...r, ...op.values, __pending: true } : r));
    } else if (op.action === "delete") {
      rows = rows.filter((r) => r.id !== op.id);
    }
  }
  return rows as T;
}

export class DataError extends Error {
  constructor(message: string, public code?: string, public offline = false) {
    super(message);
  }
}

/** Traduz erros do Postgres/PostgREST para mensagens amigáveis. */
export function friendlyError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return "Algo deu errado. Tente novamente.";
  const code = err.code ?? "";
  if (code === "23505") return "Esse registro já existe.";
  if (code === "23514") return "Algum valor está fora do permitido. Revise os campos.";
  if (code === "23503") return "Este item está ligado a outro registro que não existe mais.";
  if (code === "42501" || /row-level security/i.test(err.message ?? "")) return "Você não tem permissão para esta ação.";
  if (/fetch|network|Failed to fetch/i.test(err.message ?? "")) return "Sem conexão. Vamos sincronizar quando a internet voltar.";
  return err.message ?? "Algo deu errado. Tente novamente.";
}

function isNetworkError(e: unknown) {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return /fetch|network|Failed to fetch|NetworkError|Load failed/i.test(msg);
}

async function execute(sb: SupabaseClient, op: MutationOp) {
  switch (op.action) {
    case "insert":
      return sb.from(op.table).insert(op.values).select();
    case "upsert":
      return sb.from(op.table).upsert(op.values, op.onConflict ? { onConflict: op.onConflict } : undefined).select();
    case "update":
      return sb.from(op.table).update(op.values).eq("id", op.id).select();
    case "delete":
      return sb.from(op.table).delete().eq("id", op.id);
  }
}

/** Gera ids no cliente para que inserções offline possam ser referenciadas. */
export function newId() {
  return crypto.randomUUID();
}

function withIds(values: Row | Row[]) {
  const add = (v: Row) => (v.id ? v : { ...v, id: newId() });
  return Array.isArray(values) ? values.map(add) : add(values);
}

/** Avisa (ex.: sincronização com o Google) que a usuária alterou dados. */
export function notifyMutated(...tables: string[]) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("vilma:mutated", { detail: { tables } }));
}

/**
 * Executa uma mutação. Sem conexão, enfileira e resolve com { queued: true }.
 * Erros de validação são lançados como DataError com mensagem amigável.
 */
export async function mutate<T = Row>(op: MutationOp): Promise<{ data: T[] | null; queued: boolean }> {
  if (op.action === "insert") op = { ...op, values: withIds(op.values) };
  const sb = getSupabase();
  const enqueue = () => {
    setOutbox([...getOutbox(), { qid: newId(), op, at: Date.now() }]);
    invalidate(op.table);
    return { data: null, queued: true };
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) return enqueue();
  try {
    const res = await execute(sb, op);
    if (res.error) {
      if (isNetworkError(res.error)) return enqueue();
      throw new DataError(friendlyError(res.error), res.error.code);
    }
    invalidate(op.table);
    notifyMutated(op.table);
    return { data: (res.data as T[]) ?? null, queued: false };
  } catch (e) {
    if (e instanceof DataError) throw e;
    if (isNetworkError(e)) return enqueue();
    throw new DataError(friendlyError(e as Error));
  }
}

let flushing = false;
/** Envia a fila offline em ordem. Para ao primeiro erro de rede. */
export async function flushOutbox(): Promise<{ sent: number; failed: string[] }> {
  if (flushing) return { sent: 0, failed: [] };
  flushing = true;
  const failed: string[] = [];
  let sent = 0;
  try {
    const sb = getSupabase();
    for (const item of getOutbox()) {
      try {
        const res = await execute(sb, item.op);
        if (res.error && isNetworkError(res.error)) break;
        if (res.error) failed.push(friendlyError(res.error));
        else sent++;
      } catch (e) {
        if (isNetworkError(e)) break;
        failed.push(friendlyError(e as Error));
      }
      setOutbox(getOutbox().filter((q) => q.qid !== item.qid));
      invalidate(item.op.table);
    }
  } finally {
    flushing = false;
  }
  if (sent) notifyMutated("outbox");
  return { sent, failed };
}

// ---------------------------------------------------------------------
// useQuery
// ---------------------------------------------------------------------
export interface QueryOptions {
  /** Tabelas cujas alterações invalidam esta consulta. */
  tables: string[];
  /** Tabela principal (para sobrepor alterações offline pendentes). */
  table?: string;
  enabled?: boolean;
}

export function useQuery<T>(key: string, fetcher: (sb: SupabaseClient) => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>, opts: QueryOptions) {
  const enabled = opts.enabled !== false;
  const initial = (memory.get(key) as T | undefined) ?? (typeof window !== "undefined" ? readStorage<T>(`q:${key}`) : undefined);
  const [data, setData] = useState<T | undefined>(initial);
  const [loading, setLoading] = useState(initial === undefined && enabled);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const tablesKey = opts.tables.join(",");

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => subscribeTables(tablesKey.split(","), refresh), [tablesKey, refresh]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const cached = (memory.get(key) as T | undefined) ?? readStorage<T>(`q:${key}`);
    if (cached !== undefined) setData(cached);
    else setLoading(true);
    (async () => {
      try {
        const res = await fetcherRef.current(getSupabase());
        if (cancelled) return;
        if (res.error) {
          if (!isNetworkError(res.error)) setError(friendlyError(res.error));
        } else {
          memory.set(key, res.data);
          writeStorage(`q:${key}`, res.data);
          setData(res.data ?? undefined);
          setError(null);
        }
      } catch (e) {
        if (!cancelled && !isNetworkError(e)) setError(friendlyError(e as Error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, version, enabled]);

  return { data: overlay(opts.table, data), loading, error, refresh };
}

// ---------------------------------------------------------------------
// Realtime + reconexão
// ---------------------------------------------------------------------
const REALTIME_TABLES = ["tasks", "subtasks", "events", "habits", "habit_logs", "transactions", "water_logs", "notifications", "notes"];

export function startSync(userId: string, onFlush?: (r: { sent: number; failed: string[] }) => void) {
  const sb = getSupabase();
  // tópico único por montagem: evita reutilizar um canal já inscrito (StrictMode/remontagens)
  const channel = sb.channel(`sync:${userId}:${Math.random().toString(36).slice(2, 10)}`);
  try {
    for (const table of REALTIME_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }, () => invalidate(table));
    }
    channel.subscribe();
  } catch {
    // Realtime indisponível: o app continua funcionando com atualização ao reconectar/navegar.
  }
  const onOnline = async () => {
    const r = await flushOutbox();
    if (r.sent || r.failed.length) onFlush?.(r);
    invalidate(...REALTIME_TABLES);
  };
  window.addEventListener("online", onOnline);
  if (navigator.onLine) void onOnline();
  return () => {
    window.removeEventListener("online", onOnline);
    void sb.removeChannel(channel);
  };
}
