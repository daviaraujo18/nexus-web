'use client';

import { useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalBootstrap() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

    if (!appId) {
      console.warn('[OneSignal] APP ID não configurado');
      return;
    }

    initializedRef.current = true;

    OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: { enable: false },
    })
      .then(() => {
        console.log('[OneSignal] inicializado');
      })
      .catch((error) => {
        console.error('[OneSignal] erro:', error);
      });
  }, []);

  return null;
}