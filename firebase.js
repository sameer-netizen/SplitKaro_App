// ============================================================
//  STEP: Replace the placeholder values below with your
//  Firebase project credentials before running the app.
//
//  How to get these values:
//  1. Go to https://console.firebase.google.com/
//  2. Create a new project (free Spark plan is enough)
//  3. Add a Web App to the project
//  4. Copy the firebaseConfig object shown to you
//  5. Paste the values into the constants below
//  6. In Firebase console → Authentication → Sign-in method
//     → Enable "Email/Password"
//  7. In Firebase console → Firestore Database → Create database
//     (choose "Start in test mode" to begin, then update rules)
// ============================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from '@firebase/auth/dist/rn';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── FIREBASE CONFIG ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyA3eV2o-dPBNa1sZFS4r-EcmKRoAQjxVxo',
  authDomain:        'splitkaro-b7bc3.firebaseapp.com',
  projectId:         'splitkaro-b7bc3',
  storageBucket:     'splitkaro-b7bc3.firebasestorage.app',
  messagingSenderId: '631577900421',
  appId:             '1:631577900421:web:afef427216fb51857600ec',
};
// ─────────────────────────────────────────────────────────────

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth with local persistence (survives app restarts)
const AUTH_SINGLETON_KEY = '__splitkaro_auth_instance__';

if (!globalThis[AUTH_SINGLETON_KEY]) {
  globalThis[AUTH_SINGLETON_KEY] = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export const auth = globalThis[AUTH_SINGLETON_KEY];

// Firestore database
export const db = getFirestore(app);
