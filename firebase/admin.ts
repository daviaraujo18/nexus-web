// firebase/admin.ts — Firebase Admin SDK (server-side only)
// Nunca importar este arquivo em código cliente ou em componentes React.

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let _adminApp: App | null = null;
let _adminFirestore: Firestore | null = null;

function tryGetAdminApp(): App | null {
  if (_adminApp) return _adminApp;
  if (getApps().length > 0) {
    _adminApp = getApps()[0];
    return _adminApp;
  }

  // Suporta tanto variáveis admin (FIREBASE_*) quanto a variável pública de projeto
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      '[firebase/admin] Credenciais do Admin SDK ausentes. ' +
      'Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env.local. ' +
      'Operações que dependem do Admin SDK serão no-op.'
    );
    return null;
  }

  try {
    _adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
    _adminFirestore = getFirestore(_adminApp);
    return _adminApp;
  } catch (err) {
    console.error('[firebase/admin] Falha ao inicializar Admin SDK:', err);
    return null;
  }
}

export function getAdminFirestore(): Firestore | null {
  if (_adminFirestore) return _adminFirestore;
  const app = tryGetAdminApp();
  if (!app) return null;
  _adminFirestore = getFirestore(app);
  return _adminFirestore;
}

// Inicializa eagerly para detectar problemas de config na startup
tryGetAdminApp();
