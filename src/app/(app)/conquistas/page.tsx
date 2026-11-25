"use client";
import { Trophy, Sparkles, Lock } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, SectionTitle, Stat, Button, cn } from "@/components/ui/primitives";
import { useSession } from "@/lib/session";
import { useTable, usePoints } from "@/lib/data/hooks";
import { levelFromPoints, AVATAR_EMOJIS, AVATAR_FRAMES, LEVEL_TITLES } from "@/lib/domain/gamification";
import { addDays, localDateISO, startOfWeek, monthStart } from "@/lib/domain/dates";
import { Bars, CHART_COLORS } from "@/components/charts";

interface Ach { key: string; title: string; description: string; icon: string; points: number; category: string }

export default function AchievementsPage() {
  const { profile, updateProfile, today, tz } = useSession();
  const { data: catalog = [] } = useTable<Ach>("achievements", { order: "points" });
  const { data: mine = [] } = useTable<{ achievement_key: string; unlocked_at: string }>("user_achievements", { order: "unlocked_at", ascending: false });
  const { data: events = [] } = useTable<{ points: number; created_at: string; source: string }>("point_events", { order: "created_at", ascending: false, limit: 5000 });
  const { total } = usePoints();
  const lv = levelFromPoints(total);
  const enabled = profile?.modules?.gamificacao !== false;
  const avatar = profile?.avatar_config ?? { emoji: "🌸", color: "#7451A6", frame: "simples" };
  const weekPts = events.filter((e) => localDateISO(new Date(e.created_at), tz) >= startOfWeek(today)).reduce((s, e) => s + e.points, 0);
  const monthPts = events.filter((e) => localDateISO(new Date(e.created_at), tz) >= monthStart(today)).reduce((s, e) => s + e.points, 0);
  const chart = Array.from({ length: 8 }, (_, i) => { const ws = addDays(startOfWeek(today), -7 * (7 - i)); return { semana: `${ws.slice(8)}/${ws.slice(5, 7)}`, Pontos: events.filter((e) => { const d = localDateISO(new Date(e.created_at), tz); return d >= ws && d < addDays(ws, 7); }).reduce((s, e) => s + e.points, 0) }; });

  if (!enabled) {
    return (
      <>
        <PageHeader title="Conquistas" icon={<Trophy className="size-5" />} />
        <Card className="text-center"><p className="text-sm text-ink-soft">A gamificação está desativada.</p><Button className="mt-3" onClick={() => updateProfile({ modules: { ...profile!.modules, gamificacao: true } })}>Ativar pontos e conquistas</Button></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Conquistas" icon={<Trophy className="size-5" />} />
      <Card className="night-card stars flex items-center gap-4 border-0 p-5">
        <div className={cn("grid size-20 shrink-0 place-items-center rounded-full text-4xl", avatar.frame === "aurora" ? "ring-4 ring-iris ring-offset-2 ring-offset-transparent" : avatar.frame === "orquidea" ? "ring-4 ring-plum" : avatar.frame === "lavanda" ? "ring-2 ring-wisteria" : "")} style={{ background: avatar.color }} aria-label="Seu avatar">{avatar.emoji}</div>
        <div className="flex-1 text-white">
          <p className="text-sm text-white/70">Nível {lv.level}</p>
          <p className="text-2xl font-bold">{lv.title}</p>
          <div className="mt-2 h-2 rounded-full bg-white/15"><div className="h-2 rounded-full bg-iris" style={{ width: `${lv.progress}%` }} /></div>
          <p className="mt-1 text-xs text-white/70"><Sparkles className="mr-1 inline size-3" aria-hidden />{total} pontos · faltam {lv.needed - lv.intoLevel} para o nível {lv.level + 1}</p>
        </div>
      </Card>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Semana" value={weekPts} sub="pontos" />
        <Stat label="Mês" value={monthPts} sub="pontos" />
        <Stat label="Medalhas" value={`${mine.length}/${catalog.length}`} />
      </div>
      <p className="mt-3 text-center text-xs text-muted">Pontos nunca são perdidos. Dias difíceis fazem parte — o importante é recomeçar com carinho. 💜</p>

      <SectionTitle>Personalize seu avatar</SectionTitle>
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Emoji do avatar">{AVATAR_EMOJIS.map((e) => <button key={e} aria-pressed={avatar.emoji === e} onClick={() => updateProfile({ avatar_config: { ...avatar, emoji: e } })} className={cn("grid size-11 place-items-center rounded-full text-2xl", avatar.emoji === e ? "bg-primary-soft ring-2 ring-primary" : "bg-surface-2")}>{e}</button>)}</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Cor do avatar">{["#7451A6", "#88708E", "#BAAAC8", "#D7C5D8", "#312A44", "#5B8DEF", "#2F9E6E", "#E59A4F"].map((c) => <button key={c} aria-label={`Cor ${c}`} aria-pressed={avatar.color === c} onClick={() => updateProfile({ avatar_config: { ...avatar, color: c } })} className={cn("size-9 rounded-full", avatar.color === c && "ring-2 ring-ink ring-offset-2 ring-offset-surface")} style={{ background: c }} />)}</div>
        <div><p className="label">Molduras (recompensas por nível)</p><div className="flex flex-wrap gap-2">{AVATAR_FRAMES.map((f) => { const locked = lv.level < f.minLevel; return <Button key={f.key} size="sm" variant={avatar.frame === f.key ? "primary" : "outline"} disabled={locked} onClick={() => updateProfile({ avatar_config: { ...avatar, frame: f.key } })} icon={locked ? <Lock className="size-3.5" /> : undefined}>{f.label}{locked ? ` · nível ${f.minLevel}` : ""}</Button>; })}</div></div>
      </Card>

      <SectionTitle>Medalhas</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {catalog.map((a) => {
          const got = mine.find((m) => m.achievement_key === a.key);
          return (
            <div key={a.key} className={cn("card p-4 text-center", !got && "opacity-55 grayscale")}>
              <p className="text-3xl" aria-hidden>{a.icon}</p>
              <p className="mt-2 text-sm font-bold">{a.title}</p>
              <p className="text-xs text-muted">{a.description}</p>
              <p className="mt-1 text-xs font-semibold text-primary">{got ? `Desbloqueada em ${new Date(got.unlocked_at).toLocaleDateString("pt-BR")}` : `+${a.points} pts`}</p>
            </div>
          );
        })}
      </div>
      <SectionTitle>Progresso semanal</SectionTitle>
      <Card><Bars data={chart} xKey="semana" series={[{ key: "Pontos", label: "Pontos", color: CHART_COLORS[0] }]} /></Card>
      <p className="mt-4 text-xs text-muted">Níveis: {LEVEL_TITLES.join(" · ")}. Para desativar a gamificação, vá em <Link className="text-primary underline" href="/configuracoes">Configurações</Link>.</p>
    </>
  );
}
