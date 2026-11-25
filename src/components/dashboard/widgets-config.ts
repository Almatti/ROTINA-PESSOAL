export const DEFAULT_WIDGETS: { key: string; label: string; interest?: string }[] = [
  { key: "agenda", label: "Minha agenda" },
  { key: "tarefas", label: "Minhas tarefas" },
  { key: "habitos", label: "Meus hábitos", interest: "habitos" },
  { key: "financas", label: "Finanças", interest: "financas" },
  { key: "sono", label: "Sono", interest: "sono" },
  { key: "humor", label: "Bem-estar (humor)" },
  { key: "agua", label: "Hidratação", interest: "agua" },
  { key: "metas", label: "Metas", interest: "metas" },
  { key: "foco", label: "Modo foco" },
  { key: "conquistas", label: "Pontos e conquistas" },
];

export function resolveWidgets(saved: { key: string; visible: boolean }[] | null | undefined) {
  const list = (saved ?? []).filter((w) => DEFAULT_WIDGETS.some((d) => d.key === w.key));
  for (const d of DEFAULT_WIDGETS) if (!list.find((w) => w.key === d.key)) list.push({ key: d.key, visible: true });
  return list;
}
