
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
const ERRORS_KEY = "tcp_error_questions";
const FAVORITES_KEY = "tcp_favorites";
const QUESTION_STATS_KEY = "tcp_question_stats";

const PAGE_MODE = document.body?.dataset?.page || "";

let stats = loadStats();

function $(id) {
    return document.getElementById(id);
}

function setDisplay(id, value) {
    const el = $(id);
    if (el) el.style.display = value;
}

function setText(id, value) {
    const el = $(id);
    if (el) el.innerText = value;
}

function safeDisable(id, disabled) {
    const el = $(id);
    if (el) el.disabled = disabled;
}


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

function loadErrors() {

    return JSON.parse(
        localStorage.getItem(
            ERRORS_KEY
        ) || '[]'
    );
}

function loadFavorites() {

    return JSON.parse(
        localStorage.getItem(
            FAVORITES_KEY
        ) || '[]'
    );
}

function loadQuestionStats() {

    return JSON.parse(
        localStorage.getItem(
            QUESTION_STATS_KEY
        ) || "{}"
    );

}

function saveQuestionStats(stats) {

    localStorage.setItem(
        QUESTION_STATS_KEY,
        JSON.stringify(stats)
    );

}

function registerAnswer(questionId, correct) {

    const stats =
        loadQuestionStats();

    if (!stats[questionId]) {

        stats[questionId] = {

            seen: 0,
            correct: 0,
            wrong: 0,
            lastSeen: Date.now()

        };

    }

    stats[questionId].seen++;

    stats[questionId].lastSeen = Date.now();

    if (correct) {

        stats[questionId].correct++;

    } else {

        stats[questionId].wrong++;

    }

    saveQuestionStats(stats);

}

function saveFavorites(favorites) {

    localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(favorites)
    );
}

function updateFavoriteButton(question) {

    const favoriteBtn =
        $("favoriteBtn");

    if (!favoriteBtn || !question) return;

    const favorites =
        loadFavorites();

    const isFavorite =
        favorites.some(
            f => String(f.id) === String(question.id)
        );

    favoriteBtn.classList.add('favorite-btn');
    favoriteBtn.classList.toggle(
        'is-favorite',
        isFavorite
    );

    favoriteBtn.innerHTML =
        isFavorite
            ? `
                <span class="favorite-star">★</span>
                <span>Favorita</span>
              `
            : `
                <span class="favorite-star">☆</span>
                <span>Guardar favorita</span>
              `;

    favoriteBtn.setAttribute(
        'aria-pressed',
        isFavorite ? 'true' : 'false'
    );

    favoriteBtn.title =
        isFavorite
            ? 'Quitar de favoritas'
            : 'Guardar en favoritas';

    favoriteBtn.onclick = () => {

        let favorites =
            loadFavorites();

        const exists =
            favorites.some(
                f => String(f.id) === String(question.id)
            );

        if (exists) {

            favorites =
                favorites.filter(
                    f => String(f.id) !== String(question.id)
                );

        } else {

            favorites.push(question);
        }

        saveFavorites(favorites);

        updateFavoriteButton(question);
    };
}

function saveErrors(errors) {

    localStorage.setItem(
        ERRORS_KEY,
        JSON.stringify(errors)
    );

    updateErrorCounter();
}

function updateErrorCounter() {

    const count =
        loadErrors().length;

    const el =
        $("errorCount");

    if (el)
        el.innerText = count;
}

function saveStats(newStats) {

    localStorage.setItem(
        STATS_KEY,
        JSON.stringify(newStats)
    );
}

function updateStatsUI(currentStats) {

    const correctEl = $("correctCount");
    const wrongEl = $("wrongCount");

    if (correctEl) correctEl.innerText = currentStats.correct;
    if (wrongEl) wrongEl.innerText = currentStats.wrong;
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
        $("historyList");

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
        updateErrorCounter();

        autoStartPageMode();

    } catch (error) {

        console.error(error);

        const q = $("question");
        if (q) q.innerText = 'Error cargando preguntas';

    }
}

function autoStartPageMode() {
    if (PAGE_MODE === "practice") {
        startPracticeMode();
    } else if (PAGE_MODE === "exam") {
        startExamMode();
    } else if (PAGE_MODE === "review") {
        startReviewErrorsMode();
    }
}


