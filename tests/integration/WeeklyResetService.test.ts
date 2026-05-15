import {
  doc,
  setDoc,
  getDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { DateUtils } from '@/lib/utils/dateUtils';
import { WeeklyResetService } from '@/lib/services/WeeklyResetService';
import { clearFirestoreEmulator, emulatorReady } from '../helpers/emulator';

const TEMPLATE_ID = 'test-template-1';
const INSTANCE_ID = 'test-instance-1';
const ACTIVITY_ID = 'test-activity-1';

async function createTestTemplate() {
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);

  await setDoc(doc(firestore, 'weeklySchedules', TEMPLATE_ID), {
    id: TEMPLATE_ID,
    name: 'Test Template',
    startDate: Timestamp.fromDate(new Date('2025-01-06')),
    endDate: Timestamp.fromDate(futureDate),
    isActive: true,
    isDeleted: false,
    status: 'active',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

async function createTestActivity() {
  await setDoc(doc(firestore, 'scheduleActivities', ACTIVITY_ID), {
    id: ACTIVITY_ID,
    scheduleTemplateId: TEMPLATE_ID,
    dayOfWeek: 0,
    orderIndex: 1,
    type: 'quick',
    title: 'Test Activity',
    description: 'A test activity',
    instructions: 'Do the thing',
    config: { requiresConfirmation: true },
    scoring: {
      isRequired: true,
      pointsOnCompletion: 10,
    },
    metadata: {
      estimatedDuration: 15,
      difficulty: 'easy',
    },
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

async function createTestInstance(overrides: Record<string, unknown> = {}) {
  const lastWeekStart = DateUtils.addWeeks(DateUtils.getWeekStartDate(new Date()), -1);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekStart.getDate() + 6);

  await setDoc(doc(firestore, 'scheduleInstances', INSTANCE_ID), {
    id: INSTANCE_ID,
    scheduleTemplateId: TEMPLATE_ID,
    studentId: 'test-student-1',
    professionalId: 'test-professional-1',
    currentWeekNumber: 5,
    currentWeekStartDate: Timestamp.fromDate(lastWeekStart),
    currentWeekEndDate: Timestamp.fromDate(lastWeekEnd),
    status: 'active',
    isActive: true,
    progressCache: {
      completedActivities: 3,
      totalActivities: 5,
      completionPercentage: 60,
      totalPointsEarned: 30,
      streakDays: 2,
      lastUpdatedAt: Timestamp.now(),
    },
    activitiesReady: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  });
}

async function instanceExists(instanceId: string): Promise<boolean> {
  const snap = await getDoc(doc(firestore, 'scheduleInstances', instanceId));
  return snap.exists();
}

async function readInstance(instanceId: string): Promise<any> {
  const snap = await getDoc(doc(firestore, 'scheduleInstances', instanceId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

beforeAll(async () => {
  const ready = await emulatorReady();
  if (!ready) {
    throw new Error(
      'Firestore emulator nao esta rodando em localhost:8080. ' +
      'Execute: firebase emulators:start --only firestore'
    );
  }
});

beforeEach(async () => {
  await clearFirestoreEmulator();
  await createTestTemplate();
  await createTestActivity();
});

afterAll(async () => {
  // Cleanup all test data
  const collections = ['scheduleInstances', 'weeklySchedules', 'scheduleActivities', 'weeklySnapshots'];
  for (const col of collections) {
    const snap = await getDocs(collection(firestore, col));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  }
});

describe('WeeklyResetService - reset concorrente', () => {
  it('deve avancar a semana apenas uma vez quando duas chamadas concorrentes ocorrem', async () => {
    await createTestInstance();

    const [result1, result2] = await Promise.allSettled([
      WeeklyResetService.forceResetForInstance(INSTANCE_ID),
      WeeklyResetService.forceResetForInstance(INSTANCE_ID),
    ]);

    const fulfilled = [result1, result2].filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    expect(fulfilled.length).toBe(2);

    const outcomes = fulfilled.map(r => r.value);
    const successes = outcomes.filter((o: any) => o.status === 'success');
    const skips = outcomes.filter((o: any) => o.status === 'skipped');

    expect(successes.length).toBe(1);
    expect(skips.length).toBe(1);

    const instance = await readInstance(INSTANCE_ID);
    expect(instance).not.toBeNull();
    expect(instance!.currentWeekNumber).toBe(6);
  });
});

describe('WeeklyResetService - rollback atomico', () => {
  it('deve reverter instancia e restaurar snapshot quando geracao de atividades falha', async () => {
    await createTestInstance();

    const spy = jest
      .spyOn(WeeklyResetService as any, 'generateNewWeekActivities')
      .mockRejectedValue(new Error('Falha simulada na geracao de atividades'));

    try {
      const result = await WeeklyResetService.forceResetForInstance(INSTANCE_ID);

      expect(result.status).toBe('error');
      expect(result.newActivitiesCount).toBe(0);

      const instance = await readInstance(INSTANCE_ID);
      expect(instance).not.toBeNull();
      expect(instance!.currentWeekNumber).toBe(5);
      expect(instance!.activitiesReady).toBe(true);
      expect(instance!.progressCache?.completedActivities).toBe(3);
      expect(instance!.progressCache?.totalActivities).toBe(5);
      expect(instance!.progressCache?.completionPercentage).toBe(60);
    } finally {
      spy.mockRestore();
    }
  });
});
