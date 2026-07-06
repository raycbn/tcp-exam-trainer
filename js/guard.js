import { auth } from "./firebase.js";


import {

    onAuthStateChanged,
    signOut

} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";



// =========================
// PÁGINA ACTUAL
// =========================


const currentPage =
    window.location.pathname
    .split("/")
    .pop();



// =========================
// PROTEGER PÁGINAS
// =========================


onAuthStateChanged(auth, user => {


    if (!user && currentPage !== "login.html") {


        window.location.href =
        "login.html";


    }


    if (user && currentPage === "login.html") {


        window.location.href =
        "index.html";


    }


});



// =========================
// CERRAR SESIÓN
// =========================


window.logout = function(){


    signOut(auth)

        .then(() => {

            window.location.href =
            "login.html";

        });


};
