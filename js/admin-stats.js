import { auth, db } from "./firebase.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    collection,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const ADMIN_EMAIL = "rayvf2002@gmail.com";

const PAGE = document.body?.dataset?.page || "admin-stats";

let state = {
    users: [],
    firestoreQuestions: [],
    jsonQuestions: []
};

function $(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function setMessage(value) {
    setText("adminMessage", value);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[ch]));
}

function timestampToMs(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const ms = Date.parse(value);
        return Number.isNaN(ms) ? 0 : ms;
    }
    return 0;
}

function formatDate(value) {
    const ms = timestampToMs(value);
    if (!ms) return "—";

    return new Date(ms).toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0.0%";
    return `${num.toFixed(1)}%`;
}

function formatDecimal(value, digits = 1) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0.0";
    return num.toFixed(digits);
}

function formatNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0";
    return new Intl.NumberFormat("es-ES").format(Math.trunc(num));
}

function prettyName(user) {
    if (user?.displayName) return user.displayName;
    if (!user?.email) return "Administrador";

    return user.email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
}

function prettyTopic(value) {
    const raw = String(value || "general").trim() || "general";
    return raw
        .replace(/[._-]+/g, " ")
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
}

function startOfDayMs(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function startOfWeekMs(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay(); // 0 domingo
    const diff = (day + 6) % 7; // lunes como inicio
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function startOfMonthMs(date = new Date()) {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function mapUserRecord(docSnap) {
    const data = docSnap.data() || {};
    const stats = data.stats || {};
    const createdAtMs = timestampToMs(data.createdAt);

    return {
        docId: docSnap.id,
        uid: data.uid || docSnap.id,
        email: data.email || "",
        name: data.displayName || data.name || "",
        role: data.role || "student",
        disabled: Boolean(data.disabled),
        verified: Boolean(data.verified),
        createdAt: data.createdAt || null,
        createdAtMs,
        stats: {
            correct: Number(stats.correct || 0),
            wrong: Number(stats.wrong || 0),
            exams: Number(stats.exams || 0),
            favorites: Number(stats.favorites || 0),
            bestScore: Number(stats.bestScore || 0),
            lastExam: stats.lastExam || null
        }
    };
}

function mapQuestionRecord(docSnap) {
    const data = docSnap.data() || {};

    return {
        docId: docSnap.id,
        id: data.id || docSnap.id,
        topic: data.topic || "general",
        question: data.question || "",
        options: Array.isArray(data.options) ? data.options : [],
        correct: Number(data.correct || 0),
        explanation: data.explanation || "",
        source: data.source || "firestore",
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        stats: data.stats || {}
    };
}

function normalizeJsonQuestions(raw) {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.questions)) return raw.questions;
    return [];
}

async function loadJsonQuestions() {
    try {
        const response = await fetch("./data/questions.json?ts=" + Date.now());
        if (!response.ok) return [];
        const data = await response.json();
        return normalizeJsonQuestions(data);
    } catch {
        return [];
    }
}

async function checkAdmin(user) {
    if (!user) return false;
    if (user.email === ADMIN_EMAIL) return true;

    try {
        const snap = await getDoc(doc(db, "users", user.uid));
        return snap.exists() && snap.data()?.role === "admin";
    } catch {
        return false;
    }
}

function sumUsers(users, field) {
    return users.reduce((acc, user) => acc + Number(user.stats?.[field] || 0), 0);
}

function average(values) {
    const nums = values.filter(v => Number.isFinite(Number(v))).map(Number);
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function usersWithScore(users) {
    return users.filter(u => Number(u.stats?.bestScore || 0) > 0 || Number(u.stats?.exams || 0) > 0);
}

function buildUserMetrics(users) {
    const total = users.length;
    const admins = users.filter(u => u.role === "admin").length;
    const students = total - admins;
    const active = users.filter(u => !u.disabled).length;
    const disabled = total - active;

    const withExams = users.filter(u => Number(u.stats?.exams || 0) > 0).length;
    const withoutExams = total - withExams;

    const withFavorites = users.filter(u => Number(u.stats?.favorites || 0) > 0).length;
    const withoutFavorites = total - withFavorites;

    const createdMs = users
        .map(u => u.createdAtMs)
        .filter(ms => Number.isFinite(ms) && ms > 0);

    const firstUserMs = createdMs.length ? Math.min(...createdMs) : 0;
    const lastUserMs = createdMs.length ? Math.max(...createdMs) : 0;

    const todayStart = startOfDayMs();
    const weekStart = startOfWeekMs();
    const monthStart = startOfMonthMs();

    const todayUsers = users.filter(u => u.createdAtMs >= todayStart).length;
    const weekUsers = users.filter(u => u.createdAtMs >= weekStart).length;
    const monthUsers = users.filter(u => u.createdAtMs >= monthStart).length;

    const scoreUsers = usersWithScore(users);
    const scoreBase = scoreUsers.length ? scoreUsers : users;

    const bestScore = scoreBase.length
        ? Math.max(...scoreBase.map(u => Number(u.stats?.bestScore || 0)))
        : 0;

    const worstScore = scoreBase.length
        ? Math.min(...scoreBase.map(u => Number(u.stats?.bestScore || 0)))
        : 0;

    const averageScore = scoreBase.length
        ? average(scoreBase.map(u => Number(u.stats?.bestScore || 0)))
        : 0;

    const totalCorrect = sumUsers(users, "correct");
    const totalWrong = sumUsers(users, "wrong");
    const totalExams = sumUsers(users, "exams");
    const totalFavorites = sumUsers(users, "favorites");
    const averageExams = total > 0 ? totalExams / total : 0;

    const topUsers = [...scoreBase]
        .sort((a, b) => {
            const scoreDiff = Number(b.stats?.bestScore || 0) - Number(a.stats?.bestScore || 0);
            if (scoreDiff !== 0) return scoreDiff;

            const examsDiff = Number(b.stats?.exams || 0) - Number(a.stats?.exams || 0);
            if (examsDiff !== 0) return examsDiff;

            const correctDiff = Number(b.stats?.correct || 0) - Number(a.stats?.correct || 0);
            if (correctDiff !== 0) return correctDiff;

            return (b.createdAtMs || 0) - (a.createdAtMs || 0);
        })
        .slice(0, 10);

    const worstUsers = [...scoreBase]
        .sort((a, b) => {
            const scoreDiff = Number(a.stats?.bestScore || 0) - Number(b.stats?.bestScore || 0);
            if (scoreDiff !== 0) return scoreDiff;

            const examsDiff = Number(a.stats?.exams || 0) - Number(b.stats?.exams || 0);
            if (examsDiff !== 0) return examsDiff;

            const wrongDiff = Number(b.stats?.wrong || 0) - Number(a.stats?.wrong || 0);
            if (wrongDiff !== 0) return wrongDiff;

            return (a.createdAtMs || 0) - (b.createdAtMs || 0);
        })
        .slice(0, 10);

    return {
        total,
        admins,
        students,
        active,
        disabled,
        withExams,
        withoutExams,
        withFavorites,
        withoutFavorites,
        firstUserMs,
        lastUserMs,
        todayUsers,
        weekUsers,
        monthUsers,
        totalCorrect,
        totalWrong,
        totalExams,
        totalFavorites,
        averageExams,
        bestScore,
        worstScore,
        averageScore,
        topUsers,
        worstUsers
    };
}

function buildCombinedQuestions(firestoreQuestions, jsonQuestions) {
    const fs = firestoreQuestions.map(q => ({ ...q, source: q.source || "firestore" }));
    const json = jsonQuestions.map(q => ({
        id: q.id || q.questionId || q.code || "",
        topic: q.topic || q.tema || "general",
        question: q.question || q.pregunta || "",
        options: Array.isArray(q.options) ? q.options : Array.isArray(q.answers) ? q.answers : [],
        correct: Number(q.correct ?? q.respuestaCorrecta ?? 0),
        explanation: q.explanation || q.explicacion || "",
        source: q.source || "json",
        createdAt: q.createdAt || null,
        updatedAt: q.updatedAt || null,
        stats: q.stats || {}
    }));

    return [...fs, ...json];
}

function buildQuestionMetrics(firestoreQuestions, jsonQuestions) {
    const combined = buildCombinedQuestions(firestoreQuestions, jsonQuestions);

    const byTopic = new Map();

    combined.forEach(q => {
        const key = prettyTopic(q.topic).toLowerCase();
        const current = byTopic.get(key) || {
            topic: prettyTopic(q.topic),
            count: 0,
            firestore: 0,
            json: 0
        };

        current.count += 1;
        if ((q.source || "").toLowerCase() === "json") current.json += 1;
        else current.firestore += 1;

        byTopic.set(key, current);
    });

    const topics = [...byTopic.values()].sort((a, b) => b.count - a.count);

    return {
        firestoreCount: firestoreQuestions.length,
        jsonCount: jsonQuestions.length,
        totalCount: firestoreQuestions.length + jsonQuestions.length,
        uniqueTopicsCount: topics.length,
        topics,
        combined
    };
}

function renderSimpleCards(containerId, cardsHtml, emptyTitle, emptySub = "") {
    const wrap = $(containerId);
    if (!wrap) return;

    if (!cardsHtml.length) {
        wrap.innerHTML = `
            <div class="admin-compact-card">
                <div class="admin-compact-title">${escapeHtml(emptyTitle)}</div>
                ${emptySub ? `<div class="admin-compact-sub">${escapeHtml(emptySub)}</div>` : ""}
            </div>
        `;
        return;
    }

    wrap.innerHTML = "";

    cardsHtml.forEach(html => {
        const card = document.createElement("div");
        card.className = "admin-compact-card";
        card.innerHTML = html;
        wrap.appendChild(card);
    });
}

function renderTopicsDistribution(topics) {
    const wrap = $("topicsDistribution");
    if (!wrap) return;

    if (!topics.length) {
        wrap.innerHTML = `
            <div class="admin-compact-card">
                <div class="admin-compact-title">Sin temas todavía</div>
                <div class="admin-compact-sub">No hay preguntas disponibles para agrupar por tema.</div>
            </div>
        `;
        return;
    }

    const max = topics[0].count || 1;
    wrap.innerHTML = "";

    topics.forEach(item => {
        const pct = Math.max(4, (item.count / max) * 100);

        const card = document.createElement("div");
        card.className = "admin-compact-card";
        card.innerHTML = `
            <div class="admin-compact-head">
                <div>
                    <div class="admin-compact-title">${escapeHtml(item.topic)}</div>
                    <div class="admin-compact-sub">
                        ${item.count} preguntas · Firestore ${item.firestore} · JSON ${item.json}
                    </div>
                </div>
                <div class="admin-pill good">${item.count}</div>
            </div>

            <div style="margin-top:12px;height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;">
                <div style="width:${pct}%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7fd0ff,#68ffb1);"></div>
            </div>
        `;

        wrap.appendChild(card);
    });
}

function renderTopUsers(users) {
    const cards = users.map((u, idx) => {
        return `
            <div class="admin-compact-head">
                <div>
                    <div class="admin-compact-title">#${idx + 1} ${escapeHtml(u.name || u.email || u.uid || "Sin nombre")}</div>
                    <div class="admin-compact-sub">
                        ${escapeHtml(u.email || "Sin correo")} · Alta: ${formatDate(u.createdAt)}
                    </div>
                </div>
                <div class="admin-pill good">${formatPercent(u.stats?.bestScore || 0)}</div>
            </div>

            <div class="admin-compact-pills">
                <span class="admin-pill">📝 Exámenes ${formatNumber(u.stats?.exams || 0)}</span>
                <span class="admin-pill">✅ Aciertos ${formatNumber(u.stats?.correct || 0)}</span>
                <span class="admin-pill">❌ Errores ${formatNumber(u.stats?.wrong || 0)}</span>
                <span class="admin-pill">⭐ Favoritas ${formatNumber(u.stats?.favorites || 0)}</span>
                <span class="admin-pill ${u.role === "admin" ? "good" : "warn"}">${u.role === "admin" ? "Admin" : "Alumno"}</span>
            </div>
        `;
    });

    renderSimpleCards("topUsersList", cards, "Sin ranking todavía", "Aún no hay suficientes datos de rendimiento.");
}

function renderWorstUsers(users) {
    const cards = users.map((u, idx) => {
        return `
            <div class="admin-compact-head">
                <div>
                    <div class="admin-compact-title">#${idx + 1} ${escapeHtml(u.name || u.email || u.uid || "Sin nombre")}</div>
                    <div class="admin-compact-sub">
                        ${escapeHtml(u.email || "Sin correo")} · Alta: ${formatDate(u.createdAt)}
                    </div>
                </div>
                <div class="admin-pill bad">${formatPercent(u.stats?.bestScore || 0)}</div>
            </div>

            <div class="admin-compact-pills">
                <span class="admin-pill">📝 Exámenes ${formatNumber(u.stats?.exams || 0)}</span>
                <span class="admin-pill">✅ Aciertos ${formatNumber(u.stats?.correct || 0)}</span>
                <span class="admin-pill">❌ Errores ${formatNumber(u.stats?.wrong || 0)}</span>
                <span class="admin-pill">⭐ Favoritas ${formatNumber(u.stats?.favorites || 0)}</span>
            </div>
        `;
    });

    renderSimpleCards("worstUsersList", cards, "Sin datos de rendimiento", "Todavía no hay alumnos con simulacros para clasificar.");
}

function renderDashboard() {
    const userMetrics = buildUserMetrics(state.users);
    const questionMetrics = buildQuestionMetrics(state.firestoreQuestions, state.jsonQuestions);

    setText("statUsersTotal", userMetrics.total);
    setText("statStudents", userMetrics.students);
    setText("statAdmins", userMetrics.admins);
    setText("statActive", userMetrics.active);
    setText("statDisabled", userMetrics.disabled);
    setText("statWithExams", userMetrics.withExams);
    setText("statWithoutExams", userMetrics.withoutExams);
    setText("statWithFavorites", userMetrics.withFavorites);

    setText("statExams", userMetrics.totalExams);
    setText("statCorrect", userMetrics.totalCorrect);
    setText("statWrong", userMetrics.totalWrong);
    setText("statFavorites", userMetrics.totalFavorites);
    setText("statAverageScore", formatPercent(userMetrics.averageScore));
    setText("statBestScore", formatPercent(userMetrics.bestScore));
    setText("statWorstScore", formatPercent(userMetrics.worstScore));
    setText("statAverageExams", formatDecimal(userMetrics.averageExams));

    setText("statFirstUser", formatDate(userMetrics.firstUserMs));
    setText("statLastUser", formatDate(userMetrics.lastUserMs));
    setText("statTodayUsers", userMetrics.todayUsers);
    setText("statWeekUsers", userMetrics.weekUsers);
    setText("statMonthUsers", userMetrics.monthUsers);

    setText("statQuestionsFirestore", questionMetrics.firestoreCount);
    setText("statQuestionsJson", questionMetrics.jsonCount);
    setText("statQuestionsTotal", questionMetrics.totalCount);
    setText("statTopics", questionMetrics.uniqueTopicsCount);

    renderTopicsDistribution(questionMetrics.topics);
    renderTopUsers(userMetrics.topUsers);
    renderWorstUsers(userMetrics.worstUsers);

    setMessage("Estadísticas cargadas correctamente.");
}

async function loadData() {
    const [usersSnap, questionsSnap, jsonQuestions] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "questions")),
        loadJsonQuestions()
    ]);

    state.users = usersSnap.docs.map(mapUserRecord);
    state.firestoreQuestions = questionsSnap.docs.map(mapQuestionRecord);
    state.jsonQuestions = jsonQuestions;
}

async function bootstrap() {
    try {
        await loadData();
        renderDashboard();
    } catch (error) {
        console.error(error);
        setMessage("❌ No se pudieron cargar las estadísticas.");
    }
}

onAuthStateChanged(auth, async user => {
    if (!user) return;

    const allowed = await checkAdmin(user);
    if (!allowed) {
        window.location.href = "index.html";
        return;
    }

    setText("adminUserEmail", `${prettyName(user)} · ${user.email}`);

    await bootstrap();
});
