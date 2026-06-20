let questions = [];
let currentQuestion = 0;

let answered = false;

let stats = loadStats();

async function loadQuestions() {

    try {

        const response = await fetch(
            './data/questions.json?ts=' + Date.now()
        );

        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }

        questions = await response.json();

        updateStatsUI(stats);

        showQuestion();

    } catch (error) {

        console.error(error);

        document.getElementById('question').innerText =
            'Error cargando preguntas';

    }

}

function showQuestion() {

    answered = false;

    const q = questions[currentQuestion];

    document.getElementById('counter').innerText =
        `Pregunta ${currentQuestion + 1} / ${questions.length}`;

    document.getElementById('question').innerText =
        q.question;

    document.getElementById('topic').innerText =
        `Tema: ${(q.topic || 'General').toUpperCase()}`;

    const progress =
        ((currentQuestion + 1) / questions.length) * 100;

    document.getElementById('progress-bar').style.width =
        progress + '%';

    document.getElementById('result').innerHTML = '';

    document.getElementById('explanation').style.display =
        'none';

    document.getElementById('explanation').innerHTML =
        '';

    document.getElementById('nextBtn').disabled = true;

    const answersDiv =
        document.getElementById('answers');

    answersDiv.innerHTML = '';

    q.options.forEach((option, index) => {

        const btn =
            document.createElement('button');

        btn.innerText = option;

        btn.onclick = () => {

            if (answered) return;

            answered = true;

            const buttons =
                document.querySelectorAll(
                    '#answers button'
                );

            buttons.forEach(b => {
                b.disabled = true;
            });

            if (index === q.correct) {

                stats.correct++;

                saveStats(stats);

                updateStatsUI(stats);

                btn.classList.add('correct');

                document.getElementById('result').innerHTML =
                    '✅ Correcto';

            } else {

                stats.wrong++;

                saveStats(stats);

                updateStatsUI(stats);

                btn.classList.add('wrong');

                buttons[q.correct]
                    .classList.add('correct');

                document.getElementById('result').innerHTML =
                    '❌ Incorrecto';

            }

            document.getElementById('explanation').style.display =
                'block';

            document.getElementById('explanation').innerHTML =
            `
            <span id="explanation-title">
                ℹ️ Explicación
            </span>

            ${q.explanation}
            `;

            document.getElementById('nextBtn').disabled =
                false;

        };

        answersDiv.appendChild(btn);

    });

}

document.getElementById('nextBtn').onclick = () => {

    currentQuestion++;

    if (currentQuestion >= questions.length) {
        currentQuestion = 0;
    }

    showQuestion();

};

loadQuestions();
