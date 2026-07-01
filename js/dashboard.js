
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

function updateDashboard() {
    const stats = loadJSON(STATS_KEY, { correct: 0, wrong: 0 });
    const errors = loadJSON(ERRORS_KEY, []);
    const favorites = loadJSON(FAVORITES_KEY, []);
    const history = loadJSON(EXAM_HISTORY_KEY, []);

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText("dashCorrect", stats.correct ?? 0);
    setText("dashWrong", stats.wrong ?? 0);
    setText("dashErrors", errors.length);
    setText("dashFavorites", favorites.length);

    const last = history[0];
    setText("dashLastScore", last ? `${last.score}%` : "—");
    setText("dashLastDate", last ? last.date : "Aún no has completado ningún simulacro");

    const best = history.length
        ? history.reduce((max, item) => Math.max(max, parseFloat(item.score) || 0), 0)
        : 0;
    setText("dashBestScore", history.length ? `${best.toFixed(1)}%` : "—");

    const recent = document.getElementById("dashRecent");
    if (recent) {
        if (!history.length) {
            recent.innerHTML = "<div class='activity-line'><span class='activity-label'>Actividad</span><span class='activity-value'>Sin actividad todavía</span></div>";
        } else {
            recent.innerHTML = history.slice(0, 3).map(item => `
                <div class="activity-line">
                    <span class="activity-label">${item.date}</span>
                    <span class="activity-value">${item.score}%</span>
                </div>
            `).join("");
        }
    }
}

document.addEventListener("DOMContentLoaded", updateDashboard);
