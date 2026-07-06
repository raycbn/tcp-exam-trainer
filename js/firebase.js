// =========================
// FIREBASE CONFIG
// =========================

import { initializeApp } 
from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import { getAuth } 
from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";


// =========================
// CONFIGURACIÓN FIREBASE
// =========================

const firebaseConfig = {

    apiKey: "AIzaSyDZ0FULdloHS1OKe0X7SM4THnQmQF1ztBQ",
    authDomain: "eliteaircrewtrainer.firebaseapp.com",
    projectId: "eliteaircrewtrainer",
    storageBucket: "eliteaircrewtrainer.firebasestorage.app",
    messagingSenderId: "130225639745",
    appId: "1:130225639745:web:bd0fa6e1b195bc9a2f11c0"

};


// =========================
// INIT
// =========================

const app = initializeApp(firebaseConfig);


// =========================
// EXPORTS
// =========================

export const auth = getAuth(app);
export const db = getFirestore(app);
