/** Níveis com progressão suave (sem perda de pontos por inatividade). */
export function levelFromPoints(points: number) {
  // pontos necessários para alcançar o nível n: 50 * n * (n - 1)
  let level = 1;
  while (50 * (level + 1) * level <= points) level++;
  const currentFloor = 50 * level * (level - 1);
  const nextFloor = 50 * (level + 1) * level;
  return {
    level,
    points,
    intoLevel: points - currentFloor,
    needed: nextFloor - currentFloor,
    progress: Math.round(((points - currentFloor) / (nextFloor - currentFloor)) * 100),
    title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1],
  };
}

export const LEVEL_TITLES = [
  "Semente", "Broto", "Florescer", "Lavanda", "Orquídea", "Glicínia", "Jardim", "Primavera", "Constelação", "Aurora",
];

export const POINTS = {
  tarefa: 10,
  habito: 5,
  agua_meta: 10,
  sono: 5,
  humor: 5,
  foco: 10,
  treino: 10,
  meta_etapa: 15,
  meta_concluida: 50,
  financa: 2,
} as const;

export const AVATAR_EMOJIS = ["🌸", "🌷", "🪻", "🌙", "✨", "🦋", "🐱", "🌿", "☕", "📚", "💜", "🌻"];
export const AVATAR_FRAMES = [
  { key: "simples", label: "Simples", minLevel: 1 },
  { key: "lavanda", label: "Lavanda", minLevel: 2 },
  { key: "orquidea", label: "Orquídea", minLevel: 4 },
  { key: "aurora", label: "Aurora", minLevel: 7 },
] as const;
