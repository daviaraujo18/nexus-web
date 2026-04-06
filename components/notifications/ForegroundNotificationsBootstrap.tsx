'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  NotificationService,
  type NormalizedNotification,
} from '@/lib/services/NotificationService';

type ToastItem = {
  id: string;
  title: string;
  body: string;
  route: string;
};

export default function ForegroundNotificationsBootstrap() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const initializedRef = useRef(false);

  const clearToastTimer = (id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  };

  const removeToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    clearToastTimer(id);
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      unsubscribe = await NotificationService.setupForegroundNotifications(
        (notification: NormalizedNotification) => {
          console.log('📩 Foreground notification recebida no bootstrap:', notification);

          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const toast: ToastItem = {
            id,
            title: notification.title,
            body: notification.body,
            route: notification.url || '/student/notifications',
          };

          setToasts((current) => {
            const next = [toast, ...current];

            if (next.length > 4) {
              const removed = next.slice(4);
              removed.forEach((item) => clearToastTimer(item.id));
            }

            return next.slice(0, 4);
          });

          const timer = setTimeout(() => {
            removeToast(id);
          }, 10000);

          timersRef.current.set(id, timer);
        },
      );
    };

    void setup();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }

      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
      initializedRef.current = false;
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: '12px',
        right: '12px',
        zIndex: 2147483647,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '420px',
        maxWidth: 'calc(100vw - 24px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: '#dc2626',
            color: '#ffffff',
            border: '4px solid #000000',
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            padding: '20px',
            pointerEvents: 'auto',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800 }}>
                {toast.title}
              </div>

              <div style={{ marginTop: '10px', fontSize: '15px', lineHeight: 1.4 }}>
                {toast.body}
              </div>

              <button
                type="button"
                onClick={() => {
                  window.focus();
                  router.push(toast.route || '/student/notifications');
                  removeToast(toast.id);
                }}
                style={{
                  marginTop: '14px',
                  background: '#ffffff',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Abrir
              </button>
            </div>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '22px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}