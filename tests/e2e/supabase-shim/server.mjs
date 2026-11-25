// =====================================================================
// SHIM DE TESTE — emula o subconjunto do Supabase (GoTrue + PostgREST)
// usado pelo app, executando SQL real num PostgreSQL local com RLS.
// Uso exclusivo em testes E2E. NÃO usar em produção.
//   node tests/e2e/supabase-shim/server.mjs   (porta 54321)
// Variáveis: SHIM_DB_URL (padrão: postgres local via socket), SHIM_PORT.
// =====================================================================
import http from "node:http";
import crypto from "node:crypto";
import pg from "pg";

export const JWT_SECRET = "vilma-test-secret-only-for-e2e-0123456789";
const PORT = Number(process.env.SHIM_PORT ?? 54321);

pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric → número (como PostgREST)
pg.types.setTypeParser(1082, (v) => v); // date → string
pg.types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString())); // timestamptz → ISO
pg.types.setTypeParser(20, (v) => Number(v)); // bigint (count)

const pool = new pg.Pool({ connectionString: process.env.SHIM_DB_URL ?? "postgresql:///vilma_e2e?host=/var/run/postgresql&user=postgres", max: 8 });

// ---------------- JWT HS256 ----------------
const b64u = (b) => Buffer.from(b).toString("base64url");
export function sign(payload) {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify(payload));
  const s = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}
