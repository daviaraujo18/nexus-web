import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  authDomain: 'nexus-test.firebaseapp.com',
  projectId: 'nexus-test',
  storageBucket: 'nexus-test.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:000000000000',
  measurementId: 'G-0000000000',
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

connectFirestoreEmulator(firestore, 'localhost', 8080);

export { firestore };
export const auth = {} as any;
export const storage = {} as any;
export const messaging = null;
export const functions = {} as any;
export default app;
