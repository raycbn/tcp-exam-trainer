import { auth } from "./firebase.js";


import {

    onAuthStateChanged,

    sendPasswordResetEmail,

    signOut


} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";






function $(id){

    return document.getElementById(id);

}



function setText(id,value){


    const el=$(id);


    if(el){

        el.textContent=value;

    }

}





function formatDate(date){


    if(!date)

    return "—";



    return new Date(date)

    .toLocaleString("es-ES",{

        day:"2-digit",

        month:"2-digit",

        year:"numeric",

        hour:"2-digit",

        minute:"2-digit"

    });


}






// =========================
// LOAD ACCOUNT
// =========================



onAuthStateChanged(auth,user=>{


    if(!user)

    return;




    setText(

        "accountEmail",

        user.email || "Sin correo"

    );




    setText(

        "accountEmailValue",

        user.email || "—"

    );





    setText(

        "accountUid",

        user.uid || "—"

    );





    setText(

        "accountCreated",

        formatDate(

            user.metadata?.creationTime

        )

    );






    setText(

        "accountVerified",

        user.emailVerified

        ?

        "Sí"

        :

        "No"

    );




});







// =========================
// RESET PASSWORD
// =========================



const resetBtn =

$("resetPasswordBtn");



const logoutBtn =

$("accountLogoutBtn");



const message =

$("accountMessage");







if(resetBtn){



resetBtn.onclick = async()=>{



    try{



        const user = auth.currentUser;



        if(!user?.email){


            setText(

                "accountMessage",

                "No se encontró correo asociado."


            );


            return;


        }





        await sendPasswordResetEmail(

            auth,

            user.email

        );





        setText(

            "accountMessage",

            "📩 Correo enviado correctamente."

        );





    }catch(error){



        setText(

            "accountMessage",

            "❌ No se pudo enviar el correo."


        );



    }



};



}








// =========================
// LOGOUT
// =========================


if(logoutBtn){



logoutBtn.onclick = async()=>{


    try{


        await signOut(auth);


        window.location.href =

        "login.html";



    }catch{



        setText(

            "accountMessage",

            "❌ Error cerrando sesión."

        );



    }



};



}
