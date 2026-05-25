// lib/utils/levelUtils.ts
// Funções puras para cálculo de nível do aluno

export const LEVEL_THRESHOLD = 200;

export function calculateLevel(totalPoints: number): number {
  return Math.floor(totalPoints / LEVEL_THRESHOLD) + 1;
}

export function pointsToNextLevel(totalPoints: number): number {
  return LEVEL_THRESHOLD - (totalPoints % LEVEL_THRESHOLD);
}

export function currentLevelProgress(totalPoints: number): number {
  return totalPoints % LEVEL_THRESHOLD;
}

export function calculateStreak(completedDates: Date[]): number {
  if (completedDates.length === 0) return 0;
  const dateSet = new Set<string>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const d of completedDates) {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    if (dt.getTime() <= today.getTime()) {
      dateSet.add(formatDateKey(dt));
    }
  }
  let streak = 0;
  const checkDate = new Date(today);
  if (!dateSet.has(formatDateKey(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (dateSet.has(formatDateKey(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
