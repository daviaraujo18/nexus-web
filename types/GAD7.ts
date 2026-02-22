// types/GAD7.ts

export type GAD7Severity = 'minimal' | 'mild' | 'moderate' | 'severe';

export type GAD7Question = {
  id: number;
  question: string;
  options: Array<{
    value: 0 | 1 | 2 | 3;
    label: string;
  }>;
};

export type GAD7Response = {
  [questionId: number]: 0 | 1 | 2 | 3;
};

export interface GAD7Assessment {
  id: string;
  studentId: string;
  weekNumber: number; // Número da semana no sistema
  responses: GAD7Response;
  totalScore: number; // 0-21
  severity: GAD7Severity;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  professionalId?: string; // Opcional: quem solicitou
  scheduleInstanceId?: string; // Opcional: se relacionado a um cronograma
  metadata?: {
    notes?: string;
    source?: 'system' | 'manual' | 'reminder';
  };
}

export interface GAD7Status {
  studentId: string;
  lastCompletedWeek?: number; // Última semana que completou
  needsAssessment: boolean; // Precisa preencher esta semana?
  lastReminder?: Date; // Última vez que foi lembrado
}

// Constantes úteis para o GAD-7
export const GAD7_QUESTIONS: GAD7Question[] = [
  {
    id: 1,
    question: "Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)",
    options: [
      { value: 0, label: "Nenhuma vez" },
      { value: 1, label: "Vários dias" },
      { value: 2, label: "Mais da metade dos dias" },
      { value: 3, label: "Quase todos os dias" }
    ]
  },
  {
    id: 2,
    question: "Não conseguir parar de se preocupar",
    options: [
      { value: 0, label: "Nenhuma vez" },
      { value: 1, label: "Vários dias" },
      { value: 2, label: "Mais da metade dos dias" },
      { value: 3, label: "Quase todos os dias" }
    ]
  },
  {
    id: 3,
    question: "Preocupar-se muito com várias coisas",
    options: [
      { value: 0, label: "Nenhuma vez" },
      { value: 1, label: "Vários dias" },
      { value: 2, label: "Mais da metade dos dias" },
      { value: 3, label: "Quase todos os dias" }
    ]
  },
  {
    id: 4,
    question: "Dificuldade para relaxar",
    options: [
      { value: 0, label: "Nenhuma vez" },
      { value: 1, label: "Vários dias" },
      { value: 2, label: "Mais da metade dos dias" },
      { value: 3, label: "Quase todos os dias" }
    ]
  },
  {
    id: 5,
    question: "Ficar tão agitado(a) que é difícil ficar parado(a)",
    options: [
      { value: 0, label: "Nenhuma vez" },
      { value: 1, label: "Vários dias" },
      { value: 2, label: "Mais da metade dos dias" },
      { value: 3, label: "Quase todos os dias" }
    ]
  },
  {
    id: 6,
    question: "Ficar facilmente irritado(a) ou impaciente",
    options: [
      { value: 0, label: "Nenhuma vez" },
      { value: 1, label: "Vários dias" },
      { value: 2, label: "Mais da metade dos dias" },
      { value: 3, label: "Quase todos os dias" }
    ]
  },
  {
    id: 7,
    question: "Sentir medo como se algo horrível fosse acontecer",
    options: [
      { value: 0, label: "Nenhuma vez" },
      { value: 1, label: "Vários dias" },
      { value: 2, label: "Mais da metade dos dias" },
      { value: 3, label: "Quase todos os dias" }
    ]
  }
];

// Funções utilitárias para GAD-7
export function getGAD7Severity(score: number): GAD7Severity {
  if (score <= 4) return 'minimal';
  if (score <= 9) return 'mild';
  if (score <= 14) return 'moderate';
  return 'severe';
}

export function getGAD7SeverityColor(severity: GAD7Severity): string {
  const colors = {
    minimal: '#10b981', // verde
    mild: '#f59e0b',    // amarelo
    moderate: '#f97316', // laranja
    severe: '#ef4444'    // vermelho
  };
  return colors[severity];
}

export function getGAD7SeverityLabel(severity: GAD7Severity): string {
  const labels = {
    minimal: 'Mínimo',
    mild: 'Leve',
    moderate: 'Moderado',
    severe: 'Severo'
  };
  return labels[severity];
}

export function getGAD7Recommendation(severity: GAD7Severity): string {
  const recommendations = {
    minimal: 'Sintomas de ansiedade mínimos. Continue com as atividades de bem-estar.',
    mild: 'Sintomas leves de ansiedade. Considere práticas de relaxamento e mindfulness.',
    moderate: 'Sintomas moderados de ansiedade. Recomenda-se acompanhamento profissional.',
    severe: 'Sintomas severos de ansiedade. Busque acompanhamento profissional imediatamente.'
  };
  return recommendations[severity];
}