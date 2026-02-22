// services/SnapshotAggregator.ts
import { WeeklySnapshot } from '@/types/schedule';
import { GAD7Assessment } from '@/types/GAD7';
import { AggregatedMetrics } from '@/types/analytics';
import { ActivityType } from '@/types/schedule';

export class SnapshotAggregator {
  
  async aggregateMetrics(
    snapshots: WeeklySnapshot[],
    assessments: GAD7Assessment[]
  ): Promise<AggregatedMetrics> {
    if (snapshots.length === 0) {
      return this.getEmptyMetrics();
    }
    
    // Engajamento
    const completionRates = snapshots.map(s => s.metrics.completionRate);
    const consistencyScores = snapshots.map(s => s.metrics.consistencyScore);
    const adherenceScores = snapshots.map(s => s.metrics.adherenceScore);
    const timesSpent = snapshots.map(s => s.metrics.totalTimeSpent);
    
    // Pontuação
    const pointsByStudent = this.groupByStudent(snapshots, 'totalPointsEarned');
    
    // GAD7
    const gad7Scores = assessments.map(a => a.totalScore);
    const gad7BySeverity = this.groupGAD7BySeverity(assessments);
    
    // Streaks
    const streaks = snapshots.map(s => s.metrics.streakAtEndOfWeek);
    
    const studentPointsValues = Object.values(pointsByStudent);

    return {
      // Engajamento
      averageCompletionRate: this.average(completionRates),
      averageConsistencyScore: this.average(consistencyScores),
      averageAdherenceScore: this.average(adherenceScores),
      averageTimePerActivity: this.average(timesSpent),
      totalActivitiesCompleted: snapshots.reduce((sum, s) => sum + s.metrics.completedActivities, 0),
      totalTimeSpent: snapshots.reduce((sum, s) => sum + s.metrics.totalTimeSpent, 0),
      
      // Pontuação
      totalPointsEarned: snapshots.reduce((sum, s) => sum + s.metrics.totalPointsEarned, 0),
      averagePointsPerStudent: this.average(studentPointsValues),
      pointsDistribution: {
        min: studentPointsValues.length > 0 ? Math.min(...studentPointsValues) : 0,
        max: studentPointsValues.length > 0 ? Math.max(...studentPointsValues) : 0,
        median: this.median(studentPointsValues),
        average: this.average(studentPointsValues)
      },
      
      // GAD7
      averageGAD7Score: gad7Scores.length > 0 ? this.average(gad7Scores) : 0,
      gad7Distribution: gad7BySeverity,
      studentsWithGAD7: (assessments.length / this.getUniqueStudentCount(snapshots)) * 100,
      gad7Trend: this.calculateGAD7Trend(assessments),
      
      // Streaks
      averageStreak: this.average(streaks),
      maxStreak: Math.max(...streaks, 0),
      studentsWithActiveStreak: streaks.filter(s => s > 0).length
    };
  }
  
  async aggregateByStudent(
    snapshots: WeeklySnapshot[],
    studentId: string
  ): Promise<{
    metrics: AggregatedMetrics;
    trends: any;
  }> {
    const studentSnapshots = snapshots.filter(s => s.studentId === studentId);
    
    if (studentSnapshots.length === 0) {
      return {
        metrics: this.getEmptyMetrics(),
        trends: {}
      };
    }
    
    const metrics = await this.aggregateMetrics(studentSnapshots, []);
    const trends = this.calculateStudentTrends(studentSnapshots);
    
    return { metrics, trends };
  }
  
