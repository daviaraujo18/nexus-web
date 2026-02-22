// hooks/useExport.ts
import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ComparativeAnalysis, StudentAnalyticsSummary, ReportConfig } from '@/types/analytics';
import { ExportService } from '@/lib/services/ExportService';

export function useExport() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string>();
  const [lastExport, setLastExport] = useState<{
    url: string;
    format: string;
    timestamp: Date;
  }>();

  const exportService = new ExportService();

  const exportToPDF = useCallback(async (
    data: ComparativeAnalysis | StudentAnalyticsSummary,
    config: ReportConfig
  ) => {
    if (!user?.id) return;

    setExporting(true);
    setExportError(undefined);
    setExportProgress(10);

    try {
      // Simular progresso
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const report = await exportService.exportToPDF(data, config, user.id);
      
      clearInterval(progressInterval);
      setExportProgress(100);
      
      setLastExport({
        url: report.downloadUrl || '#',
        format: 'PDF',
        timestamp: new Date()
      });

      return report;
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      setExportError(error instanceof Error ? error.message : 'Erro ao exportar PDF');
      throw error;
    } finally {
      setExporting(false);
      setTimeout(() => setExportProgress(0), 2000);
    }
  }, [user?.id]);

  const exportToCSV = useCallback(async (data: ComparativeAnalysis) => {
    if (!user?.id) return;

    setExporting(true);
    setExportError(undefined);

    try {
      const csvUrl = await exportService.exportToCSV(data, user.id);
      
      setLastExport({
        url: csvUrl,
        format: 'CSV',
        timestamp: new Date()
      });

      return csvUrl;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      setExportError(error instanceof Error ? error.message : 'Erro ao exportar CSV');
      throw error;
    } finally {
      setExporting(false);
    }
  }, [user?.id]);

  const generateStudentReport = useCallback(async (
    studentSummary: StudentAnalyticsSummary
  ) => {
    if (!user?.id) return;

    setExporting(true);
    setExportError(undefined);

    try {
      const report = await exportService.generateStudentReportCard(studentSummary, user.id);
      
      setLastExport({
        url: report.downloadUrl || '#',
        format: 'PDF - Relatório Individual',
        timestamp: new Date()
      });

      return report;
    } catch (error) {
      console.error('Error generating student report:', error);
      setExportError(error instanceof Error ? error.message : 'Erro ao gerar relatório do aluno');
      throw error;
    } finally {
      setExporting(false);
    }
  }, [user?.id]);

  const downloadFile = useCallback((url: string, filename: string) => {
    // Se for data URL (CSV)
    if (url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Se for URL real, abrir em nova aba
      window.open(url, '_blank');
    }
  }, []);

  return {
    exporting,
    exportProgress,
    exportError,
    lastExport,
    exportToPDF,
    exportToCSV,
    generateStudentReport,
    downloadFile
  };
}