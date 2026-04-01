'use client';

import { useState, useEffect } from 'react';
import { NotificationService } from '@/lib/services/NotificationService';

type DebugInfo = {
  browser?: {
    userAgent: string;
    platform: string;
    vendor: string;
    isMobile: boolean;
  };
  notifications?: {
    supported: boolean;
    permission: NotificationPermission;
    serviceWorker: boolean;
  };
  serviceWorker?: {
    supported: boolean;
    registeredCount: number;
    active: boolean;
    registrations: Array<{
      scope: string;
      active: boolean;
      state?: string;
    }>;
  };
  localStorage?: {
    notificationPermission: string | null;
    permissionDate: string | null;
  };
  swPingSent?: boolean;
  error?: string;
};

export default function DebugNotificationsPage() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    const info: DebugInfo = {};

    try {
      info.browser = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
        isMobile: /Mobi|Android/i.test(navigator.userAgent),
      };

      const supportStatus = await NotificationService.getSupportStatus();
      info.notifications = supportStatus;

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();

        info.serviceWorker = {
          supported: true,
          registeredCount: registrations.length,
          active: registrations.some((reg) => !!reg.active),
          registrations: registrations.map((reg) => ({
            scope: reg.scope,
            active: !!reg.active,
            state: reg.active?.state,
          })),
        };

        if (registrations[0]?.active) {
          registrations[0].active.postMessage({ type: 'PING', test: true });
          info.swPingSent = true;
        }
      } else {
        info.serviceWorker = {
          supported: false,
          registeredCount: 0,
          active: false,
          registrations: [],
        };
      }

      info.localStorage = {
        notificationPermission: localStorage.getItem('notification_permission_granted'),
        permissionDate: localStorage.getItem('notification_permission_date'),
      };
    } catch (error: unknown) {
      info.error = error instanceof Error ? error.message : 'Erro desconhecido';
    }

    setDebugInfo(info);
    setLoading(false);
  };

  const fixServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();

      for (const registration of registrations) {
        await registration.unregister();
      }

      window.location.reload();
    }
  };

  useEffect(() => {
    void runDebug();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug de Notificações</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={runDebug}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {loading ? 'Testando...' : 'Executar Testes'}
        </button>

        <button
          onClick={fixServiceWorker}
          className="px-4 py-2 bg-red-600 text-white rounded-lg"
        >
          🔧 Resetar Service Worker
        </button>
      </div>

      <div className="space-y-6">
        {debugInfo.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <h3 className="font-bold text-red-800">Erro:</h3>
            <p className="text-red-700">{debugInfo.error}</p>
          </div>
        )}

        {debugInfo.serviceWorker && (
          <div
            className={`p-4 border rounded ${
              debugInfo.serviceWorker.active
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <h3 className="font-bold mb-2">Service Worker:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(debugInfo.serviceWorker, null, 2)}
            </pre>
          </div>
        )}

        {debugInfo.notifications && (
          <div className="p-4 border border-gray-200 rounded">
            <h3 className="font-bold mb-2">Notificações:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(debugInfo.notifications, null, 2)}
            </pre>
          </div>
        )}

        {debugInfo.browser && (
          <div className="p-4 border border-gray-200 rounded">
            <h3 className="font-bold mb-2">Navegador:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(debugInfo.browser, null, 2)}
            </pre>
          </div>
        )}

        {debugInfo.localStorage && (
          <div className="p-4 border border-gray-200 rounded">
            <h3 className="font-bold mb-2">LocalStorage:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(debugInfo.localStorage, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}