  async aggregateByActivityType(
    snapshots: WeeklySnapshot[]
  ): Promise<Record<ActivityType, {
    totalCompleted: number;
    averageTime: number;
    averagePoints: number;
    completionRate: number;
  }>> {
    const result: any = {};
    const activityTypes: ActivityType[] = ['quick', 'text', 'quiz', 'video', 'checklist', 'file', 'app'];
    
    activityTypes.forEach(type => {
      const typeSnapshots = snapshots.filter(s => s.activityTypeBreakdown[type]);
      
      if (typeSnapshots.length === 0) {
        result[type] = {
          totalCompleted: 0,
          averageTime: 0,
          averagePoints: 0,
          completionRate: 0
        };
        return;
      }
      
      const totalCompleted = typeSnapshots.reduce(
        (sum, s) => sum + (s.activityTypeBreakdown[type]?.completed || 0), 
        0
      );
      
      const totalPossible = typeSnapshots.reduce(
        (sum, s) => sum + (s.activityTypeBreakdown[type]?.total || 0), 
        0
      );
      
      const avgTime = this.average(
        typeSnapshots.map(s => s.activityTypeBreakdown[type]?.averageTime || 0)
      );
      
      const avgPoints = this.average(
        typeSnapshots.map(s => s.activityTypeBreakdown[type]?.averagePoints || 0)
      );
      
      result[type] = {
        totalCompleted,
        averageTime: avgTime,
        averagePoints: avgPoints,
        completionRate: totalPossible > 0 ? (totalCompleted / totalPossible) * 100 : 0
      };
    });
    
    return result;
  }
  
  private getEmptyMetrics(): AggregatedMetrics {
    return {
      averageCompletionRate: 0,
      averageConsistencyScore: 0,
      averageAdherenceScore: 0,
      averageTimePerActivity: 0,
      totalActivitiesCompleted: 0,
      totalTimeSpent: 0,
      totalPointsEarned: 0,
      averagePointsPerStudent: 0,
      pointsDistribution: {
        min: 0,
        max: 0,
        median: 0,
        average: 0
      },
      averageGAD7Score: 0,
      gad7Distribution: {
        minimal: 0,
        mild: 0,
        moderate: 0,
        severe: 0
      },
      studentsWithGAD7: 0,
      gad7Trend: 'stable',
      averageStreak: 0,
      maxStreak: 0,
      studentsWithActiveStreak: 0
    };
  }
  
  private groupByStudent(
    snapshots: WeeklySnapshot[], 
    metric: keyof WeeklySnapshot['metrics']
  ): Record<string, number> {
    const result: Record<string, number> = {};
    
    snapshots.forEach(snapshot => {
      if (!result[snapshot.studentId]) {
        result[snapshot.studentId] = 0;
      }
      result[snapshot.studentId] += snapshot.metrics[metric] as number;
    });
    
    return result;
  }
  
  private groupGAD7BySeverity(assessments: GAD7Assessment[]): Record<string, number> {
    const result = {
      minimal: 0,
      mild: 0,
      moderate: 0,
      severe: 0
    };
    
    assessments.forEach(a => {
      if (result.hasOwnProperty(a.severity)) {
        result[a.severity as keyof typeof result]++;
      }
    });
    
    const total = assessments.length || 1;
    return {
      minimal: (result.minimal / total) * 100,
      mild: (result.mild / total) * 100,
      moderate: (result.moderate / total) * 100,
      severe: (result.severe / total) * 100
    };
  }
  
  private calculateGAD7Trend(assessments: GAD7Assessment[]): 'improving' | 'stable' | 'declining' {
    if (assessments.length < 2) return 'stable';
    
    // CORREÇÃO: Usando new Date() para garantir que .getTime() exista
    const sorted = [...assessments].sort((a, b) => 
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );
    
    const first = sorted[0].totalScore;
    const last = sorted[sorted.length - 1].totalScore;
    const change = first - last; // Em GAD7, reduzir a pontuação é "improving"
    
    if (Math.abs(change) < 2) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }
  
  private calculateStudentTrends(snapshots: WeeklySnapshot[]): Record<string, number> {
    if (snapshots.length < 2) return {};
    
    const sorted = [...snapshots].sort((a, b) => 
      a.weekNumber - b.weekNumber
    );
    
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    return {
      completionRateChange: last.metrics.completionRate - first.metrics.completionRate,
      consistencyChange: last.metrics.consistencyScore - first.metrics.consistencyScore,
      pointsChange: last.metrics.totalPointsEarned - first.metrics.totalPointsEarned,
      streakChange: last.metrics.streakAtEndOfWeek - first.metrics.streakAtEndOfWeek
    };
  }
  
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }
  
  private median(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  private getUniqueStudentCount(snapshots: WeeklySnapshot[]): number {
    return new Set(snapshots.map(s => s.studentId)).size || 1;
  }
}