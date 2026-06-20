let questions = [];
let currentQuestion = 0;

let answered = false;

let stats = loadStats();

let mode = "practice";

let examQuestions = [];
let examCorrect = 0;
let examWrong = 0;

let timerInterval = null;
let examSeconds = 3600;

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

function startPracticeMode() {

    mode = "practice";

    stopTimer();

    document.getElementById('timer').innerHTML =
        '⏱️ --:--';

    document.getElementById('examResult').style.display =
        'none';

    currentQuestion = 0;

    showQuestion();
}

function startExamMode() {

    mode = "exam";

    examCorrect = 0;
    examWrong = 0;

    examQuestions = [...questions]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(50, questions.length));

    currentQuestion = 0;

    examSeconds = 3600;

    startTimer();

    document.getElementById('examResult').style.display =
        'none';

    showQuestion();
}

function startTimer() {

    stopTimer();

    updateTimer();

    timerInterval = setInterval(() => {

        examSeconds--;

        updateTimer();

        if (examSeconds <= 0) {

            finishExam();

        }

    }, 1000);
}

function stopTimer() {

    if (timerInterval) {

        clearInterval(timerInterval);

        timerInterval = null;

    }
}

function updateTimer() {

    const minutes =
        Math.floor(examSeconds / 60);

    const seconds =
        examSeconds % 60;

    document.getElementById('timer').innerHTML =
        `⏱️ ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getCurrentQuestions() {

    return mode === "exam"
        ? examQuestions
        : questions;
}

function showQuestion() {

    answered = false;

    const source =
        getCurrentQuestions();

    const q =
        source[currentQuestion];

    if (!q) return;

    document.getElementById('counter').innerText =
        `Pregunta ${currentQuestion + 1} / ${source.length}`;

    document.getElementById('question').innerText =
        q.question;

    if (mode === "practice") {

        document.getElementById('topic').innerText =
            `Tema: ${(q.topic || 'General').toUpperCase()}`;

    } else {

        document.getElementById('topic').innerText =
            '📝 Simulacro AESA';

    }

    const progress =
        ((currentQuestion + 1) / source.length) * 100;

    document.getElementById('progress-bar').style.width =
        progress + '%';

    document.getElementById('result').innerHTML = '';

    document.getElementById('explanation').style.display =
        'none';

    document.getElementById('nextBtn').disabled =
        true;

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

            const correct =
                index === q.correct;

            if (correct) {

                btn.classList.add('correct');

                if (mode === "practice") {

                    stats.correct++;

                    saveStats(stats);

                    updateStatsUI(stats);

                } else {

                    examCorrect++;

                }

                document.getElementById('result').innerHTML =
                    '✅ Correcto';

            } else {

                btn.classList.add('wrong');

                buttons[q.correct]
                    .classList.add('correct');

                if (mode === "practice") {

                    stats.wrong++;

                    saveStats(stats);

                    updateStatsUI(stats);

                } else {

                    examWrong++;

                }

                document.getElementById('result').innerHTML =
                    '❌ Incorrecto';

            }

            if (mode === "practice") {

                document.getElementById('explanation').style.display =
                    'block';

                document.getElementById('explanation').innerHTML =
                `
                <span id="explanation-title">
                    ℹ️ Explicación
                </span>

                ${q.explanation}
                `;
            }

            document.getElementById('nextBtn').disabled =
                false;
        };

        answersDiv.appendChild(btn);
    });
}

function finishExam() {

    stopTimer();

    const total =
        examCorrect + examWrong;

    const percent =
        total > 0
        ? (examCorrect / total) * 100
        : 0;

    const passed =
        percent >= 75;

    document.getElementById('examScore').innerHTML =
    `
    Correctas: ${examCorrect}<br>
    Incorrectas: ${examWrong}<br>
    Nota: ${percent.toFixed(1)}%<br><br>

    <strong>
        ${passed ? '✅ APTO' : '❌ NO APTO'}
    </strong>
    `;

    document.getElementById('examResult').style.display =
        'block';

    document.getElementById('answers').innerHTML = '';

    document.getElementById('question').innerHTML =
        'Simulacro finalizado';

    document.getElementById('counter').innerHTML = '';

    document.getElementById('nextBtn').style.display =
        'none';

    document.getElementById('explanation').style.display =
        'none';

    document.getElementById('result').innerHTML = '';
}

document.getElementById('nextBtn').onclick = () => {

    currentQuestion++;

    const source =
        getCurrentQuestions();

    if (currentQuestion >= source.length) {

        if (mode === "exam") {

            finishExam();
            return;

        }

        currentQuestion = 0;
    }

    showQuestion();
};

document.getElementById('practiceMode')
.addEventListener(
    'click',
    startPracticeMode
);

document.getElementById('examMode')
.addEventListener(
    'click',
    startExamMode
);

document.getElementById('restartExam')
.addEventListener(
    'click',
    startExamMode
);

loadQuestions();
