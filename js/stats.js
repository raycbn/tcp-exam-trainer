const STORAGE_KEY = 'tcp_exam_stats';

function loadStats() {

    const saved =
        localStorage.getItem(STORAGE_KEY);

    if (!saved) {

        return {
            correct: 0,
            wrong: 0
        };
    }

    return JSON.parse(saved);
}

function saveStats(stats) {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(stats)
    );
}

function resetStats() {

    localStorage.removeItem(STORAGE_KEY);

    updateStatsUI({
        correct: 0,
        wrong: 0
    });
}

function updateStatsUI(stats) {

    const correct =
        stats.correct || 0;

    const wrong =
        stats.wrong || 0;

    document.getElementById(
        'correctCount'
    ).innerText = correct;

    document.getElementById(
        'wrongCount'
    ).innerText = wrong;
}
