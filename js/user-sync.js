import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";


import {

    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp

} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";



// ============================
// SINCRONIZAR USUARIO FIRESTORE
// ============================


onAuthStateChanged(auth, async user => {


    if (!user) return;


    try {


        const ref = doc(
            db,
            "users",
            user.uid
        );


        const snap =
            await getDoc(ref);



        const data = {


            uid: user.uid,

            email: user.email || "",

            name:
                user.displayName ||
                user.email.split("@")[0],

            photo:
                user.photoURL || "",

            verified:
                user.emailVerified,

            lastLogin:
                serverTimestamp()


        };



        if (snap.exists()) {


            await updateDoc(
                ref,
                data
            );


        } else {


            await setDoc(
                ref,
                {

                    ...data,

                    createdAt:
                        serverTimestamp(),

                    stats: {

                        questionsDone: 0,

                        correct: 0,

                        wrong: 0,

                        average: 0

                    }

                }
            );


        }



        console.log(
            "Usuario sincronizado"
        );


    } catch(error){


        console.error(
            "Error sincronizando usuario",
            error
        );

    }


});
