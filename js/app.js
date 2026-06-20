// --- ESTADO GLOBAL DE LA APLICACIÓN ---

let questions = [];
let currentQuestion = 0;
let answered = false;

let mode = "practice";

let examQuestions = [];
let examCorrect = 0;
let examWrong = 0;

let timerInterval = null;
let examSeconds = 3600;

const EXAM_HISTORY_KEY = "tcp_exam_history";
const STATS_KEY = "tcp_practice_stats";

let stats = loadStats();


// --- LOCAL STORAGE ---

function loadStats() {

    const defaultStats = {
        correct: 0,
        wrong: 0
    };

    try {

        const saved =
            localStorage.getItem(STATS_KEY);

        return saved
            ? JSON.parse(saved)
            : defaultStats;

    } catch {

        return defaultStats;

    }
}

function saveStats(newStats) {

    localStorage.setItem(
        STATS_KEY,
        JSON.stringify(newStats)
    );
}

function updateStatsUI(currentStats) {

    document.getElementById(
        'correctCount'
    ).innerText = currentStats.correct;

    document.getElementById(
        'wrongCount'
    ).innerText = currentStats.wrong;
}


// --- CARGAR PREGUNTAS ---

async function loadQuestions() {

    try {

        const response = await fetch(
            './data/questions.json?ts=' + Date.now()
        );

        if (!response.ok) {

            throw new Error(
                'HTTP ' + response.status
            );

        }

        questions = await response.json();

        updateStatsUI(stats);

        showQuestion();

    } catch (error) {

        console.error(error);

        document.getElementById(
            'question'
        ).innerText =
            'Error cargando preguntas';

    }
}


// --- MODOS ---

function startPracticeMode() {

    mode = "practice";

    stopTimer();

    document.getElementById(
        'timer'
    ).innerHTML =
        '⏱️ --:--';

    document.getElementById(
        'examResult'
    ).style.display =
        'none';

    document.getElementById(
        'nextBtn'
    ).style.display =
        'block';

    currentQuestion = 0;

    showQuestion();
}

function startExamMode() {

    mode = "exam";

    examCorrect = 0;
    examWrong = 0;

    currentQuestion = 0;

    examSeconds = 3600;

    examQuestions = [...questions]
        .sort(() => Math.random() - 0.5)
        .slice(
            0,
            Math.min(
                50,
                questions.length
            )
        );

    startTimer();

    document.getElementById(
        'examResult'
    ).style.display =
        'none';

    document.getElementById(
        'nextBtn'
    ).style.display =
        'block';

    showQuestion();
}


// --- TEMPORIZADOR ---

function startTimer() {

    stopTimer();

    updateTimer();

    timerInterval =
        setInterval(() => {

            examSeconds--;

            updateTimer();

            if (examSeconds <= 0) {

                finishExam();

            }

        }, 1000);
}

function stopTimer() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval = null;
    }
}

