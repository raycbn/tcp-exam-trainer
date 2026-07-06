import { auth } from "./firebase.js";


import {

    onAuthStateChanged,
    signOut

} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";


// =========================
// COMPROBAR LOGIN
// =========================


onAuthStateChanged(

    auth,

    user => {


        if (!user) {


            window.location.href =
            "login.html";


        }


    }

);


// =========================
// LOGOUT GLOBAL
// =========================


window.logout = function(){


    signOut(auth);


};