function verify(token) {
  try {
    const [h, p, s] = token.split(".");
    const exp = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url");
    if (s !== exp) return null;
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
export const ANON_KEY = sign({ role: "anon", iss: "shim", iat: 1700000000, exp: 4102444800 });
export const SERVICE_KEY = sign({ role: "service_role", iss: "shim", iat: 1700000000, exp: 4102444800 });

// ---------------- metadados de colunas ----------------
let columnTypes = {}; // table -> col -> udt_name
async function loadColumns() {
  const { rows } = await pool.query("select table_name, column_name, udt_name from information_schema.columns where table_schema='public'");
  columnTypes = {};
  for (const r of rows) (columnTypes[r.table_name] ??= {})[r.column_name] = r.udt_name;
}
const EMBEDS = {
  subtasks: "task_id", goal_steps: "goal_id", project_stages: "project_id", workout_exercises: "plan_id", workout_sets: "session_id",
};

// ---------------- utilidades HTTP ----------------
function send(res, status, body, headers = {}) {
  const h = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Expose-Headers": "Content-Range", ...headers };
  res.writeHead(status, h);
  res.end(body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return Object.fromEntries(new URLSearchParams(raw)); }
}
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw Object.assign(new Error(`identificador inválido: ${s}`), { code: "PGRST100" });
  return `"${s}"`;
};
function pgError(res, e) {
  const status = e.code === "23505" ? 409 : e.code === "42501" ? 403 : e.code === "PGRST116" ? 406 : e.code?.startsWith("PGRST") ? 400 : 400;
  send(res, status, { code: e.code ?? "XX000", message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
}

// ---------------- auth ----------------
function sessionFor(user) {
  const now = Math.floor(Date.now() / 1000);
  const access = sign({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 });
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: b64u(crypto.randomBytes(24)) + "." + user.id, user: publicUser(user) };
}
function publicUser(u) {
  return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: u.raw_user_meta_data ?? {}, created_at: u.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString(), identities: [] };
}
const hashPw = (pw) => crypto.scryptSync(pw, "shim-salt", 32).toString("hex");

async function handleAuth(req, res, path, url) {
  const body = await readBody(req);
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (path === "/auth/v1/signup" && req.method === "POST") {
    const { rows: ex } = await pool.query("select id from auth.users where email=$1", [body.email]);
    if (ex.length) return send(res, 422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
    const { rows } = await pool.query("insert into auth.users (email, raw_user_meta_data) values ($1,$2) returning *", [body.email, body.data ?? body.options?.data ?? {}]);
    await pool.query("insert into auth.shim_passwords (user_id, hash) values ($1,$2)", [rows[0].id, hashPw(body.password)]);
    return send(res, 200, sessionFor(rows[0]));
  }
  if (path === "/auth/v1/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const { rows } = await pool.query("select u.*, p.hash from auth.users u join auth.shim_passwords p on p.user_id=u.id where u.email=$1", [body.email]);
      if (!rows.length || rows[0].hash !== hashPw(body.password)) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials", error: "invalid_grant", error_description: "Invalid login credentials" });
      return send(res, 200, sessionFor(rows[0]));
    }
    if (grant === "refresh_token") {
      const uid = String(body.refresh_token ?? "").split(".")[1];
      const { rows } = await pool.query("select * from auth.users where id=$1", [uid]).catch(() => ({ rows: [] }));
      if (!rows.length) return send(res, 400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
      return send(res, 200, sessionFor(rows[0]));
    }
  }
  if (path === "/auth/v1/user") {
    const claims = verify(bearer);
    if (!claims?.sub) return send(res, 401, { code: 401, msg: "invalid JWT" });
    if (req.method === "PUT" && body?.password) await pool.query("update auth.shim_passwords set hash=$2 where user_id=$1", [claims.sub, hashPw(body.password)]);
    const { rows } = await pool.query("select * from auth.users where id=$1", [claims.sub]);
    if (!rows.length) return send(res, 404, { code: 404, msg: "User not found" });
    return send(res, 200, publicUser(rows[0]));
  }
  if (path === "/auth/v1/logout") return send(res, 204);
  if (path === "/auth/v1/recover") return send(res, 200, {});
  if (path.startsWith("/auth/v1/admin/users/") && req.method === "DELETE") {
    if (verify(bearer)?.role !== "service_role") return send(res, 403, { msg: "forbidden" });
    await pool.query("delete from auth.users where id=$1", [path.split("/").pop()]);
    return send(res, 200, {});
  }
  if (path === "/auth/v1/settings") return send(res, 200, { external: { email: true, google: false } });
  return send(res, 404, { msg: `auth endpoint não emulado: ${req.method} ${path}` });
}

// ---------------- parser de filtros PostgREST ----------------
function splitTop(s) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function literal(v) {
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return v.replace(/^"(.*)"$/, "$1");
}
function condition(col, opExpr, params, table) {
  let not = false;
  let rest = opExpr;
  if (rest.startsWith("not.")) { not = true; rest = rest.slice(4); }
  const dot = rest.indexOf(".");
  const op = rest.slice(0, dot);
  const val = rest.slice(dot + 1);
  const c = ident(col);
  const p = (v) => { params.push(v); return `$${params.length}`; };
  let sql;
  switch (op) {
    case "eq": sql = `${c} = ${p(literal(val))}`; break;
    case "neq": sql = `${c} <> ${p(literal(val))}`; break;
    case "gt": sql = `${c} > ${p(val)}`; break;
    case "gte": sql = `${c} >= ${p(val)}`; break;
    case "lt": sql = `${c} < ${p(val)}`; break;
    case "lte": sql = `${c} <= ${p(val)}`; break;
    case "like": sql = `${c}::text like ${p(val.replace(/\*/g, "%"))}`; break;
    case "ilike": sql = `${c}::text ilike ${p(val.replace(/\*/g, "%"))}`; break;
    case "is": sql = val === "null" ? `${c} is null` : `${c} is ${val === "true" ? "true" : "false"}`; break;
    case "in": {
      const items = splitTop(val.replace(/^\(|\)$/g, "")).map(literal);
      const t = columnTypes[table]?.[col];
      sql = items.length ? `${c}::text = any(${p(items.map(String))}::text[])` : "false";
      void t;
      break;
    }
    default: throw Object.assign(new Error(`operador não suportado: ${op}`), { code: "PGRST100" });
  }
  return not ? `not (${sql})` : sql;
}
function logicTree(expr, params, table, joiner) {
  // expr: "a.eq.1,and(b.lt.2,c.in.(x,y))"
  return "(" + splitTop(expr).map((part) => {
    const m = part.match(/^(and|or)\((.*)\)$/);
    if (m) return logicTree(m[2], params, table, m[1] === "and" ? " and " : " or ");
    const first = part.indexOf(".");
    return condition(part.slice(0, first), part.slice(first + 1), params, table);
  }).join(joiner) + ")";
}
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "or", "and"]);
function whereClause(url, params, table) {
  const conds = [];
  for (const [k, v] of url.searchParams) {
    if (RESERVED.has(k)) continue;
    conds.push(condition(k, v, params, table));
  }
  for (const v of url.searchParams.getAll("or")) conds.push(logicTree(v.replace(/^\(|\)$/g, ""), params, table, " or "));
  for (const v of url.searchParams.getAll("and")) conds.push(logicTree(v.replace(/^\(|\)$/g, ""), params, table, " and "));
  return conds.length ? ` where ${conds.join(" and ")}` : "";
}
function parseSelect(sel) {
  const cols = [], embeds = [];
  for (const part of splitTop(sel ?? "*")) {
    const m = part.match(/^(\w+)\((.*)\)$/);
    if (m) embeds.push({ table: m[1], select: m[2] });
    else cols.push(part.trim());
  }
  return { cols: cols.length ? cols : ["*"], embeds };
}
function orderClause(url) {
  const o = url.searchParams.get("order");
  if (!o) return "";
  return " order by " + o.split(",").map((x) => {
    const [col, ...mods] = x.split(".");
    let s = ident(col);
    if (mods.includes("desc")) s += " desc";
    if (mods.includes("nullsfirst")) s += " nulls first";
    if (mods.includes("nullslast")) s += " nulls last";
    return s;
  }).join(", ");
}

