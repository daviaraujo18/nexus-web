// services/GAD7CorrelationService.ts
import { WeeklySnapshot } from '@/types/schedule';
import { GAD7Assessment, GAD7Severity } from '@/types/GAD7';
import { CorrelationAnalysis } from '@/types/analytics';
import { ActivityType } from '@/types/schedule';

export class GAD7CorrelationService {
  
  analyzeCorrelations(
    snapshots: WeeklySnapshot[],
    assessments: GAD7Assessment[]
  ): CorrelationAnalysis {
    // Mapear snapshots por semana para cada aluno
    const studentWeekData = this.mapStudentWeekData(snapshots, assessments);
    
    // Calcular correlação GAD7 vs Engajamento
    const gad7VsEngagement = this.calculateGAD7EngagementCorrelation(studentWeekData);
    
    // Calcular impacto por tipo de atividade
    const activityTypeImpact = this.calculateActivityTypeImpact(studentWeekData);
    
    // Identificar padrões temporais
    const temporalPatterns = this.identifyTemporalPatterns(studentWeekData);
    
    // Identificar preditores de risco
    const riskPredictors = this.identifyRiskPredictors(studentWeekData);
    
    return {
      gad7VsEngagement,
      activityTypeImpact,
      temporalPatterns,
      riskPredictors
    };
  }
  
  private mapStudentWeekData(
    snapshots: WeeklySnapshot[],
    assessments: GAD7Assessment[]
  ): Array<{
    studentId: string;
    weekNumber: number;
    completionRate: number;
    consistencyScore: number;
    gad7Score?: number;
    gad7Severity?: GAD7Severity;
    activityBreakdown: Record<ActivityType, number>;
  }> {
    const snapshotMap = new Map(
      snapshots.map(s => [`${s.studentId}-${s.weekNumber}`, s])
    );
    
    const assessmentMap = new Map(
      assessments.map(a => [`${a.studentId}-${a.weekNumber}`, a])
    );
    
    const allKeys = new Set([
      ...snapshotMap.keys(),
      ...assessmentMap.keys()
    ]);
    
    return Array.from(allKeys).map(key => {
      const snapshot = snapshotMap.get(key);
      const assessment = assessmentMap.get(key);
      
      // Calcular completion por tipo
      const activityBreakdown: any = {};
      if (snapshot) {
        Object.entries(snapshot.activityTypeBreakdown || {}).forEach(([type, data]) => {
          if (data && data.total > 0) {
            activityBreakdown[type] = (data.completed / data.total) * 100;
          } else {
            activityBreakdown[type] = 0;
          }
        });
      }
      
      return {
        studentId: key.split('-')[0],
        weekNumber: parseInt(key.split('-')[1]),
        completionRate: snapshot?.metrics.completionRate || 0,
        consistencyScore: snapshot?.metrics.consistencyScore || 0,
        gad7Score: assessment?.totalScore,
        gad7Severity: assessment?.severity,
        activityBreakdown
      };
    });
  }
  
  private calculateGAD7EngagementCorrelation(
    data: Array<{
      studentId: string;
      completionRate: number;
      gad7Score?: number;
    }>
  ): CorrelationAnalysis['gad7VsEngagement'] {
    // Filtrar apenas semanas com GAD7
    const validData = data.filter(d => d.gad7Score !== undefined);
    
    if (validData.length < 5) {
      return {
        pearsonCorrelation: 0,
        significance: 'none',
        scatterData: []
      };
    }
    
    // Calcular correlação de Pearson
    const n = validData.length;
    const sumX = validData.reduce((sum, d) => sum + d.gad7Score!, 0);
    const sumY = validData.reduce((sum, d) => sum + d.completionRate, 0);
    const sumXY = validData.reduce((sum, d) => sum + (d.gad7Score! * d.completionRate), 0);
    const sumX2 = validData.reduce((sum, d) => sum + Math.pow(d.gad7Score!, 2), 0);
    const sumY2 = validData.reduce((sum, d) => sum + Math.pow(d.completionRate, 2), 0);
    
    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt(
      ((n * sumX2) - Math.pow(sumX, 2)) * 
      ((n * sumY2) - Math.pow(sumY, 2))
    );
    
    const correlation = denominator === 0 ? 0 : numerator / denominator;
    
    // Determinar significância
    let significance: 'high' | 'medium' | 'low' | 'none' = 'none';
    const absCorr = Math.abs(correlation);
    
    if (absCorr > 0.7) significance = 'high';
    else if (absCorr > 0.5) significance = 'medium';
    else if (absCorr > 0.3) significance = 'low';
    
    return {
      pearsonCorrelation: correlation,
      significance,
      scatterData: validData.map(d => ({
        gad7Score: d.gad7Score!,
        completionRate: d.completionRate,
        studentId: d.studentId
      }))
    };
  }
  
