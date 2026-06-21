// --- ESTADO GLOBAL DE LA APLICACIÓN ---

let questions = [];
let currentQuestion = 0;
let answered = false;

let mode = "practice";

let examQuestions = [];
let examCorrect = 0;
let examWrong = 0;
let examAnswers = {};
let filteredQuestions = [];

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


// --- HISTORIAL DE SIMULACROS ---

function renderExamHistory() {

    const history =
        JSON.parse(
            localStorage.getItem(
                EXAM_HISTORY_KEY
            ) || '[]'
        );

    const historyList =
        document.getElementById(
            'historyList'
        );

    if (!historyList) return;

    if (history.length === 0) {

        historyList.innerHTML =
            'No hay simulacros realizados.';

        return;
    }

    historyList.innerHTML = '';

    history.forEach(item => {

        const row =
            document.createElement('div');

        row.className =
            'history-item';

        row.innerHTML =
        `
        <div>
            ${item.date}
        </div>

        <div class="history-score">
            ${item.score}%
        </div>

        <div class="${
            item.passed
                ? 'history-apto'
                : 'history-no-apto'
        }">
            ${
                item.passed
                    ? '✅ APTO'
                    : '❌ NO APTO'
            }
        </div>
        `;

        historyList.appendChild(row);
    });
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
        filteredQuestions = questions;

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
    
    document.getElementById(
        'prevBtn'
    ).style.display =
        'none';

    currentQuestion = 0;
    document.getElementById(
        'finishExamBtn'
    ).style.display =
        'none';

    const progressElement =
        document.getElementById(
            'examProgress'
        );

    const missingElement =
        document.getElementById(
            'examMissing'
        );

    if (progressElement)
        progressElement.innerText = '';

    if (missingElement)
        missingElement.innerText = '';

    showQuestion();
}

function startExamMode() {

    mode = "exam";

    examCorrect = 0;
    examWrong = 0;
    examAnswers = {};

    currentQuestion = 0;

    examSeconds = 3600;

    examQuestions = [...filteredQuestions]
        .sort(() => Math.random() - 0.5)
        .slice(
            0,
            Math.min(
                50,
                filteredQuestions.length
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
    
    document.getElementById(
        'finishExamBtn'
    ).style.display =
        'block';

    document.getElementById(
        'prevBtn'
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
        : filteredQuestions;
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

    if (
        mode === "exam"
    ) {

        const answeredCount =
            Object.keys(
                examAnswers
            ).length;

        const progressElement =
            document.getElementById(
                'examProgress'
            );

        const missingElement =
            document.getElementById(
                'examMissing'
            );

        if (progressElement) {

            progressElement.innerText =
                `Respondidas: ${answeredCount}/${examQuestions.length}`;
        }

        if (missingElement) {

            missingElement.innerText =
                `Sin responder: ${
                    examQuestions.length -
                    answeredCount
                }`;
        }
    }

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

            if (
                mode === "exam" &&
                examAnswers[currentQuestion] === index
            ) {

                btn.classList.add(
                    'selected-answer'
                );

                document.getElementById(
                    'nextBtn'
                ).disabled = false;
            }

            btn.onclick = () => {

                if (mode === "practice") {

                    if (answered) return;

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

                        btn.classList.add(
                            'correct'
                        );

                        stats.correct++;

                        saveStats(stats);

                        updateStatsUI(stats);

                        document.getElementById(
                            'result'
                        ).innerHTML =
                            '✅ Correcto';

                    } else {

                        btn.classList.add(
                            'wrong'
                        );

                        buttons[q.correct]
                            .classList.add(
                                'correct'
                            );

                        stats.wrong++;

                        saveStats(stats);

                        updateStatsUI(stats);

                        document.getElementById(
                            'result'
                        ).innerHTML =
                            '❌ Incorrecto';
                    }

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

                    document.getElementById(
                        'nextBtn'
                    ).disabled =
                        false;

                } else {

                    examAnswers[currentQuestion] =
                        index;

                    document
                        .querySelectorAll(
                            '#answers button'
                        )
                        .forEach(b =>
                            b.classList.remove(
                                'selected-answer'
                            )
                        );

                    btn.classList.add(
                        'selected-answer'
                    );

                    document.getElementById(
                        'nextBtn'
                    ).disabled =
                        false;
                }
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

    examCorrect = 0;
    examWrong = 0;

    examQuestions.forEach(
        (question, idx) => {

            if (
                examAnswers[idx] ===
                question.correct
            ) {

                examCorrect++;

            } else {

                examWrong++;
            }
        }
    );

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

    renderExamHistory();

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
        'finishExamBtn'
    ).style.display =
        'none';
    
    document.getElementById(
        'prevBtn'
    ).style.display =
        'none';
    
    document.getElementById(
        'explanation'
    ).style.display =
        'none';

    document.getElementById(
        'timer'
    ).innerHTML =
        '⏱️ --:--';

    document.getElementById(
        'examProgress'
    ).innerText = '';

    document.getElementById(
        'examMissing'
    ).innerText = '';

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

document.getElementById(
    'prevBtn'
).onclick = () => {

    if (
        currentQuestion > 0
    ) {

        currentQuestion--;

        showQuestion();
    }
};

document.getElementById(
    'finishExamBtn'
).onclick = () => {

    if (
        mode !== "exam"
    ) return;

    const unanswered =
        examQuestions.length -
        Object.keys(
            examAnswers
        ).length;

    if (
        unanswered > 0
    ) {

        const confirmFinish =
            confirm(
                `Todavía quedan ${unanswered} preguntas sin responder.\n\n¿Deseas finalizar igualmente?`
            );

        if (
            !confirmFinish
        ) return;
    }

    finishExam();
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

const subjectFilter =
    document.getElementById(
        'subjectFilter'
    );

if (
    subjectFilter
) {

    subjectFilter.addEventListener(
        'change',
        e => {

            const subject =
                e.target.value;

            if (
                subject === 'all'
            ) {

                filteredQuestions =
                    questions;

            } else {

                filteredQuestions =
                    questions.filter(
                        q =>
                            q.topic &&
                            q.topic.toLowerCase() ===
                            subject.toLowerCase()
                    );
            }

            currentQuestion = 0;

            showQuestion();
        }
    );
}


// --- INICIO ---

renderExamHistory();
loadQuestions();
