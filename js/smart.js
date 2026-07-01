const STATS_KEY = "tcp_practice_stats";
const ERRORS_KEY = "tcp_error_questions";
const FAVORITES_KEY = "tcp_favorites";
const EXAM_HISTORY_KEY = "tcp_exam_history";

function read(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (e) {
        return fallback;
    }
}

function set(id, value) {
    const el = document.getElementById(id);

    if (el) {
        el.textContent = value;
    }
}

const stats = read(STATS_KEY, {
    correct: 0,
    wrong: 0
});

const errors = read(ERRORS_KEY, []);
const favorites = read(FAVORITES_KEY, []);
const history = read(EXAM_HISTORY_KEY, []);

const totalAnswers = stats.correct + stats.wrong;

const level =
    totalAnswers > 0
        ? Math.round((stats.correct / totalAnswers) * 100)
        : 0;

set("smartLevel", level + "%");
set("pendingErrors", errors.length);

const topics = {};

errors.forEach(question => {

    const topic = question.topic || "General";

    topics[topic] = (topics[topic] || 0) + 1;

});

let worstTopic = "Sin datos";
let highestErrors = 0;

Object.entries(topics).forEach(([topic, count]) => {

    if (count > highestErrors) {

        highestErrors = count;
        worstTopic = topic;

    }

});

set("worstSubject", worstTopic);

if (history.length > 0) {

    const bestScore = Math.max(
        ...history.map(item => Number(item.score) || 0)
    );

    if (bestScore >= 90) {

        set("bestSubject", "Excelente");

    } else if (bestScore >= 75) {

        set("bestSubject", "Buen rendimiento");

    } else {

        set("bestSubject", "En progreso");

    }

} else {

    set("bestSubject", "Sin datos");

}

const recommendation =
    document.getElementById("smartRecommendation");

if (recommendation) {

    if (totalAnswers === 0) {

        recommendation.innerHTML = `
            <h3>👋 Bienvenido</h3>

            <p>
                Aún no hay suficientes datos para analizar tu rendimiento.
                Empieza haciendo preguntas en modo práctica para que el
                entrenador inteligente pueda conocerte.
            </p>
        `;

    } else if (errors.length > 0) {

        recommendation.innerHTML = `
            <h3>🎯 Recomendación personalizada</h3>

            <p>
                Tu prioridad debería ser estudiar
                <strong>${worstTopic}</strong>.
            </p>

            <p>
                Actualmente tienes
                <strong>${errors.length}</strong>
                preguntas pendientes de repasar.
            </p>

            <p>
                Después realiza un simulacro AESA para comprobar si has
                mejorado.
            </p>
        `;

    } else {

        recommendation.innerHTML = `
            <h3>🚀 ¡Excelente trabajo!</h3>

            <p>
                No tienes errores pendientes.
            </p>

            <p>
                Mi recomendación es realizar un simulacro completo para
                seguir aumentando tu porcentaje de dominio.
            </p>
        `;

    }

}

console.log("Modo Inteligente cargado correctamente.");
