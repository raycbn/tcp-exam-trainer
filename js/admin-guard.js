import { auth } from "./firebase.js";


import {

onAuthStateChanged

} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";



const ADMIN_EMAIL =

"rayvf2002@gmail.com";



onAuthStateChanged(auth,user=>{


    if(!user){

        window.location.href =
        "login.html";

        return;

    }



    if(

        user.email !== ADMIN_EMAIL

    ){


        alert(
        "Acceso no autorizado"
        );


        window.location.href =
        "index.html";


    }



});
