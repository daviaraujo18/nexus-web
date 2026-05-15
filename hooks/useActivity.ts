// hooks/useActivity.ts
'use client';

import { useState, useCallback, useRef } from 'react';
import { ActivityProgress, ProgressStatus } from '@/types/schedule';
import { ProgressService } from '@/lib/services/ProgressService';

export function useActivity(progress: ActivityProgress) {
  const [currentProgress, setCurrentProgress] = useState<ActivityProgress>(progress);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startingRef = useRef(false);

  const updateProgress = useCallback((updates: Partial<ActivityProgress>) => {
    setCurrentProgress(prev => ({ ...prev, ...updates }));
  }, []);

  const startActivity = useCallback(async () => {
    console.log('🔍 Hook startActivity:', {
      currentProgressId: currentProgress.id,
      currentProgressStudentId: currentProgress.studentId,
      hasStudentId: !!currentProgress.studentId
    });

    if (currentProgress.status !== 'pending' || startingRef.current) return;
    startingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      await ProgressService.startActivity(currentProgress.id, currentProgress.studentId);
      updateProgress({ status: 'in_progress' });
      return true;
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar atividade');
      return false;
    } finally {
      setIsLoading(false);
      startingRef.current = false;
    }
  }, [currentProgress.id, currentProgress.studentId, currentProgress.status, updateProgress]);

  const completeActivity = useCallback(async (completionData?: any) => {
    if (currentProgress.status !== 'in_progress') return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await ProgressService.completeActivity(
        currentProgress.id,
        currentProgress.studentId,
        completionData
      );

      setCurrentProgress(prev => ({
        ...prev,
        status: 'completed',
        executionData: { ...prev.executionData, ...completionData }
      }));

      return result;
    } catch (err: any) {
      setError(err.message || 'Erro ao completar atividade');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentProgress.id, currentProgress.studentId, currentProgress.status]);

  const skipActivity = useCallback(async (reason?: string) => {
    if (currentProgress.status !== 'in_progress' && currentProgress.status !== 'pending') return;

    setIsLoading(true);
    setError(null);

    try {
      await ProgressService.skipActivity(currentProgress.id, currentProgress.studentId, reason);
      updateProgress({ status: 'skipped' });
      return true;
    } catch (err: any) {
      setError(err.message || 'Erro ao pular atividade');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentProgress.id, currentProgress.studentId, currentProgress.status, updateProgress]);

  const saveDraft = useCallback(async (draftData: any) => {
    setError(null);
    try {
      await ProgressService.saveDraft(currentProgress.id, currentProgress.studentId, draftData);
      setCurrentProgress(prev => ({
        ...prev,
        executionData: { ...prev.executionData, ...draftData }
      }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar rascunho';
      setError(message);
      return false;
    }
  }, [currentProgress.id, currentProgress.studentId, updateProgress]);

  return {
    progress: currentProgress,
    isLoading,
    error,
    startActivity,
    completeActivity,
    skipActivity,
    saveDraft,
    updateProgress,
    canStart: currentProgress.status === 'pending',
    canComplete: currentProgress.status === 'in_progress',
    canSkip: currentProgress.status === 'pending' || currentProgress.status === 'in_progress'
  };
}