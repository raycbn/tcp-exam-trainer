const EXAM_HISTORY_KEY = "tcp_exam_history";
const STATS_KEY = "tcp_practice_stats";
const ERRORS_KEY = "tcp_error_questions";
const FAVORITES_KEY = "tcp_favorites";

function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setHTML(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
}

function calculateProgress(stats) {
    const total = stats.correct + stats.wrong;

    if (total === 0) {
        return 0;
    }

    return Math.round((stats.correct / total) * 100);
}

function getRecommendation(stats, errors, favorites) {

    if (errors.length > 20) {
        return "🧠 Tienes bastantes preguntas pendientes. Hoy es un buen día para repasar errores.";
    }

    if (favorites.length > 0) {
        return "⭐ Repasa primero tus preguntas favoritas.";
    }

    if (stats.correct < 100) {
        return "📚 Continúa haciendo preguntas en modo práctica.";
    }

    return "🚀 Ya puedes centrarte en simulacros AESA completos.";
}

function renderActivity(history) {

    const container = document.getElementById("dashRecent");

    if (!container) return;

    if (history.length === 0) {

        container.innerHTML = `
            <div class="activity-line">
                <span class="activity-label">
                    Sin actividad todavía
                </span>

                <span class="activity-value">
                    Empieza un simulacro
                </span>
            </div>
        `;

        return;
    }

    container.innerHTML = history
        .slice(0, 5)
        .map(item => {

            const state = item.passed
                ? "✅ APTO"
                : "❌ NO APTO";

            return `
                <div class="activity-line">

                    <span class="activity-label">
                        ${item.date}
                    </span>

                    <span class="activity-value">
                        ${item.score}% · ${state}
                    </span>

                </div>
            `;

        })
        .join("");
}

function updateDashboard() {

    const stats =
        loadJSON(
            STATS_KEY,
            {
                correct: 0,
                wrong: 0
            }
        );

    const errors =
        loadJSON(
            ERRORS_KEY,
            []
        );

    const favorites =
        loadJSON(
            FAVORITES_KEY,
            []
        );

    const history =
        loadJSON(
            EXAM_HISTORY_KEY,
            []
        );

    setText(
        "dashCorrect",
        stats.correct
    );

    setText(
        "dashWrong",
        stats.wrong
    );

    setText(
        "dashErrors",
        errors.length
    );

    setText(
        "dashFavorites",
        favorites.length
    );

    const progress =
        calculateProgress(stats);

    const last =
        history[0];

    const best =
        history.length
            ? Math.max(
                ...history.map(
                    h => parseFloat(h.score)
                )
            )
            : null;

    setText(
        "dashLastScore",
        last
            ? last.score + "%"
            : "—"
    );

    setText(
        "dashLastDate",
        last
            ? last.date
            : "Todavía no has realizado ningún simulacro"
    );

    setText(
        "dashBestScore",
        best !== null
            ? best.toFixed(1) + "%"
            : "—"
    );

    renderActivity(history);

    const recommendation =
        document.getElementById(
            "dashRecommendation"
        );

    if (recommendation) {

        recommendation.innerHTML = `
            <strong>
                Recomendación de hoy
            </strong>

            <br><br>

            ${getRecommendation(
                stats,
                errors,
                favorites
            )}
        `;
    }

    const progressBar =
        document.getElementById(
            "dashProgressBar"
        );

    if (progressBar) {

        progressBar.style.width =
            progress + "%";
    }

    const progressText =
        document.getElementById(
            "dashProgressText"
        );

    if (progressText) {

        progressText.textContent =
            progress + "% completado";
    }
}

document.addEventListener(
    "DOMContentLoaded",
    updateDashboard
);
