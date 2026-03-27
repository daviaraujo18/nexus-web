'use client';

import { useEffect } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { initMessaging } from '@/firebase/config';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const start = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const existing = await navigator.serviceWorker.getRegistration(
            '/firebase-messaging-sw.js'
          );

          if (!existing) {
            const registration = await navigator.serviceWorker.register(
              '/firebase-messaging-sw.js',
              {
                scope: '/',
                updateViaCache: 'none',
              }
            );

            console.log('✅ Service Worker registrado:', registration.scope);
          } else {
            console.log('✅ Service Worker já registrado:', existing.scope);
          }

          await navigator.serviceWorker.ready;
        }

        await initMessaging();
      } catch (error) {
        console.error('❌ Erro ao inicializar app notifications:', error);
      }
    };

    start();
  }, []);

  return (
    <html lang="pt-BR" className={inter.className}>
      <head>
        <title>Nexus Platform</title>
        <meta name="theme-color" content="#6366f1" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}