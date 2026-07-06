import { auth } from "./firebase.js";


import {

    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail

} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";


// =========================
// ELEMENTOS
// =========================

const email =
document.getElementById("email");


const password =
document.getElementById("password");


const loginBtn =
document.getElementById("loginBtn");


const registerBtn =
document.getElementById("registerBtn");


const resetBtn =
document.getElementById("resetBtn");


const message =
document.getElementById("authMessage");



// =========================
// LOGIN
// =========================


loginBtn.onclick = async () => {

    try {

        await signInWithEmailAndPassword(

            auth,
            email.value,
            password.value

        );


        window.location.href =
        "index.html";


    } catch(error) {


        message.innerText =
        "❌ Usuario o contraseña incorrectos";


    }

};



// =========================
// REGISTRO
// =========================


registerBtn.onclick = async () => {

    try {

        await createUserWithEmailAndPassword(

            auth,
            email.value,
            password.value

        );


        window.location.href =
        "index.html";


    } catch(error) {


        message.innerText =
        "❌ No se pudo crear la cuenta";


    }

};



// =========================
// RECUPERAR PASSWORD
// =========================


resetBtn.onclick = async () => {

    try {


        await sendPasswordResetEmail(

            auth,
            email.value

        );


        message.innerText =
        "📩 Email de recuperación enviado";


    } catch(error) {


        message.innerText =
        "Introduce tu correo primero";


    }

};
