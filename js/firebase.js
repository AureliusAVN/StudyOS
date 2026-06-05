'use strict';

// Firebase SDK
import { initializeApp }
from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';

import {
  getAuth
}
from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';

// ── Firebase Config ─────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAPSMjj-G3xOm95Pv3eFr7lYbBjiFdbmxI",
  authDomain: "project-lucifer-9fd9a.firebaseapp.com",
  projectId: "project-lucifer-9fd9a",
  storageBucket: "project-lucifer-9fd9a.firebasestorage.app",
  messagingSenderId: "957676092521",
  appId: "1:957676092521:web:19c60d15f24ff60c7ff6f8",
  measurementId: "G-29Z5G1HL0R"
};

// ── Initialize Firebase ─────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ── Export ──────────────────────────────
export { auth };