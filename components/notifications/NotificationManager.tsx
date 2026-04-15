'use client';

import { useState } from 'react';
import { NotificationService } from '@/lib/services/NotificationService';
import { useAuth } from '@/context/AuthContext';

export default function NotificationManager() {
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState('');
  const { user } = useAuth();

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
    console.log('[TEST CLICK] Botão Testar clicado');
    setDebug('clicou no botão testar');
    if (!user?.id) {
      setDebug('❌ Usuário não logado');
      return;
    }

    setLoading(true);
    setDebug('Enviando notificação real...');

    try {
      const result = await NotificationService.sendTypedNotification({
        userId: user.id,
        title: 'Teste Real OneSignal',
        body: `Notificação de teste enviada em ${new Date().toLocaleTimeString()}`,
        type: 'message',
        route: '/student/notifications',
      });

      setDebug(
        result.success
          ? `✅ Enviado! (sent: ${result.sent}, failed: ${result.failed})`
          : `❌ Falha: ${result.reason || 'desconhecida'}`
      );
    } catch (error) {
      console.error('[NotificationManager] teste falhou:', error);
      setDebug('❌ Erro ao enviar notificação');
    } finally {
      setLoading(false);
    }
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