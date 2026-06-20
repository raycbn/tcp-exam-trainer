let questions = [];
let currentQuestion = 0;

async function loadQuestions() {
    try {

        const response = await fetch('./data/questions.json?ts=' + Date.now(), {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }

        const text = await response.text();

        questions = JSON.parse(text);

        showQuestion();

    } catch (error) {

        console.error(error);

        document.getElementById('question').innerText =
            'Error cargando preguntas';

    }
}

function showQuestion() {

    const q = questions[currentQuestion];

    document.getElementById("counter").innerText =
        `Pregunta ${currentQuestion + 1} / ${questions.length}`;

    document.getElementById("question").innerText =
        q.question;

    document.getElementById("result").innerText = "";

    const answersDiv =
        document.getElementById("answers");

    answersDiv.innerHTML = "";

    q.options.forEach((option, index) => {

        const btn =
            document.createElement("button");

        btn.innerText = option;

        btn.style.display = "block";
        btn.style.margin = "10px 0";

        btn.onclick = () => {

            if (index === q.correct) {

                document.getElementById("result").innerText =
                    "✅ Correcto";

            } else {

                document.getElementById("result").innerText =
                    "❌ Incorrecto";

            }

        };

        answersDiv.appendChild(btn);

    });

}

document.getElementById("nextBtn").onclick = () => {

    currentQuestion++;

    if (currentQuestion >= questions.length) {

        currentQuestion = 0;

    }

    showQuestion();

};

loadQuestions();
