// lib/utils/constants.ts
export const AUTH_CONSTANTS = {
  PASSWORD: {
    MIN_LENGTH: 6,
    RECOMMENDED_LENGTH: 8,
    MAX_LENGTH: 128,
    STRENGTH_LABELS: ['Muito fraca', 'Fraca', 'Média', 'Boa', 'Forte', 'Muito forte'],
    STRENGTH_COLORS: ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#059669', '#047857']
  },
  
  RATE_LIMIT: {
    MAX_ATTEMPTS: 5,
    WINDOW_MINUTES: 15
  },
  
  VALIDATION: {
    MIN_NAME_LENGTH: 3,
    MAX_NAME_LENGTH: 100,
    MIN_AGE: 4,
    MAX_AGE: 120
  }
};

export const USER_ROLES = {
  STUDENT: 'student',
  PSYCHOLOGIST: 'psychologist',
  PSYCHIATRIST: 'psychiatrist',
  MONITOR: 'monitor',
  COORDINATOR: 'coordinator'
} as const;

export const GRADES = [
  'Pré-escola',
  '1º ano',
  '2º ano',
  '3º ano',
  '4º ano',
  '5º ano',
  '6º ano',
  '7º ano',
  '8º ano',
  '9º ano',
  '1º ano EM',
  '2º ano EM',
  '3º ano EM'
] as const;

// Adicione estas arrays de opções (pode mover para um arquivo de constants depois)
export const SCHOOL_OPTIONS = [
  { value: 'instituto-dom-barreto', label: 'Instituto Dom Barreto' },
  { value: 'bright-bee', label: 'Bright Bee' },
  { value: 'lerote', label: 'Lerote' },
  { value: 'great-school', label: 'Great School' },
  { value: 'santa-maria-goretti', label: 'Santa Maria Goretti' },
  { value: 'sao-jose', label: 'São José' },
];

export const GRADE_OPTIONS = [
  { value: '6ano-ef', label: '6º Ano do Ensino Fundamental' },
  { value: '7ano-ef', label: '7º Ano do Ensino Fundamental' },
  { value: '8ano-ef', label: '8º Ano do Ensino Fundamental' },
  { value: '9ano-ef', label: '9º Ano do Ensino Fundamental' },
  { value: '1ano-em', label: '1º Ano do Ensino Médio' },
  { value: '2ano-em', label: '2º Ano do Ensino Médio' },
  { value: '3ano-em', label: '3º Ano do Ensino Médio' },
  { value: 'pre-vestibular', label: 'Pré-Vestibular' },
];

export const getSchoolLabel = (value: string) => {
  return SCHOOL_OPTIONS.find(opt => opt.value === value)?.label || value;
};

export const getGradeLabel = (value: string) => {
  return GRADE_OPTIONS.find(opt => opt.value === value)?.label || value;
};