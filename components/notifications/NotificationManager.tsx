'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import OneSignal from 'react-onesignal';

export default function NotificationManager() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState('');

  useEffect(() => {
    if (!user?.id) return;

    OneSignal.login(String(user.id));
  }, [user?.id]);

  const requestPermission = async () => {
    setLoading(true);

    try {
      await OneSignal.Notifications.requestPermission();
      setDebug('✅ Permissão concedida');
    } catch (e) {
      setDebug('❌ Erro ao pedir permissão');
    }

    setLoading(false);
  };

  const testNotification = async () => {
    setDebug(
      '⚠️ Teste deve ser disparado via dashboard OneSignal ou backend'
    );
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex gap-2">
        <button
          onClick={requestPermission}
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          Ativar
        </button>

        <button 
          onClick={testNotification}
          className="px-3 py-1 bg-green-600 text-white rounded"
        >
          Testar
        </button>
      </div>

      {debug && (
        <div className="mt-3 text-sm">
          {debug}
        </div>
      )}
    </div>
  );
}