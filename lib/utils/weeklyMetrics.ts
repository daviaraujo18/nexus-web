export interface ActivityData {
  status: string;
  dayOfWeek: number;
  scoring?: { pointsEarned?: number };
  executionData?: { timeSpent?: number };
  scheduledDate?: Date | null;
  completedAt?: Date | null;
}

export interface WeeklyMetrics {
  totalActivities: number;
  completedActivities: number;
  skippedActivities: number;
  completionRate: number;
  totalPointsEarned: number;
  averagePointsPerActivity: number;
  totalTimeSpent: number;
  averageTimePerActivity: number;
  consistencyScore: number;
  adherenceScore: number;
  streakAtEndOfWeek: number;
}

export function calculateTotalActivities(activities: ActivityData[]): number {
  return activities.length;
}

export function calculateCompletedActivities(activities: ActivityData[]): number {
  return activities.filter(a => a.status === 'completed').length;
}

export function calculateSkippedActivities(activities: ActivityData[]): number {
  return activities.filter(a => a.status === 'skipped').length;
}

export function calculateCompletionRate(activities: ActivityData[]): number {
  const total = activities.length;
  if (total === 0) return 0;
  const completed = activities.filter(a => a.status === 'completed').length;
  return Math.round((completed / total) * 100);
}

export function calculateTotalPoints(activities: ActivityData[]): number {
  return activities
    .filter(a => a.status === 'completed')
    .reduce((sum, a) => sum + (a.scoring?.pointsEarned || 0), 0);
}

export function calculateAveragePointsPerActivity(activities: ActivityData[]): number {
  const completed = activities.filter(a => a.status === 'completed');
  if (completed.length === 0) return 0;
  const totalPoints = completed.reduce((sum, a) => sum + (a.scoring?.pointsEarned || 0), 0);
  return Math.round(totalPoints / completed.length);
}

export function calculateTotalTimeSpent(activities: ActivityData[]): number {
  return activities
    .filter(a => a.status === 'completed' && a.executionData?.timeSpent)
    .reduce((sum, a) => sum + (a.executionData!.timeSpent || 0), 0);
}

export function calculateAverageTimePerActivity(activities: ActivityData[]): number {
  const completed = activities.filter(a => a.status === 'completed' && a.executionData?.timeSpent);
  if (completed.length === 0) return 0;
  const totalTime = completed.reduce((sum, a) => sum + (a.executionData!.timeSpent || 0), 0);
  return Math.round(totalTime / completed.length);
}

export function calculateConsistencyScore(activities: ActivityData[]): number {
  const completed = activities.filter(a => a.status === 'completed');
  if (completed.length === 0) return 0;
  const uniqueDays = new Set(completed.map(a => a.dayOfWeek)).size;
  return Math.round((uniqueDays / 7) * 100);
}

export function calculateAdherenceScore(activities: ActivityData[]): number {
  const completed = activities.filter(a => a.status === 'completed');
  if (completed.length === 0) return 0;
  const onTime = completed.filter(a => {
    if (!a.completedAt || !a.scheduledDate) return false;
    const cd = a.completedAt;
    const sd = a.scheduledDate;
    return cd.getFullYear() === sd.getFullYear()
      && cd.getMonth() === sd.getMonth()
      && cd.getDate() === sd.getDate();
  }).length;
  return Math.round((onTime / completed.length) * 100);
}

export function calculateStreakAtEndOfWeek(activities: ActivityData[]): number {
  const completedDates = [
    ...new Set(
      activities
        .filter(a => a.status === 'completed' && a.completedAt)
        .map(a => {
          const d = a.completedAt!;
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })
    ),
  ].sort().reverse();

  if (completedDates.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < completedDates.length; i++) {
    const prev = new Date(completedDates[i - 1]);
    const curr = new Date(completedDates[i]);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

export function calculateWeeklyMetrics(activities: ActivityData[]): WeeklyMetrics {
  const totalActivities = calculateTotalActivities(activities);
  const completedActivities = calculateCompletedActivities(activities);
  const skippedActivities = calculateSkippedActivities(activities);
  const completionRate = calculateCompletionRate(activities);
  const totalPointsEarned = calculateTotalPoints(activities);
  const averagePointsPerActivity = calculateAveragePointsPerActivity(activities);
  const totalTimeSpent = calculateTotalTimeSpent(activities);
  const averageTimePerActivity = calculateAverageTimePerActivity(activities);
  const consistencyScore = calculateConsistencyScore(activities);
  const adherenceScore = calculateAdherenceScore(activities);
  const streakAtEndOfWeek = calculateStreakAtEndOfWeek(activities);

  return {
    totalActivities,
    completedActivities,
    skippedActivities,
    completionRate,
    totalPointsEarned,
    averagePointsPerActivity,
    totalTimeSpent,
    averageTimePerActivity,
    consistencyScore,
    adherenceScore,
    streakAtEndOfWeek,
  };
}
