import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";
import { getDatabase, ref, set, get, child, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBssQXl-UmZT9ag3l8wEtT9vVGyG8WHemQ",
  authDomain: "girigo-506a6.firebaseapp.com",
  databaseURL: "https://girigo-506a6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "girigo-506a6",
  storageBucket: "girigo-506a6.firebasestorage.app",
  messagingSenderId: "845919669259",
  appId: "1:845919669259:web:f2029821a11606a9370b0e",
  measurementId: "G-R4GCQH8DRN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

export { db, ref, set, get, child, serverTimestamp };
