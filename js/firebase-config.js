import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAvYJSaGLSqInY41ZD5GkCqnI2gh2OZYQ0",
  authDomain: "mediacap-1.firebaseapp.com",
  projectId: "mediacap-1",
  storageBucket: "mediacap-1.firebasestorage.app",
  messagingSenderId: "732036687295",
  appId: "1:732036687295:web:10c0388534e3cdc964ad0a",
  measurementId: "G-WQXS5H8VR3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
