"use client";
/** Renderizador Markdown mínimo e seguro (sem HTML bruto): títulos, negrito, itálico, listas e links. */
function inline(text: string) {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={m.index}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("*")) parts.push(<em key={m.index}>{t.slice(1, -1)}</em>);
    else {
      const [, label, url] = t.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      parts.push(<a key={m.index} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{label}</a>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("### ")) return <h4 key={i} className="font-bold">{inline(line.slice(4))}</h4>;
        if (line.startsWith("## ")) return <h3 key={i} className="text-base font-bold">{inline(line.slice(3))}</h3>;
        if (line.startsWith("# ")) return <h2 key={i} className="text-lg font-bold">{inline(line.slice(2))}</h2>;
        if (/^[-*] /.test(line)) return <p key={i} className="pl-4 before:-ml-3 before:mr-1.5 before:content-['•']">{inline(line.slice(2))}</p>;
        if (!line.trim()) return <div key={i} className="h-2" />;
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}