async function withRole(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (claims?.role === "service_role") {
      // superusuário: ignora RLS (como service_role)
    } else if (claims?.sub) {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [claims.sub]);
    } else {
      await client.query("set local role anon");
    }
    const r = await fn(client);
    await client.query("commit");
    return r;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function encodeValue(table, col, v) {
  const t = columnTypes[table]?.[col];
  if (v === null || v === undefined) return v ?? null;
  if (t === "jsonb" || t === "json") return JSON.stringify(v);
  return v;
}

async function attachEmbeds(client, table, rows, embeds) {
  for (const e of embeds) {
    const fk = EMBEDS[e.table];
    if (!fk) throw Object.assign(new Error(`embed não suportado: ${e.table}`), { code: "PGRST200" });
    const ids = rows.map((r) => r.id).filter(Boolean);
    const { rows: children } = ids.length ? await client.query(`select * from ${ident(e.table)} where ${ident(fk)} = any($1::uuid[])`, [ids]) : { rows: [] };
    for (const r of rows) r[e.table] = children.filter((c) => c[fk] === r.id);
  }
  return rows;
}

async function handleRest(req, res, path, url) {
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  const claims = verify(bearer);
  const prefer = String(req.headers.prefer ?? "");
  const accept = String(req.headers.accept ?? "");
  const segs = path.replace("/rest/v1/", "").split("/");

  // RPC
  if (segs[0] === "rpc") {
    const body = (await readBody(req)) ?? {};
    const keys = Object.keys(body);
    const out = await withRole(claims, (c) => c.query(`select ${ident(segs[1])}(${keys.map((k, i) => `${ident(k)} := $${i + 1}`).join(", ")}) as r`, keys.map((k) => body[k])));
    return send(res, 200, out.rows[0]?.r ?? null);
  }

  const table = segs[0];
  ident(table);
  const params = [];
  const { cols, embeds } = parseSelect(url.searchParams.get("select"));
  const colSql = cols.map((c) => (c === "*" ? "*" : ident(c))).join(", ");
  const single = accept.includes("vnd.pgrst.object");
  const wantCount = /count=exact/.test(prefer);

  if (req.method === "GET" || req.method === "HEAD") {
    const where = whereClause(url, params, table);
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");
    const sql = `select ${colSql === "*" ? "*" : colSql.includes('"id"') ? colSql : `${colSql}, "id"`} from ${ident(table)}${where}${orderClause(url)}${limit ? ` limit ${Number(limit)}` : ""}${offset ? ` offset ${Number(offset)}` : ""}`;
    const result = await withRole(claims, async (c) => {
      const r = await c.query(sql, params);
      const count = wantCount ? (await c.query(`select count(*)::int as n from ${ident(table)}${where}`, params)).rows[0].n : null;
      await attachEmbeds(c, table, r.rows, embeds);
      return { rows: r.rows, count };
    });
    let rows = result.rows;
    if (cols[0] !== "*" && !cols.includes("id")) rows = rows.map(({ id, ...rest }) => { void id; return rest; });
    const range = `0-${Math.max(0, rows.length - 1)}/${result.count ?? "*"}`;
    if (req.method === "HEAD") return send(res, 200, undefined, { "Content-Range": range });
    if (single) {
      if (rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows`, hint: null });
      return send(res, 200, rows[0], { "Content-Range": range });
    }
    return send(res, 200, rows, { "Content-Range": range });
  }

  const body = await readBody(req);
  const returning = /return=representation/.test(prefer) ? " returning *" : "";

  if (req.method === "POST") {
    const rows = Array.isArray(body) ? body : [body];
    if (!rows.length) return send(res, 201, []);
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    keys.forEach(ident);
    const values = rows.map((r) => "(" + keys.map((k) => {
      if (!(k in r)) return "default";
      params.push(encodeValue(table, k, r[k]));
      return `$${params.length}`;
    }).join(", ") + ")").join(", ");
    let sql = `insert into ${ident(table)} (${keys.map(ident).join(", ")}) values ${values}`;
    const onConflict = url.searchParams.get("on_conflict");
    if (/resolution=(merge|ignore)-duplicates/.test(prefer)) {
      const target = onConflict ? `(${onConflict.split(",").map(ident).join(", ")})` : "(id)";
      if (/ignore-duplicates/.test(prefer)) sql += ` on conflict ${target} do nothing`;
      else {
        const conflictCols = onConflict ? onConflict.split(",") : ["id"];
        const upd = keys.filter((k) => !conflictCols.includes(k)).map((k) => `${ident(k)} = excluded.${ident(k)}`);
        sql += upd.length ? ` on conflict ${target} do update set ${upd.join(", ")}` : ` on conflict ${target} do nothing`;
      }
    }
    sql += returning;
    const out = await withRole(claims, async (c) => {
      const r = await c.query(sql, params);
      if (embeds.length) await attachEmbeds(c, table, r.rows, embeds);
      return r.rows;
    });
    const projected = cols[0] === "*" ? out : out.map((r) => Object.fromEntries(cols.map((k) => [k, r[k]])));
    if (single) return send(res, 201, projected[0] ?? null);
    return send(res, 201, returning ? projected : undefined);
  }

  if (req.method === "PATCH") {
    const keys = Object.keys(body ?? {});
    keys.forEach(ident);
    const sets = keys.map((k) => { params.push(encodeValue(table, k, body[k])); return `${ident(k)} = $${params.length}`; });
    const where = whereClause(url, params, table);
    const out = await withRole(claims, (c) => c.query(`update ${ident(table)} set ${sets.join(", ")}${where} returning *`, params));
    const projected = cols[0] === "*" ? out.rows : out.rows.map((r) => Object.fromEntries(cols.map((k) => [k, r[k]])));
    const headers = wantCount ? { "Content-Range": `0-${Math.max(0, out.rowCount - 1)}/${out.rowCount}` } : {};
    if (single) return projected.length === 1 ? send(res, 200, projected[0], headers) : send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `${projected.length} rows`, hint: null });
    return send(res, 200, returning ? projected : undefined, headers);
  }

  if (req.method === "DELETE") {
    const where = whereClause(url, params, table);
    const out = await withRole(claims, (c) => c.query(`delete from ${ident(table)}${where} returning id`, params));
    const headers = wantCount ? { "Content-Range": `*/${out.rowCount}` } : {};
    return send(res, returning ? 200 : 204, returning ? out.rows : undefined, headers);
  }
  return send(res, 405, { message: "método não suportado" });
}

export async function start() {
  await pool.query("create table if not exists auth.shim_passwords (user_id uuid primary key references auth.users(id) on delete cascade, hash text not null)");
  await loadColumns();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    if (req.method === "OPTIONS") return send(res, 204);
    try {
      if (path.startsWith("/auth/v1/")) return await handleAuth(req, res, path, url);
      if (path.startsWith("/rest/v1/")) return await handleRest(req, res, path, url);
      if (path.startsWith("/storage/v1/")) return send(res, 400, { error: "storage não emulado no shim de testes" });
      return send(res, 404, { message: "não emulado" });
    } catch (e) {
      if (process.env.SHIM_DEBUG) console.error(req.method, req.url, e.message);
      return pgError(res, e);
    }
  });
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  console.log(`supabase-shim ouvindo em http://127.0.0.1:${PORT}`);
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--keys")) {
    console.log(JSON.stringify({ ANON_KEY, SERVICE_KEY }));
    process.exit(0);
  }
  start().catch((e) => { console.error(e); process.exit(1); });
}
