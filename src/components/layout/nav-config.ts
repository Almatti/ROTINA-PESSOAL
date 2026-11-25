import {
  Home, CalendarCheck, ClipboardList, Heart, Sparkles, CalendarDays, CheckSquare, Wallet, Briefcase, GraduationCap,
  House, NotebookPen, Target, Settings, User, Trophy, Moon, Smile, Droplets, Dumbbell, Timer, Flower2, Bell, Repeat,
} from "lucide-react";

export const BOTTOM_NAV = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/meu-plano", label: "Meu plano", icon: CalendarCheck },
  { href: "/tracker", label: "Tracker", icon: ClipboardList },
  { href: "/bem-estar", label: "Bem-estar", icon: Heart },
  { href: "/vilma", label: "Vilma", icon: Sparkles },
] as const;

export interface MenuItem { href: string; label: string; icon: typeof Home; module?: string }

export const SIDE_MENU: { title: string; items: MenuItem[] }[] = [
  {
    title: "Organização",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
      { href: "/habitos", label: "Hábitos", icon: Repeat },
      { href: "/financas", label: "Finanças", icon: Wallet },
      { href: "/foco", label: "Modo foco", icon: Timer },
    ],
  },
  {
    title: "Vida",
    items: [
      { href: "/trabalho", label: "Trabalho", icon: Briefcase, module: "trabalho" },
      { href: "/estudos", label: "Estudos", icon: GraduationCap, module: "estudos" },
      { href: "/casa", label: "Casa", icon: House, module: "casa" },
      { href: "/notas", label: "Anotações", icon: NotebookPen },
      { href: "/metas", label: "Metas", icon: Target },
    ],
  },
  {
    title: "Bem-estar",
    items: [
      { href: "/sono", label: "Sono", icon: Moon },
      { href: "/humor", label: "Humor e diário", icon: Smile },
      { href: "/ciclo", label: "Ciclo", icon: Flower2, module: "ciclo" },
      { href: "/agua", label: "Hidratação", icon: Droplets },
      { href: "/treinos", label: "Treinos", icon: Dumbbell, module: "treinos" },
    ],
  },
  {
    title: "Você",
    items: [
      { href: "/conquistas", label: "Conquistas", icon: Trophy, module: "gamificacao" },
      { href: "/notificacoes", label: "Notificações", icon: Bell },
      { href: "/perfil", label: "Perfil", icon: User },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];
