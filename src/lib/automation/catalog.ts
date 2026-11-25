/** Catálogo de automações configuráveis (chaves usadas na tabela automations). */
export const AUTOMATIONS: { key: string; label: string; description: string }[] = [
  { key: "tarefas_recorrentes", label: "Gerar tarefas recorrentes", description: "Cria a próxima ocorrência das tarefas que se repetem." },
  { key: "contas_fixas", label: "Gerar contas fixas do mês", description: "Lança contas fixas e assinaturas como “a pagar” (nunca paga nada)." },
  { key: "tarefas_atrasadas", label: "Identificar tarefas atrasadas", description: "Avisa quando há tarefas com prazo vencido." },
  { key: "sugerir_reagendamento", label: "Sugerir reagendamento", description: "Propõe novas datas para tarefas atrasadas (você decide)." },
  { key: "compromissos_proximos", label: "Avisar compromissos próximos", description: "Notificação de compromissos nas próximas 24 h." },
  { key: "vencimentos", label: "Avisar vencimentos", description: "Contas a pagar e faturas vencendo em até 3 dias." },
  { key: "resumo_manha", label: "Resumo do dia pela manhã", description: "Agenda, tarefas e hábitos do dia." },
  { key: "revisao_noite", label: "Revisão diária à noite", description: "O que foi concluído e o que fica para amanhã." },
  { key: "planejamento_semanal", label: "Planejamento semanal (domingo)", description: "Panorama da semana que começa." },
  { key: "relatorio_mensal", label: "Relatório mensal", description: "Resumo do mês anterior no dia 1º." },
  { key: "atualizar_metas", label: "Atualizar metas", description: "Avisa metas com prazo próximo e sem revisão." },
  { key: "progresso_diario", label: "Calcular progresso diário", description: "Registra seu progresso do dia para os gráficos." },
];

