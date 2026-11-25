// Gera src/lib/local/schema.generated.ts a partir das migrations SQL:
// colunas, valores padrão, restrições únicas e exclusões em cascata.
// Mantém o "banco local" (modo sem servidor) idêntico ao esquema do Supabase.
import fs from "node:fs";

const files = fs.readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
const sql = files.map((f) => fs.readFileSync(`supabase/migrations/${f}`, "utf8")).join("\n");
const tables = {};
const re = /create table public\.(\w+) \(([\s\S]*?)\n\);/g;
let m;
while ((m = re.exec(sql))) {
  const [, name, body] = m;
  const t = { columns: {}, unique: [], cascade: [], setNull: [] };
  for (const raw of body.split("\n")) {
    const line = raw.trim().replace(/,$/, "");
    if (!line || line.startsWith("--")) continue;
    const u = line.match(/^unique \(([^)]+)\)/);
    if (u) { t.unique.push(u[1].split(",").map((s) => s.trim())); continue; }
    if (/^(check|primary key|constraint)/.test(line)) continue;
    const c = line.match(/^(\w+)\s+([a-z0-9_\[\]()]+(?:\s*\(\d+,\s*\d+\))?)/i);
    if (!c) continue;
    const [, col, type] = c;
    let def = null;
    const d = line.match(/ default (.+?)(?= references| check| not null| unique| primary|$)/);
    if (d) {
      const e = d[1].trim();
      if (/^gen_random_uuid\(\)$/.test(e)) def = { fn: "uuid" };
      else if (/^auth\.uid\(\)$/.test(e)) def = { fn: "uid" };
      else if (/^now\(\) \+ interval '30 minutes'$/.test(e)) def = { fn: "now+30m" };
      else if (/^now\(\)$/.test(e)) def = { fn: "now" };
      else if (/^current_date$/.test(e)) def = { fn: "today" };
      else if (/^(true|false)$/.test(e)) def = { value: e === "true" };
      else if (/^-?\d+(\.\d+)?$/.test(e)) def = { value: Number(e) };
      else if (/^'(.*)'::jsonb$/.test(e)) def = { value: JSON.parse(e.match(/^'(.*)'::jsonb$/)[1].replace(/''/g, "'")) };
      else if (/^'\{\}'$/.test(e)) def = { value: [] };
      else if (/^'(.*)'$/.test(e)) def = { value: e.slice(1, -1).replace(/''/g, "'") };
      else throw new Error(`default não suportado em ${name}.${col}: ${e}`);
    }
    t.columns[col] = { type, default: def };
    if (/ unique( |$)/.test(line) && !line.includes("unique (")) t.unique.push([col]);
    const fk = line.match(/references public\.(\w+)\(id\) on delete (cascade|set null)/);
    if (fk) (fk[2] === "cascade" ? t.cascade : t.setNull).push({ parent: fk[1], column: col });
    if (col === "id" && /primary key/.test(line)) t.unique.push(["id"]);
  }
  tables[name] = t;
}
// colunas adicionadas depois (alter table ... add column)
for (const a of sql.matchAll(/alter table public\.(\w+) add column (?:if not exists )?(\w+) ([a-z0-9_]+)/g)) {
  if (tables[a[1]] && !tables[a[1]].columns[a[2]]) tables[a[1]].columns[a[2]] = { type: a[3], default: null };
}
// índices únicos criados fora da tabela
for (const u of sql.matchAll(/create unique index \w+ on public\.(\w+) \(([^)]+)\)/g)) {
  const cols = u[2].split(",").map((s) => s.trim());
  if (cols.every((c) => /^\w+$/.test(c))) tables[u[1]]?.unique.push(cols);
}
// sementes: catálogo de conquistas, categorias padrão e automações (mesmos dados do SQL)
const achBlock = sql.slice(sql.indexOf("insert into public.achievements"), sql.indexOf("on conflict (key)"));
const achievements = [...achBlock.matchAll(/\('(\w+)', '((?:[^']|'')*)', '((?:[^']|'')*)', '([^']*)', (\d+), '(\w+)'\)/g)].map((r) => ({ key: r[1], title: r[2], description: r[3], icon: r[4], points: Number(r[5]), category: r[6] }));
const categories = [...sql.matchAll(/\(p_user,'(\w+)','([^']+)','(#[0-9A-Fa-f]{6})','([^']+)'\)/g)].map((r) => ({ scope: r[1], name: r[2], color: r[3], icon: r[4] }));
const autoMatch = sql.match(/unnest\(array\[([\s\S]*?)\]\)/);
const automations = [...autoMatch[1].matchAll(/'(\w+)'/g)].map((r) => r[1]);
const out = `// ARQUIVO GERADO por scripts/gen-local-schema.mjs — não edite à mão.\n/* eslint-disable */\nexport const LOCAL_SCHEMA = ${JSON.stringify(tables, null, 1)} as const;\nexport const LOCAL_SEED = ${JSON.stringify({ achievements, categories, automations })} as const;\n`;
fs.writeFileSync("src/lib/local/schema.generated.ts", out);
console.log(`esquema local gerado: ${Object.keys(tables).length} tabelas`);
