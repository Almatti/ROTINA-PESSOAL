import Link from "next/link";
import { CalendarDays, CheckSquare, Wallet, Moon, Heart, Sparkles, Droplets, Dumbbell, BookOpen, Home, NotebookPen, Target } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

const modules = [
  { icon: CalendarDays, label: "Agenda", text: "Dia, semana, mês e ano — com Google Agenda." },
  { icon: CheckSquare, label: "Tarefas", text: "Lista e Kanban, prioridades e recorrência." },
  { icon: Sparkles, label: "Hábitos", text: "Sequências, metas e calendário visual." },
  { icon: Wallet, label: "Finanças", text: "Saldo, cartões, faturas, orçamento e metas." },
  { icon: Moon, label: "Sono", text: "Duração, qualidade e evolução das noites." },
  { icon: Heart, label: "Humor e diário", text: "Emoções, gratidão e reflexões." },
  { icon: Droplets, label: "Hidratação", text: "Copos interativos e meta diária." },
  { icon: Dumbbell, label: "Treinos", text: "Fichas, cargas, cronômetro e histórico." },
  { icon: BookOpen, label: "Estudos", text: "Cursos, provas, revisões e horas." },
  { icon: Home, label: "Casa", text: "Cômodos, limpeza, compras e refeições." },
  { icon: NotebookPen, label: "Anotações", text: "Seu segundo cérebro, com pastas e tags." },
  { icon: Target, label: "Metas", text: "Vision board, etapas e conquistas." },
];

export default function Welcome() {
  return (
    <main id="conteudo" className="mx-auto w-full max-w-5xl px-5 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LogoMark size={44} />
          <span className="font-display text-2xl font-semibold">Vilma</span>
        </div>
        <Link href="/entrar" className="rounded-pill px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-soft">Entrar</Link>
      </header>

      <section className="mt-14 grid items-center gap-10 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="eyebrow text-primary">Organização pessoal com carinho</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.1] sm:text-5xl">
            Todos os seus apps, <span className="text-primary">agora dentro de um só.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink-soft">
            Agenda, tarefas, hábitos, finanças e bem-estar integrados — e a Vilma, sua assistente pessoal, que entende o que você pede em português.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/cadastro" className="inline-flex h-12 items-center rounded-pill bg-primary px-6 font-semibold text-primary-ink shadow-soft-lg">Começar agora</Link>
            <Link href="/entrar" className="inline-flex h-12 items-center rounded-pill border border-line bg-surface px-6 font-semibold">Já tenho conta</Link>
          </div>
          <p className="mt-4 text-xs text-muted">Seus dados são seus: exportação e exclusão a qualquer momento, conforme a LGPD.</p>
        </div>
        <div className="relative" aria-hidden>
          <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-wisteria/60 via-plum/40 to-transparent blur-2xl" />
          <div className="relative grid grid-cols-2 gap-3">
            <div className="card col-span-2 flex items-center gap-3 p-4">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary"><Sparkles className="size-5" /></div>
              <div><p className="text-sm font-semibold">“Vilma, agende academia amanhã às 7h”</p><p className="text-xs text-muted">Linguagem natural, com confirmação</p></div>
            </div>
            <div className="night-card stars col-span-1 rounded-card p-4"><Moon className="size-5" /><p className="mt-6 text-sm font-semibold">Como foi sua noite?</p></div>
            <div className="card p-4"><Droplets className="size-5 text-info" /><div className="mt-6 flex gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className="h-6 w-4 rounded-md bg-info/30" />)}</div></div>
            <div className="card col-span-2 p-4"><p className="eyebrow">Progresso de hoje</p><div className="mt-3 h-2 rounded-full bg-surface-3"><div className="h-2 w-2/3 rounded-full bg-orchid dark:bg-primary" /></div></div>
          </div>
        </div>
      </section>

      <section className="mt-20" aria-labelledby="modulos">
        <h2 id="modulos" className="font-display text-3xl font-semibold">Tudo integrado</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ icon: Icon, label, text }) => (
            <li key={label} className="card flex gap-3 p-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="size-5" aria-hidden /></div>
              <div><p className="font-semibold">{label}</p><p className="text-sm text-muted">{text}</p></div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-16 flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-sm text-muted">
        <span>© {new Date().getFullYear()} Vilma — Minha Vida</span>
        <nav className="flex gap-4"><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos</Link></nav>
      </footer>
    </main>
  );
}
