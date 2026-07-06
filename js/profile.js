import { auth } from "./firebase.js";

import {

    onAuthStateChanged

} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";



// =========================
// KEYS
// =========================


const STATS_KEY =
"tcp_practice_stats";


const FAVORITES_KEY =
"tcp_favorites";


const EXAM_HISTORY_KEY =
"tcp_exam_history";


const QUESTION_STATS_KEY =
"tcp_question_stats";




// =========================
// HELPERS
// =========================


function $(id){

    return document.getElementById(id);

}




function setText(id,value){


    const el = $(id);


    if(el){

        el.textContent = value;

    }


}




function loadJSON(key,fallback){


    try{


        return JSON.parse(

            localStorage.getItem(key)

            ||

            JSON.stringify(fallback)

        );


    }catch{


        return fallback;


    }


}





function prettyName(user){


    if(user?.displayName)

        return user.displayName;



    if(!user?.email)

        return "Alumno";



    return user.email

        .split("@")[0]

        .replace(/[._-]+/g," ")

        .trim()

        .replace(/\b\w/g,c=>c.toUpperCase());


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
// PROFILE LOAD
// =========================


onAuthStateChanged(auth,user=>{


    if(!user)

        return;




    // USER DATA


    setText(
        "profileName",
        prettyName(user)
    );



    setText(
        "profileEmail",
        user.email || "Sin correo"
    );




    setText(
        "profileEmailValue",
        user.email || "—"
    );



    setText(
        "profileUid",
        user.uid || "—"
    );



    setText(
        "profileCreated",
        formatDate(
            user.metadata?.creationTime
        )
    );



    setText(
        "profileVerified",
        user.emailVerified
        ? "Sí"
        : "No"
    );






    // STATS


    const stats =
    loadJSON(
        STATS_KEY,
        {
            correct:0,
            wrong:0
        }
    );



    const favorites =
    loadJSON(
        FAVORITES_KEY,
        []
    );



    const exams =
    loadJSON(
        EXAM_HISTORY_KEY,
        []
    );



    const questions =
    loadJSON(
        QUESTION_STATS_KEY,
        {}
    );





    setText(
        "profileCorrect",
        stats.correct ?? 0
    );



    setText(
        "profileWrong",
        stats.wrong ?? 0
    );



    setText(
        "profileFavorites",
        favorites.length
    );



    setText(
        "profileSimulations",
        exams.length
    );







    // PERFORMANCE


    const best =
    exams.length

    ?

    Math.max(
        ...exams.map(
            e=>Number(e.score)||0
        )
    )

    :

    null;




    const last =
    exams.length

    ?

    exams[0]

    :

    null;




    const seen =

    Object.values(questions)

    .reduce(

        (total,item)=>

        total +

        (Number(item.seen)||0)

    ,0);






    setText(
        "profileBestScore",
        best!==null
        ? best.toFixed(1)+"%"
        : "—"
    );



    setText(
        "profileLastScore",
        last
        ? Number(last.score).toFixed(1)+"%"
        : "—"
    );



    setText(
        "profileLastDate",
        last?.date || "—"
    );



    setText(
        "profileSeenQuestions",
        seen
    );



});
