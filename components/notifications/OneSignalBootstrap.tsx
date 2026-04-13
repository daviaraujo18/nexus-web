'use client';

import { useEffect, useRef } from 'react';
import { NotificationService } from '@/lib/services/NotificationService';

export default function OneSignalBootstrap() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    void NotificationService.initializeProvider();
  }, []);

  return null;
}