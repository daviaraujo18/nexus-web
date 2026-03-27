import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  getMessaging,
  isSupported,
  type Messaging,
} from 'firebase/messaging';
import {
  getFunctions,
  connectFunctionsEmulator,
} from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'southamerica-east1');

const USE_FUNCTIONS_EMULATOR =
  process.env.NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR === 'true';

if (USE_FUNCTIONS_EMULATOR) {
  try {
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('🔧 Firebase Functions conectado ao emulador');
  } catch (error) {
    console.warn('⚠️ Functions emulator já conectado ou indisponível:', error);
  }
} else {
  console.log('🚀 Firebase Functions real');
}

let messagingInstance: Messaging | null = null;

export const initMessaging = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;

  try {
    const supported = await isSupported();

    if (!supported) {
      console.warn('⚠️ Firebase Messaging não suportado neste navegador');
      return null;
    }

    messagingInstance = getMessaging(app);
    console.log('✅ Firebase Messaging inicializado');
    return messagingInstance;
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Messaging:', error);
    return null;
  }
};

export const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (messagingInstance) return messagingInstance;
  return initMessaging();
};

export { messagingInstance as messaging };
export default app;