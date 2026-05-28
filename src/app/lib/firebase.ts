import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyABYoS3RziNmP7aI8AK1FCoDT_RDTSnhvI',
  authDomain: 'slave-9474c.firebaseapp.com',
  projectId: 'slave-9474c',
  storageBucket: 'slave-9474c.firebasestorage.app',
  messagingSenderId: '167802811423',
  appId: '1:167802811423:web:56bd1d42a2b40cac1b912a',
  measurementId: 'G-FLQE99DKYG',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
    })
    .catch(() => undefined);
}
