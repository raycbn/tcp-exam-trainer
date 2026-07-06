import { db }
from "./firebase.js";


import {

collection,
getDocs

} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";




// =========================
// CARGADOR HÍBRIDO
// JSON + FIRESTORE
// =========================


export async function loadQuestionBank(){


let jsonQuestions = [];

let firestoreQuestions = [];




// JSON LOCAL

try{


const response =

await fetch(

"./data/questions.json?ts=" + Date.now()

);



jsonQuestions =

await response.json();



}catch(error){


console.error(
"Error JSON",
error
);


}





// FIRESTORE


try{


const snap =

await getDocs(

collection(
db,
"questions"
)

);



firestoreQuestions =

snap.docs.map(doc=>({

firebaseId:doc.id,

...doc.data()

}));



}catch(error){


console.error(
"Error Firestore",
error
);


}




const all = [

...jsonQuestions,

...firestoreQuestions

];



// mezcla aleatoria


return all.sort(

()=> Math.random() - 0.5

);



}
