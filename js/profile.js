import { auth } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const STATS_KEY = "tcp_practice_stats";
const ERRORS_KEY = "tcp_error_questions";
const FAVORITES_KEY = "tcp_favorites";
const EXAM_HISTORY_KEY = "tcp_exam_history";
const QUESTION_STATS_KEY = "tcp_question_stats";

function $(id) {
    return document.getElementById(id);
}

function loadJSON(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
}

function formatDate(value) {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString();
    } catch {
        return "—";
    }
}

function prettyName(user) {
    if (user?.displayName) return user.displayName;
    if (!user?.email) return "Alumno";
    const local = user.email.split("@")[0];
    return local.replace(/[._-]+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
}

function getInitials(user) {
    const source = user?.displayName || user?.email || "A";
    const clean = source.split("@")[0].replace(/[._-]+/g, " ").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (clean.slice(0, 2) || "A").toUpperCase();
}

onAuthStateChanged(auth, user => {
    if (!user) return;

    const stats = loadJSON(STATS_KEY, { correct: 0, wrong: 0 });
    const errors = loadJSON(ERRORS_KEY, []);
    const favorites = loadJSON(FAVORITES_KEY, []);
    const history = loadJSON(EXAM_HISTORY_KEY, []);
    const qStats = loadJSON(QUESTION_STATS_KEY, {});

    const best = history.length
        ? Math.max(...history.map(h => Number(h.score) || 0))
        : 0;

    const last = history.length ? history[0] : null;

    const seenQuestions = Object.values(qStats).reduce((acc, item) => acc + (Number(item.seen) || 0), 0);

    $("profileAvatar").textContent = getInitials(user);
    $("profileName").textContent = prettyName(user);
    $("profileEmail").textContent = user.email || "Sin correo";

    $("profileCorrect").textContent = stats.correct ?? 0;
    $("profileWrong").textContent = stats.wrong ?? 0;
    $("profileFavorites").textContent = favorites.length;
    $("profileSimulations").textContent = history.length;

    $("profileEmailValue").textContent = user.email || "—";
    $("profileUid").textContent = user.uid || "—";
    $("profileCreated").textContent = formatDate(user.metadata?.creationTime);
    $("profileVerified").textContent = user.emailVerified ? "Sí" : "No";

    $("profileBestScore").textContent = history.length ? `${best.toFixed(1)}%` : "—";
    $("profileLastScore").textContent = last ? `${Number(last.score).toFixed(1)}%` : "—";
    $("profileLastDate").textContent = last ? last.date : "—";
    $("profileSeenQuestions").textContent = seenQuestions || 0;
});
