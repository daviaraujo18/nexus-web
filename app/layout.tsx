'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import OneSignalBootstrap from '@/components/notifications/OneSignalBootstrap';
import OneSignalUserSync from '@/components/notifications/OneSignalUserSync';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <head>
        <title>Nexus Platform</title>
        <meta name="theme-color" content="#6366f1" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <AuthProvider>
          <OneSignalBootstrap />
          <OneSignalUserSync />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}