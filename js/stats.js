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

function updateStatsUI(stats) {

    document.getElementById(
        'correctCount'
    ).innerText = stats.correct;

    document.getElementById(
        'wrongCount'
    ).innerText = stats.wrong;
}
