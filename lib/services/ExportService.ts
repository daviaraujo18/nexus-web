// services/ExportService.ts
import { ComparativeAnalysis, StudentAnalyticsSummary, ReportConfig, ExportedReport } from '@/types/analytics';
import { firestore } from '@/firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export class ExportService {

  async exportToPDF(
    data: ComparativeAnalysis | StudentAnalyticsSummary,
    config: ReportConfig,
    professionalId: string
  ): Promise<ExportedReport> {
    try {
      // Aqui você implementaria a geração real de PDF
      // Usando bibliotecas como jsPDF, react-pdf, etc.

      // Garantir que o data está no formato correto para o tipo de relatório
      let reportData: ComparativeAnalysis;

      if ('period' in data && 'summary' in data) {
        // Já é ComparativeAnalysis
        reportData = data as ComparativeAnalysis;
      } else {
        // É StudentAnalyticsSummary - precisamos converter para o formato esperado
        // Isso é um mock - você deve implementar a conversão real
        reportData = {
          period: config.dateRange,
          summary: {
            totalStudents: 1,
            activeStudents: data.weeklyHistory.some(w => w.activitiesCompleted > 0) ? 1 : 0,
            studentsWithGAD7: data.weeklyHistory.some(w => w.gad7) ? 1 : 0,
            metrics: {
              averageCompletionRate: data.currentMetrics.completionRate,
              averageConsistencyScore: data.currentMetrics.consistencyScore,
              averageAdherenceScore: data.currentMetrics.adherenceScore,
              averageTimePerActivity: data.weeklyHistory.reduce((sum, w) => sum + w.timeSpent, 0) / data.weeklyHistory.length || 0,
              totalActivitiesCompleted: data.weeklyHistory.reduce((sum, w) => sum + w.activitiesCompleted, 0),
              totalTimeSpent: data.weeklyHistory.reduce((sum, w) => sum + w.timeSpent, 0),
              totalPointsEarned: data.currentMetrics.totalPoints,
              averagePointsPerStudent: data.currentMetrics.totalPoints,
              pointsDistribution: {
                min: data.currentMetrics.totalPoints,
                max: data.currentMetrics.totalPoints,
                median: data.currentMetrics.totalPoints,
                average: data.currentMetrics.totalPoints
              },
              averageGAD7Score: data.currentMetrics.gad7Score || 0,
              gad7Distribution: {
                minimal: data.currentMetrics.gad7Severity === 'minimal' ? 100 : 0,
                mild: data.currentMetrics.gad7Severity === 'mild' ? 100 : 0,
                moderate: data.currentMetrics.gad7Severity === 'moderate' ? 100 : 0,
                severe: data.currentMetrics.gad7Severity === 'severe' ? 100 : 0
              },
              studentsWithGAD7: data.currentMetrics.gad7Score ? 100 : 0,
              gad7Trend: data.trends.gad7Score,
              averageStreak: data.currentMetrics.streak,
              maxStreak: data.currentMetrics.streak,
              studentsWithActiveStreak: data.currentMetrics.streak > 0 ? 1 : 0
            }
          },
          studentRankings: {
            byEngagement: [{
              studentId: data.studentId,
              studentName: data.studentName,
              studentGrade: data.studentGrade,
              studentTotalPoints: data.studentTotalPoints,
              studentSchool: data.studentSchool,
              value: data.currentMetrics.completionRate,
              trend: data.trends.completionRate,
              percentile: 50,
              isAtRisk: data.riskLevel === 'high' || data.riskLevel === 'critical'
            }],
            byPoints: [{
              studentId: data.studentId,
              studentName: data.studentName,
              studentGrade: data.studentGrade,
              studentTotalPoints: data.studentTotalPoints,
              studentSchool: data.studentSchool,
              value: data.currentMetrics.completionRate,
              trend: data.trends.completionRate,
              percentile: 50,
              isAtRisk: data.riskLevel === 'high' || data.riskLevel === 'critical'
            }],
            byImprovement: [],
            byGAD7Improvement: [],
            atRisk: data.riskLevel === 'high' || data.riskLevel === 'critical' ? [{
              studentId: data.studentId,
              studentName: data.studentName,
              studentGrade: data.studentGrade,
              studentSchool: data.studentSchool,
              studentTotalPoints: data.studentTotalPoints,
              value: data.currentMetrics.completionRate,
              trend: 'declining',
              percentile: 0,
              isAtRisk: true
            }] : []
          },
          classInsights: data.insights,
          distributions: {
            completionRate: { bins: [], counts: [], average: data.currentMetrics.completionRate, median: data.currentMetrics.completionRate, stdDev: 0 },
            gad7Score: { bins: [], counts: [], average: data.currentMetrics.gad7Score || 0, median: data.currentMetrics.gad7Score || 0, stdDev: 0 },
            consistencyScore: { bins: [], counts: [], average: data.currentMetrics.consistencyScore, median: data.currentMetrics.consistencyScore, stdDev: 0 }
          },
          classHeatmap: {}
        };
      }

      const report: ExportedReport = {
        id: `report-${Date.now()}`,
        generatedAt: new Date(),
        generatedBy: professionalId,
        config,
        data: reportData,
        downloadUrl: `#`, // URL gerada após upload
        fileSize: 1024 * 1024, // Mock: 1MB
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
      };

      // Salvar metadados no Firestore
      await this.saveReportMetadata(report);

      return report;
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw error;
    }
  }

  async exportToCSV(
    data: ComparativeAnalysis,
    professionalId: string
  ): Promise<string> {
    try {
      // Gerar CSV com dados dos alunos
      const headers = [
        'Aluno',
        'Turma',
        'Taxa de Conclusão (%)',
        'Consistência (%)',
        'Pontos',
        'Streak',
        'GAD-7',
        'Severidade',
        'Tendência'
      ];

      const rows = data.studentRankings.byEngagement.map(student => {
        return [
          student.studentName,
          student.studentGrade,
          student.value.toFixed(1),
          '0', // consistencyScore não está disponível no ranking
          '0', // totalPoints não está disponível
          '0', // streak não está disponível
          '-',
          '-',
          student.trend
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Aqui você faria upload para storage e retornaria URL
      return `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  }

  async generateStudentReportCard(
    studentSummary: StudentAnalyticsSummary,
    professionalId: string
  ): Promise<ExportedReport> {
    // Gerar relatório individual formatado para pais/profissionais
    const config: ReportConfig = {
      title: `Relatório de Progresso - ${studentSummary.studentName}`,
      description: `Período: ${studentSummary.weeklyHistory[0]?.weekStartDate.toLocaleDateString()} - ${studentSummary.weeklyHistory[studentSummary.weeklyHistory.length - 1]?.weekEndDate.toLocaleDateString()}`,
      dateRange: {
        startDate: studentSummary.weeklyHistory[studentSummary.weeklyHistory.length - 1]?.weekStartDate || new Date(),
        endDate: studentSummary.weeklyHistory[0]?.weekEndDate || new Date(),
        label: 'Período analisado'
      },
      includeStudents: 'selected',
      studentIds: [studentSummary.studentId],
      sections: {
        summary: true,
        rankings: false,
        trends: true,
        gad7: true,
        correlations: false,
        individualReports: true
      },
      format: 'pdf',
      includeCharts: true
    };

    return this.exportToPDF(studentSummary, config, professionalId);
  }

  async generateClassReport(
    comparativeData: ComparativeAnalysis,
    professionalId: string
  ): Promise<ExportedReport> {
    const config: ReportConfig = {
      title: 'Relatório da Turma',
      description: `Análise comparativa do período`,
      dateRange: comparativeData.period,
      includeStudents: 'all',
      sections: {
        summary: true,
        rankings: true,
        trends: true,
        gad7: true,
        correlations: true,
        individualReports: false
      },
      format: 'pdf',
      includeCharts: true
    };

    return this.exportToPDF(comparativeData, config, professionalId);
  }

  private async saveReportMetadata(report: ExportedReport): Promise<void> {
    try {
      const reportsRef = collection(firestore, 'exportedReports');
      await addDoc(reportsRef, {
        ...report,
        generatedAt: Timestamp.fromDate(report.generatedAt),
        expiresAt: report.expiresAt ? Timestamp.fromDate(report.expiresAt) : null,
        data: JSON.stringify(report.data) // Serializar dados grandes
      });
    } catch (error) {
      console.error('Error saving report metadata:', error);
      // Não falhar a exportação por causa do metadata
    }
  }

  formatDateRange(dateRange: { startDate: Date; endDate: Date }): string {
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    };

    return `${dateRange.startDate.toLocaleDateString('pt-BR', options)} - ${dateRange.endDate.toLocaleDateString('pt-BR', options)}`;
  }

  formatNumber(value: number, decimals: number = 1): string {
    return value.toFixed(decimals).replace('.', ',');
  }

  formatPercentage(value: number): string {
    return `${this.formatNumber(value)}%`;
  }

  getSeverityColor(severity: string): string {
    const colors = {
      minimal: '#10b981', // verde
      mild: '#f59e0b',    // amarelo
      moderate: '#f97316', // laranja
      severe: '#ef4444'    // vermelho
    };
    return colors[severity as keyof typeof colors] || '#6b7280';
  }

  getTrendIcon(trend: string): string {
    const icons = {
      improving: '↑',
      stable: '→',
      declining: '↓',
      insufficient_data: '?'
    };
    return icons[trend as keyof typeof icons] || '';
  }
}