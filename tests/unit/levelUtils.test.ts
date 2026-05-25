import {
  calculateLevel,
  pointsToNextLevel,
  currentLevelProgress,
  calculateStreak,
  LEVEL_THRESHOLD
} from '@/lib/utils/levelUtils';

describe('calculateLevel', () => {
  it('deve retornar nivel 1 para 0 pontos', () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it('deve retornar nivel 1 para 199 pontos', () => {
    expect(calculateLevel(199)).toBe(1);
  });

  it('deve retornar nivel 2 para 200 pontos', () => {
    expect(calculateLevel(200)).toBe(2);
  });

  it('deve retornar nivel 2 para 399 pontos', () => {
    expect(calculateLevel(399)).toBe(2);
  });

  it('deve retornar nivel 3 para 400 pontos', () => {
    expect(calculateLevel(400)).toBe(3);
  });

  it('deve retornar nivel 5 para 800 pontos', () => {
    expect(calculateLevel(800)).toBe(5);
  });

  it('deve lidar com numeros negativos (retornando nivel 0 ou inferior)', () => {
    expect(calculateLevel(-1)).toBe(0);
  });

  it('deve lidar com ponto flutuante', () => {
    expect(calculateLevel(150.7)).toBe(1);
    expect(calculateLevel(200.1)).toBe(2);
  });

  it('deve retornar nivel 51 para 10000 pontos', () => {
    expect(calculateLevel(10000)).toBe(51);
  });
});

describe('pointsToNextLevel', () => {
  it('deve retornar 200 para 0 pontos', () => {
    expect(pointsToNextLevel(0)).toBe(200);
  });

  it('deve retornar 1 para 199 pontos', () => {
    expect(pointsToNextLevel(199)).toBe(1);
  });

  it('deve retornar 200 para 200 pontos', () => {
    expect(pointsToNextLevel(200)).toBe(200);
  });

  it('deve retornar 100 para 100 pontos', () => {
    expect(pointsToNextLevel(100)).toBe(100);
  });
});

describe('currentLevelProgress', () => {
  it('deve retornar 0 para 0 pontos', () => {
    expect(currentLevelProgress(0)).toBe(0);
  });

  it('deve retornar 150 para 150 pontos', () => {
    expect(currentLevelProgress(150)).toBe(150);
  });

  it('deve retornar 0 para 200 pontos (novo nivel)', () => {
    expect(currentLevelProgress(200)).toBe(0);
  });

  it('deve retornar 50 para 250 pontos', () => {
    expect(currentLevelProgress(250)).toBe(50);
  });
});

describe('calculateStreak', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  it('deve retornar 0 para array vazio', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('deve retornar 1 para apenas hoje', () => {
    expect(calculateStreak([today])).toBe(1);
  });

  it('deve retornar 2 para hoje + ontem', () => {
    expect(calculateStreak([today, yesterday])).toBe(2);
  });

  it('deve retornar 3 para hoje + ontem + anteontem', () => {
    expect(calculateStreak([today, yesterday, twoDaysAgo])).toBe(3);
  });

  it('deve retornar 1 para apenas ontem (sem atividade hoje)', () => {
    expect(calculateStreak([yesterday])).toBe(1);
  });

  it('deve retornar 2 para ontem + anteontem (sem hoje)', () => {
    expect(calculateStreak([yesterday, twoDaysAgo])).toBe(2);
  });

  it('deve ignorar datas futuras', () => {
    expect(calculateStreak([today, tomorrow])).toBe(1);
  });

  it('deve quebrar streak se houver gap', () => {
    expect(calculateStreak([today, twoDaysAgo])).toBe(1);
  });

  it('deve ignorar datas repetidas', () => {
    expect(calculateStreak([today, today, today])).toBe(1);
  });

  it('deve funcionar com streak longa', () => {
    const dates: Date[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d);
    }
    expect(calculateStreak(dates)).toBe(30);
  });

  it('deve ordenar datas fora de ordem', () => {
    expect(calculateStreak([twoDaysAgo, today, yesterday])).toBe(3);
  });

  it('deve retornar 0 para datas todas futuras', () => {
    const future = new Date(today);
    future.setDate(future.getDate() + 5);
    expect(calculateStreak([future, tomorrow])).toBe(0);
  });
});
