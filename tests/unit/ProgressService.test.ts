import { ProgressService } from '@/lib/services/ProgressService';

describe('ProgressService.calculateScoring', () => {
  it('deve retornar 10 pontos base sem bonus ou penalidade', async () => {
    const result = await (ProgressService as any).calculateScoring('any-id', {});
    expect(result).toEqual({
      pointsEarned: 10,
      bonusPoints: 0,
      penaltyPoints: 0,
      totalPoints: 10
    });
  });

  it('deve adicionar +2 se timeSpent < estimatedDuration', async () => {
    const result = await (ProgressService as any).calculateScoring('any-id', {
      timeSpent: 20,
      estimatedDuration: 30
    });
    expect(result.totalPoints).toBe(12);
    expect(result.bonusPoints).toBe(2);
  });

  it('NAO deve adicionar bonus de tempo se timeSpent == estimatedDuration', async () => {
    const result = await (ProgressService as any).calculateScoring('any-id', {
      timeSpent: 30,
      estimatedDuration: 30
    });
    expect(result.totalPoints).toBe(10);
    expect(result.bonusPoints).toBe(0);
  });

  it('NAO deve adicionar bonus de tempo se timeSpent > estimatedDuration', async () => {
    const result = await (ProgressService as any).calculateScoring('any-id', {
      timeSpent: 40,
      estimatedDuration: 30
    });
    expect(result.totalPoints).toBe(10);
    expect(result.bonusPoints).toBe(0);
  });

  it('deve adicionar +1 se emotionalState.after >= 4', async () => {
    const result = await (ProgressService as any).calculateScoring('any-id', {
      emotionalState: { after: 4 }
    });
    expect(result.totalPoints).toBe(11);
    expect(result.bonusPoints).toBe(1);
  });

  it('deve adicionar +1 se emotionalState.after == 5 (maximo)', async () => {
    const result = await (ProgressService as any).calculateScoring('any-id', {
      emotionalState: { after: 5 }
    });
    expect(result.totalPoints).toBe(11);
    expect(result.bonusPoints).toBe(1);
  });

  it('NAO deve adicionar bonus emocional se after < 4', async () => {
    const result = await (ProgressService as any).calculateScoring('any-id', {
      emotionalState: { after: 3 }
    });
    expect(result.totalPoints).toBe(10);
    expect(result.bonusPoints).toBe(0);
  });

  it('NAO deve adicionar bonus emocional se before existir mas after nao', async () => {
    const result = await (ProgressService as any).calculateScoring('any-id', {
      emotionalState: { before: 2 }
    });
    expect(result.totalPoints).toBe(10);
    expect(result.bonusPoints).toBe(0);
  });

  it('deve acumular bonus: tempo + emocional', async () => {
    const result = await (ProgressService as any).calculateScoring('any-id', {
      timeSpent: 15,
      estimatedDuration: 30,
      emotionalState: { after: 5 }
    });
    expect(result.totalPoints).toBe(13);
    expect(result.bonusPoints).toBe(3);
  });

  it('deve retornar penaltyPoints como 0', async () => {
    const result = await (ProgressService as any).calculateScoring('any-id', {
      timeSpent: 50,
      estimatedDuration: 30,
      emotionalState: { after: 5 }
    });
    expect(result.penaltyPoints).toBe(0);
  });

  it('deve funcionar com timeSpent = 0 (limite inferior)', async () => {
    const result = await (ProgressService as any).calculateScoring('any-id', {
      timeSpent: 0,
      estimatedDuration: 30
    });
    expect(result.totalPoints).toBe(12);
    expect(result.bonusPoints).toBe(2);
  });
});