function updateTimer() {

    const minutes =
        Math.floor(
            examSeconds / 60
        );

    const seconds =
        examSeconds % 60;

    document.getElementById(
        'timer'
    ).innerHTML =
        `⏱️ ${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}


// --- OBTENER PREGUNTAS ACTUALES ---

function getCurrentQuestions() {

    return mode === "exam"
        ? examQuestions
        : questions;
}


// --- MOSTRAR PREGUNTA ---

function showQuestion() {

    answered = false;

    const source =
        getCurrentQuestions();

    const q =
        source[currentQuestion];

    if (!q) return;

    document.getElementById(
        'counter'
    ).innerText =
        `Pregunta ${currentQuestion + 1} / ${source.length}`;

    document.getElementById(
        'question'
    ).innerText =
        q.question;

    if (mode === "practice") {

        document.getElementById(
            'topic'
        ).innerText =
            `Tema: ${(q.topic || 'General').toUpperCase()}`;

    } else {

        document.getElementById(
            'topic'
        ).innerText =
            '📝 Simulacro AESA';
    }

    const progress =
        ((currentQuestion + 1) /
            source.length) * 100;

    document.getElementById(
        'progress-bar'
    ).style.width =
        progress + '%';

    document.getElementById(
        'result'
    ).innerHTML = '';

    document.getElementById(
        'explanation'
    ).style.display =
        'none';

    document.getElementById(
        'nextBtn'
    ).disabled = true;

    const answersDiv =
        document.getElementById(
            'answers'
        );

    answersDiv.innerHTML = '';

    q.options.forEach(
        (option, index) => {

            const btn =
                document.createElement(
                    'button'
                );

            btn.innerText =
                option;

            btn.onclick = () => {

                if (answered)
                    return;

                answered = true;

                const buttons =
                    document.querySelectorAll(
                        '#answers button'
                    );

                buttons.forEach(
                    b => b.disabled = true
                );

                const correct =
                    index === q.correct;

                if (correct) {

                    if (mode === "practice") {

                        btn.classList.add(
                            'correct'
                        );

                        stats.correct++;

                        saveStats(stats);

                        updateStatsUI(
                            stats
                        );

                        document.getElementById(
                            'result'
                        ).innerHTML =
                            '✅ Correcto';

                    } else {

                        examCorrect++;
                    }

                } else {

                    if (mode === "practice") {

                        btn.classList.add(
                            'wrong'
                        );

                        buttons[q.correct]
                            .classList.add(
                                'correct'
                            );

                        stats.wrong++;

                        saveStats(stats);

                        updateStatsUI(
                            stats
                        );

                        document.getElementById(
                            'result'
                        ).innerHTML =
                            '❌ Incorrecto';

                    } else {

                        examWrong++;
                    }
                }

                if (
                    mode === "practice"
                ) {

                    document.getElementById(
                        'explanation'
                    ).style.display =
                        'block';

                    document.getElementById(
                        'explanation'
                    ).innerHTML =
                    `
                    <span id="explanation-title">
                        ℹ️ Explicación
                    </span>

                    ${q.explanation || 'Sin explicación'}
                    `;
                }

                document.getElementById(
                    'nextBtn'
                ).disabled =
                    false;
            };

            answersDiv.appendChild(
                btn
            );
        }
    );
}


// --- FINALIZAR EXAMEN ---

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

    const history =
        JSON.parse(
            localStorage.getItem(
                EXAM_HISTORY_KEY
            ) || '[]'
        );

    history.unshift({

        date:
            new Date()
            .toLocaleString(),

        score:
            percent.toFixed(1),

        correct:
            examCorrect,

        wrong:
            examWrong,

        passed
    });

    localStorage.setItem(
        EXAM_HISTORY_KEY,
        JSON.stringify(
            history.slice(0,20)
        )
    );

    document.getElementById(
        'examScore'
    ).innerHTML =
    `
    Correctas: ${examCorrect}<br>
    Incorrectas: ${examWrong}<br>
    Nota: ${percent.toFixed(1)}%<br><br>

    <strong class="${
        passed
            ? 'apto'
            : 'no-apto'
    }">
        ${
            passed
            ? '✅ APTO'
            : '❌ NO APTO'
        }
    </strong>
    `;

    document.getElementById(
        'examResult'
    ).style.display =
        'block';

    document.getElementById(
        'answers'
    ).innerHTML = '';

    document.getElementById(
        'question'
    ).innerHTML =
        'Simulacro finalizado';

    document.getElementById(
        'counter'
    ).innerHTML = '';

    document.getElementById(
        'nextBtn'
    ).style.display =
        'none';

    document.getElementById(
        'explanation'
    ).style.display =
        'none';

    document.getElementById(
        'result'
    ).innerHTML = '';
}


// --- EVENTOS ---

document.getElementById(
    'nextBtn'
).onclick = () => {

    currentQuestion++;

    const source =
        getCurrentQuestions();

    if (
        currentQuestion >=
        source.length
    ) {

        if (
            mode === "exam"
        ) {

            finishExam();
            return;
        }

        currentQuestion = 0;
    }

    showQuestion();
};

document
.getElementById(
    'practiceMode'
)
.addEventListener(
    'click',
    startPracticeMode
);

document
.getElementById(
    'examMode'
)
.addEventListener(
    'click',
    startExamMode
);

document
.getElementById(
    'restartExam'
)
.addEventListener(
    'click',
    startExamMode
);


// --- INICIO ---

loadQuestions();