  private calculateActivityTypeImpact(
    data: Array<{
      gad7Score?: number;
      activityBreakdown: Record<ActivityType, number>;
    }>
  ): CorrelationAnalysis['activityTypeImpact'] {
    const activityTypes: ActivityType[] = ['quick', 'text', 'quiz', 'video', 'checklist', 'file', 'app'];
    const result: any = {};
    
    activityTypes.forEach(type => {
      // Filtrar semanas com este tipo de atividade
      const typeWeeks = data.filter(d => 
        d.activityBreakdown[type] !== undefined && 
        d.activityBreakdown[type] > 0 && 
        d.gad7Score !== undefined
      );
      
      if (typeWeeks.length < 3) {
        result[type] = {
          averageGAD7Change: 0,
          sampleSize: 0,
          confidence: 'low'
        };
        return;
      }
      
      // Separar por alto/baixo engajamento neste tipo
      const highEngagement = typeWeeks.filter(d => d.activityBreakdown[type] > 70);
      const lowEngagement = typeWeeks.filter(d => d.activityBreakdown[type] < 30);
      
      const avgGAD7High = this.average(highEngagement.map(d => d.gad7Score!));
      const avgGAD7Low = this.average(lowEngagement.map(d => d.gad7Score!));
      
      const impact = avgGAD7Low - avgGAD7High; // Positivo = melhora com engajamento
      
      // Determinar confiança
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (typeWeeks.length > 20) confidence = 'high';
      else if (typeWeeks.length > 10) confidence = 'medium';
      
      result[type] = {
        averageGAD7Change: impact,
        sampleSize: typeWeeks.length,
        confidence
      };
    });
    
    return result;
  }
  
  private identifyTemporalPatterns(
    data: Array<{
      dayOfWeek?: number;
      timeOfDay?: string;
      gad7Score?: number;
      completionRate: number;
    }>
  ): CorrelationAnalysis['temporalPatterns'] {
    // Agrupar por dia da semana
    const dayData: Record<number, { completion: number[]; gad7: number[] }> = {
      0: { completion: [], gad7: [] },
      1: { completion: [], gad7: [] },
      2: { completion: [], gad7: [] },
      3: { completion: [], gad7: [] },
      4: { completion: [], gad7: [] },
      5: { completion: [], gad7: [] },
      6: { completion: [], gad7: [] }
    };
    
    // Assumindo que temos dados de dia (idealmente viriam do snapshot)
    // Mock para demonstração
    data.forEach((item, index) => {
      const day = index % 7;
      dayData[day].completion.push(item.completionRate);
      if (item.gad7Score) {
        dayData[day].gad7.push(item.gad7Score);
      }
    });
    
    // Calcular médias por dia
    const dayAverages = Object.entries(dayData).map(([day, d]) => ({
      day: parseInt(day),
      avgCompletion: this.average(d.completion),
      avgGAD7: this.average(d.gad7)
    }));
    
    // Encontrar melhor/pior dia
    const bestDay = dayAverages.reduce((best, curr) => 
      curr.avgCompletion > best.avgCompletion ? curr : best
    , dayAverages[0]);
    
    const worstDay = dayAverages.reduce((worst, curr) => 
      curr.avgCompletion < worst.avgCompletion ? curr : worst
    , dayAverages[0]);
    
    const highestAnxietyDay = dayAverages.reduce((highest, curr) => 
      curr.avgGAD7 > highest.avgGAD7 ? curr : highest
    , dayAverages[0]);
    
    const lowestAnxietyDay = dayAverages.reduce((lowest, curr) => 
      curr.avgGAD7 < lowest.avgGAD7 ? curr : lowest
    , dayAverages[0]);
    
    return {
      bestDayForEngagement: bestDay?.day || 0,
      worstDayForEngagement: worstDay?.day || 0,
      highestAnxietyDay: highestAnxietyDay?.day || 0,
      lowestAnxietyDay: lowestAnxietyDay?.day || 0,
      timeOfDayPreference: this.identifyTimePreference(data)
    };
  }
  
  private identifyRiskPredictors(
    data: Array<{
      completionRate: number;
      consistencyScore: number;
      gad7Score?: number;
    }>
  ): CorrelationAnalysis['riskPredictors'] {
    // Identificar limiares de risco baseado nos dados
    return {
      lowConsistency: 40, // Abaixo de 40% de consistência é risco
      highGAD7Increasing: 10, // GAD7 > 10 é preocupante
      missedDaysInRow: 3, // 3 dias seguidos sem atividade
      recentDrop: 30 // Queda de 30% no engajamento
    };
  }
  
  private identifyTimePreference(
    data: Array<{ timeOfDay?: string }>
  ): 'morning' | 'afternoon' | 'evening' | 'night' | undefined {
    // Mock - idealmente viria dos dados reais
    return 'afternoon';
  }
  
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }
}