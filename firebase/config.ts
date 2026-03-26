import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported, Messaging } from 'firebase/messaging';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Inicializar Firebase App
const app = initializeApp(firebaseConfig);

// Serviços principais
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);

// Firebase Messaging (FCM) - Inicialização condicional
let messaging: Messaging | null = null;

if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        try {
          messaging = getMessaging(app);
          console.log('✅ Firebase Messaging inicializado');
        } catch (error) {
          console.error('❌ Erro ao inicializar Firebase Messaging:', error);
        }
      } else {
        console.warn('⚠️ Este navegador não suporta Firebase Messaging');
      }
    })
    .catch((error) => {
      console.error('❌ Erro ao verificar suporte do Firebase Messaging:', error);
    });
}

// Firebase Functions
const functions = getFunctions(app, 'southamerica-east1');

// Em desenvolvimento, conectar aos emuladores
if (process.env.NODE_ENV === 'development') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    console.log('🔧 Firebase Auth conectado ao emulador');
  } catch (error) {
    console.warn('⚠️ Não foi possível conectar Auth ao emulador:', error);
  }

  try {
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    console.log('🔧 Firestore conectado ao emulador');
  } catch (error) {
    console.warn('⚠️ Não foi possível conectar Firestore ao emulador:', error);
  }

  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.log('🔧 Firebase Functions conectado ao emulador');
  } catch (error) {
    console.warn('⚠️ Não foi possível conectar Functions ao emulador:', error);
  }
}

export { messaging, functions };
export default app;