// --- MODOS ---

function startPracticeMode() {

    mode = "practice";

    stopTimer();

    setDisplay('timer', 'inline-block');
    setText('timer', '⏱️ --:--');

    setDisplay('examResult', 'none');

    setDisplay('nextBtn', 'block');
    setDisplay('prevBtn', 'none');

    currentQuestion = 0;
    setDisplay('finishExamBtn', 'none');

    const progressElement = $("examProgress");
    const missingElement = $("examMissing");
    const historyElement = $("examHistory");

    if (progressElement) progressElement.innerText = '';
    if (missingElement) missingElement.innerText = '';
    if (historyElement) historyElement.style.display = 'none';

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

    setDisplay('examResult', 'none');

    setDisplay('nextBtn', 'block');
    setDisplay('finishExamBtn', 'block');
    setDisplay('prevBtn', 'block');

    const historyElement = $("examHistory");
    if (historyElement) historyElement.style.display = 'block';

    showQuestion();
}

function startReviewErrorsMode() {

    const errors = loadErrors();

    if (errors.length === 0) {

        alert(
            'No tienes errores pendientes.'
        );

        return;
    }

    mode = "review";

    stopTimer();

    filteredQuestions = errors;
    currentQuestion = 0;

    setDisplay('examResult', 'none');
    setDisplay('nextBtn', 'block');
    setDisplay('finishExamBtn', 'none');
    setDisplay('prevBtn', 'none');

    const historyElement = $("examHistory");
    if (historyElement) historyElement.style.display = 'none';

    setText('timer', '🧠 Repaso de errores');
    setDisplay('timer', 'inline-block');

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

    setText(
        'timer',
        `⏱️ ${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`
    );
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

    setText(
        'counter',
        `Pregunta ${currentQuestion + 1} / ${source.length}`
    );

    const questionEl = $("question");
    if (questionEl) {
        questionEl.innerHTML = `
        <div class="question-header">
            <div class="question-text">${q.question}</div>
            <button id="favoriteBtn" class="favorite-btn"></button>
        </div>
        `;
    }

    updateFavoriteButton(q);

    const imageContainer =
        $("questionImageContainer");

    const imageElement =
        $("questionImage");

    if (imageContainer && imageElement) {
        if (q.image) {
            imageElement.src = q.image;
            imageElement.alt = q.question;
            imageContainer.style.display = 'block';
        } else {
            imageElement.src = '';
            imageElement.alt = '';
            imageContainer.style.display = 'none';
        }
    }

    if (mode === "practice") {

        setText(
            'topic',
            `Tema: ${(q.topic || 'General').toUpperCase()}`
        );

    } else if (mode === "review") {

        setText('topic', '🧠 Repaso de errores');

    } else {

        setText('topic', '📝 Simulacro AESA');
    }

    const progress =
        ((currentQuestion + 1) /
            source.length) * 100;

    const progressBar = $("progress-bar");
    if (progressBar) progressBar.style.width = progress + '%';

    const resultEl = $("result");
    if (resultEl) resultEl.innerHTML = '';

    const explanationEl = $("explanation");
    if (explanationEl) explanationEl.style.display = 'none';

    safeDisable('nextBtn', true);

    if (
        mode === "exam"
    ) {

        const answeredCount =
            Object.keys(
                examAnswers
            ).length;

        const progressElement =
            $("examProgress");

        const missingElement =
            $("examMissing");

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
        $("answers");

    if (!answersDiv) return;

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

                safeDisable('nextBtn', false);
            }

            btn.onclick = () => {

                if (
                    mode === "practice" ||
                    mode === "review"
                ) {

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
                    registerAnswer(
                        q.id,
                        correct
                    );

                    if (correct) {

                        btn.classList.add(
                            'correct'
                        );

                        stats.correct++;

                        saveStats(stats);

                        updateStatsUI(stats);

                        if (resultEl) resultEl.innerHTML = '✅ Correcto';

                        if (mode === "review") {

                            let errors =
                                loadErrors();

                            errors =
                                errors.filter(
                                    e => String(e.id) !== String(q.id)
                                );

                            saveErrors(errors);
                        }

                    } else {

                        btn.classList.add(
                            'wrong'
                        );

                        if (buttons[q.correct]) {
                            buttons[q.correct].classList.add(
                                'correct'
                            );
                        }

                        stats.wrong++;

                        saveStats(stats);

                        updateStatsUI(stats);

                        if (resultEl) resultEl.innerHTML = '❌ Incorrecto';
                    }

                    if (explanationEl) {
                        explanationEl.style.display = 'block';
                        explanationEl.innerHTML = `
                            <span id="explanation-title">ℹ️ Explicación</span>
                            ${q.explanation || 'Sin explicación'}
                        `;
                    }

                    safeDisable('nextBtn', false);

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

                    safeDisable('nextBtn', false);
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

    let failedQuestionsHtml = '';

    examQuestions.forEach((question, idx) => {

        if (
            examAnswers[idx] !==
            question.correct
        ) {

            const selectedAnswer =
                examAnswers[idx] !== undefined
                    ? question.options[
                        examAnswers[idx]
                    ]
                    : 'Sin responder';

            const correctAnswer =
                question.options[
                    question.correct
                ];

            failedQuestionsHtml += `
                <div class="failed-question">
                    <strong>${question.question}</strong>
                    <br><br>
                    ❌ Tu respuesta: ${selectedAnswer}
                    <br>
                    ✅ Correcta: ${correctAnswer}
                </div>
            `;
        }
    });

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

    let savedErrors =
        loadErrors();

    examQuestions.forEach(
        (question, idx) => {

            if (
                examAnswers[idx] !==
                question.correct
            ) {

                if (
                    !savedErrors.some(
                        q => String(q.id) === String(question.id)
                    )
                ) {

                    savedErrors.push(
                        question
                    );
                }
            }
        }
    );

    saveErrors(savedErrors);

    renderExamHistory();

    const examScoreEl = $("examScore");
    if (examScoreEl) {
        examScoreEl.innerHTML =
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

        ${
            examWrong > 0
                ? `
                <hr>
                <h3>Preguntas falladas</h3>
                ${failedQuestionsHtml}
                `
                : `
                <hr>
                <h3>🎉 No has cometido errores</h3>
                `
        }
        `;
    }

    setDisplay('examResult', 'block');

    const answers = $("answers");
    if (answers) answers.innerHTML = '';

    setText('question', 'Simulacro finalizado');
    setText('counter', '');
    setDisplay('nextBtn', 'none');
    setDisplay('finishExamBtn', 'none');
    setDisplay('prevBtn', 'none');

    const explanationEl = $("explanation");
    if (explanationEl) explanationEl.style.display = 'none';

    const imageContainer = $("questionImageContainer");
    if (imageContainer) imageContainer.style.display = 'none';

    setText('timer', '⏱️ --:--');

    const progressElement = $("examProgress");
    const missingElement = $("examMissing");

    if (progressElement) progressElement.innerText = '';
    if (missingElement) missingElement.innerText = '';

    const resultEl = $("result");
    if (resultEl) resultEl.innerHTML = '';
}


// --- EVENTOS ---

const nextBtn = $("nextBtn");
if (nextBtn) {
    nextBtn.onclick = () => {

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
}

const prevBtn = $("prevBtn");
if (prevBtn) {
    prevBtn.onclick = () => {

        if (
            currentQuestion > 0
        ) {

            currentQuestion--;

            showQuestion();
        }
    };
}

const finishExamBtn = $("finishExamBtn");
if (finishExamBtn) {
    finishExamBtn.onclick = () => {

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
}

const practiceModeBtn = $("practiceMode");
if (practiceModeBtn) practiceModeBtn.addEventListener('click', startPracticeMode);

const examModeBtn = $("examMode");
if (examModeBtn) examModeBtn.addEventListener('click', startExamMode);

const restartExamBtn = $("restartExam");
if (restartExamBtn) restartExamBtn.addEventListener('click', startExamMode);

const reviewErrorsModeBtn = $("reviewErrorsMode");
if (reviewErrorsModeBtn) reviewErrorsModeBtn.addEventListener('click', startReviewErrorsMode);

const subjectFilter =
    $("subjectFilter");

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

            if (PAGE_MODE) {
                showQuestion();
            }
        }
    );
}


// --- INICIO ---

renderExamHistory();
updateErrorCounter();
loadQuestions();
