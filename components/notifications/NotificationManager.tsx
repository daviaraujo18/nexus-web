'use client';

import { useState } from 'react';
import { NotificationService } from '@/lib/services/NotificationService';

export default function NotificationManager() {
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState('');

  const requestPermission = async () => {
    setLoading(true);

    try {
      const permission = await NotificationService.requestNotificationPermission();
      setDebug(
        permission === 'granted'
          ? '✅ Permissão concedida'
          : '⚠️ Permissão não concedida'
      );
    } catch (error) {
      console.error('[NotificationManager] requestPermission failed:', error);
      setDebug('❌ Erro ao pedir permissão');
    } finally {
      setLoading(false);
    }
  };

  const testNotification = async () => {
    setDebug('⚠️ Teste deve ser disparado via dashboard OneSignal ou backend');
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex gap-2">
        <button
          onClick={requestPermission}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Carregando...' : 'Ativar'}
        </button>

        <button
          onClick={testNotification}
          disabled={loading}
          className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
        >
          Testar
        </button>
      </div>

      {debug && <div className="mt-3 text-sm">{debug}</div>}
    </div>
  );
}