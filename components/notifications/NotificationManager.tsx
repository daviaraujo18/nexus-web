'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { NotificationService } from '@/lib/services/NotificationService';

export default function NotificationManager() {
  const { user } = useAuth();

  const [notificationStatus, setNotificationStatus] = useState<any>(null);
  const [fcmStatus, setFcmStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string>('');

  useEffect(() => {
    if (!user?.id) return;

    void checkNotificationStatus();
    void checkFCMStatus();
  }, [user?.id]);

  const checkNotificationStatus = async () => {
    const status = await NotificationService.getSupportStatus();
    setNotificationStatus(status);
  };

  const checkFCMStatus = async () => {
    const status = await NotificationService.checkFCMAvailability();
    setFcmStatus(status);
  };

  const requestPermission = async () => {
    setIsLoading(true);
    setDebugMessage('');

    try {
      const permission = await NotificationService.requestNotificationPermission();

      if (permission !== 'granted') {
        setDebugMessage(`⚠️ Permissão atual: ${permission}`);
        return;
      }

      if (!user?.id) {
        setDebugMessage('❌ Usuário não encontrado no contexto.');
        return;
      }

      const token = await NotificationService.getFCMToken();

      if (token) {
        await NotificationService.saveFCMToken(token);
        setDebugMessage(`✅ Token ativo/sincronizado: ${token.slice(0, 24)}...`);
      } else {
        setDebugMessage('⚠️ Permissão concedida, mas não foi possível obter/sincronizar o token.');
      }

      await checkFCMStatus();
    } catch (err: any) {
      console.error(err);
      setDebugMessage(`❌ Erro ao ativar notificações: ${err?.message ?? 'erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testNotification = async () => {
    try {
      setIsLoading(true);
      setDebugMessage('');

      const userId = user?.id;

      if (!userId) {
        setDebugMessage('❌ Usuário não encontrado no contexto.');
        return;
      }

      console.log('🧪 TESTE REAL →', userId);

      const currentToken = await NotificationService.getCurrentFCMToken();
      let tokenToUse = currentToken;

      if (!tokenToUse) {
        tokenToUse = await NotificationService.getFCMToken();

        if (tokenToUse) {
          await NotificationService.saveFCMToken(tokenToUse);
        }
      } else {
        await NotificationService.saveFCMToken(tokenToUse);
      }

      if (!tokenToUse) {
        setDebugMessage('❌ Não foi possível obter um token FCM válido.');
        return;
      }

      const result = await NotificationService.sendFCMPushNotification(
        userId,
        '🔥 TESTE REAL',
        'Se você ver isso, acabou a guerra',
        {
          test: true,
          source: 'NotificationManager',
          at: new Date().toISOString(),
        }
      );

      if (result.success && result.sent > 0 && result.failed === 0) {
        setDebugMessage(`✅ Push enviado com sucesso. sent=${result.sent}, failed=${result.failed}`);
      } else {
        const failureText =
          result.failures && result.failures.length > 0
            ? result.failures
                .map(
                  (f: any, index: number) =>
                    `[${index + 1}] code=${f?.errorCode ?? 'unknown'} | message=${f?.errorMessage ?? 'sem mensagem'}`
                )
                .join(' | ')
            : 'sem detalhes retornados pela function';

        setDebugMessage(
          `⚠️ Push processado. sent=${result.sent}, failed=${result.failed}. Detalhes: ${failureText}`
        );
      }

      await checkFCMStatus();
    } catch (error: any) {
      console.error(error);
      setDebugMessage(`❌ Erro no teste: ${error?.message ?? 'erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetToken = async () => {
    try {
      setIsLoading(true);
      setDebugMessage('');

      if (!user?.id) {
        setDebugMessage('❌ Usuário não encontrado no contexto.');
        return;
      }

      const newToken = await NotificationService.resetFCMToken(user.id);

      if (newToken) {
        setDebugMessage(`✅ Token resetado com sucesso: ${newToken.slice(0, 24)}...`);
      } else {
        setDebugMessage('⚠️ Não foi possível resetar o token.');
      }

      await checkFCMStatus();
    } catch (error: any) {
      console.error(error);
      setDebugMessage(`❌ Erro ao resetar token: ${error?.message ?? 'erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || !notificationStatus) return null;

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex justify-between items-center gap-3">
        <div>
          <p className="font-medium">
            Notificações: {notificationStatus.permission}
          </p>

          {fcmStatus && (
            <p className="text-xs text-gray-500">
              {fcmStatus.tokenExists ? '✓ FCM ativo' : '⚠️ Sem token'}
            </p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={requestPermission}
            disabled={isLoading}
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-60"
          >
            Ativar
          </button>

          <button
            onClick={testNotification}
            disabled={isLoading}
            className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-60"
          >
            Testar
          </button>

          <button
            onClick={resetToken}
            disabled={isLoading}
            className="px-3 py-1 bg-amber-600 text-white rounded disabled:opacity-60"
          >
            Resetar token
          </button>
        </div>
      </div>

      {debugMessage ? (
        <div className="mt-3 rounded bg-slate-50 border p-3 text-sm text-slate-700 break-words">
          {debugMessage}
        </div>
      ) : null}
    </div>
  );
}