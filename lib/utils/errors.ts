export class ConcurrentResetError extends Error {
  public readonly currentWeekNumber: number;

  constructor(currentWeekNumber: number) {
    super(`Instância já foi resetada por execução paralela — semana atual: ${currentWeekNumber}`);
    this.name = 'ConcurrentResetError';
    this.currentWeekNumber = currentWeekNumber;
  }
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
