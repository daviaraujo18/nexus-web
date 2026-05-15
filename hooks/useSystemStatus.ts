// hooks/useSystemStatus.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { WeeklyResetService } from '@/lib/services/WeeklyResetService';

export function useSystemStatus() {
  const [status, setStatus] = useState<{
    lastReset: Date | null;
    nextReset: Date;
    instancesPendingReset: number;
    systemStatus: 'healthy' | 'warning' | 'error';
    loading: boolean;
    error: string | null;
  }>({
    lastReset: null,
    nextReset: new Date(),
    instancesPendingReset: 0,
    systemStatus: 'healthy',
    loading: true,
    error: null
  });

  const loadStatus = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true }));
      const systemStatus = await WeeklyResetService.getResetStatus();
      
      setStatus({
        ...systemStatus,
        loading: false,
        error: null
      });
    } catch (err: any) {
      console.error('Erro ao carregar status do sistema:', err);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: err.message,
        systemStatus: 'error'
      }));
    }
  }, []);

  const forceReset = useCallback(async () => {
    try {
      // Em produção, chamaria uma API route protegida
      console.log('Reset forçado solicitado');
      // await fetch('/api/system/force-reset', { method: 'POST' });
      await loadStatus(); // Recarregar status
      return true;
    } catch (err: any) {
      console.error('Erro no reset forçado:', err);
      throw err;
    }
  }, [loadStatus]);

  useEffect(() => {
    loadStatus();
    
    // Atualizar a cada hora
    const interval = setInterval(loadStatus, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  return {
    ...status,
    refresh: loadStatus,
    forceReset,
    isHealthy: status.systemStatus === 'healthy',
    needsAttention: status.systemStatus === 'warning' || status.systemStatus === 'error'
  };
}