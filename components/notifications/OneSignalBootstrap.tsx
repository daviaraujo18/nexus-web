'use client';

import { useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalBootstrap() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    const appId = process.env.NEXT_SIGNAL_ONESIGNAL_APP_ID;

    if (!appId) {
      console.warn('[OneSignal] NEXT_PUBLIC_ONESIGNAL_APP_ID não configurado');
      return;
    }

    initializedRef.current = true;

    void OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: '/OneSignalSDKWorker.js',
      notifyButton: {
        enable: false,
      },
    })
      .then(() => {
        console.log('[OneSignal] inicializado com sucesso');
      })
      .catch((error) => {
        console.error('[OneSignal] erro ao inicializar:', error);
      });
  }, []);

  return null;
}