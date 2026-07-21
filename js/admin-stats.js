import { auth, db } from "./firebase.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    collection,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const ADMIN_EMAIL = "rayvf2002@gmail.com";

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

function prettyName(user) {
    if (user?.displayName) return user.displayName;
    if (!user?.email) return "Administrador";

    return user.email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
}

function mapUserRecord(docSnap) {
    const data = docSnap.data() || {};
    const stats = data.stats || {};

    const lastLogin = data.lastLogin || data.updatedAt || data.createdAt || null;

    return {
        docId: docSnap.id,
        uid: data.uid || docSnap.id,
        email: data.email || "",
        name: data.displayName || data.name || "",
        role: data.role || "student",
        disabled: Boolean(data.disabled),
        verified: Boolean(data.verified),
        createdAt: data.createdAt || null,
        lastLogin,
        lastLoginMs: timestampToMs(lastLogin),
        stats: {
            correct: Number(stats.correct || 0),
            wrong: Number(stats.wrong || 0),
            exams: Number(stats.exams || 0),
            favorites: Number(stats.favorites || 0),
            bestScore: Number(stats.bestScore || 0)
        }
    };
}

async function loadJsonQuestions() {
    try {
        const response = await fetch("./data/questions.json?ts=" + Date.now());
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function totalFromUsers(users, field) {
    return users.reduce((acc, user) => acc + Number(user.stats?.[field] || 0), 0);
}

function averageScore(users) {
    const valid = users.filter(u => Number.isFinite(Number(u.stats?.bestScore)));
    if (!valid.length) return 0;
    const sum = valid.reduce((acc, u) => acc + Number(u.stats?.bestScore || 0), 0);
    return sum / valid.length;
}

function renderSimpleList(containerId, items, emptyText) {
    const wrap = $(containerId);
    if (!wrap) return;

    if (!items.length) {
        wrap.innerHTML = `
            <div class="admin-compact-card">
                <div class="admin-compact-title">${emptyText}</div>
            </div>
        `;
        return;
    }

    wrap.innerHTML = "";

    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "admin-compact-card";
        card.innerHTML = item;
        wrap.appendChild(card);
    });
}

async function loadStatsPage() {
    const [usersSnap, questionsSnap, jsonQuestions] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "questions")),
        loadJsonQuestions()
    ]);

    const users = usersSnap.docs.map(mapUserRecord);
    const questions = questionsSnap.docs.map(d => ({ docId: d.id, ...d.data() }));

    const admins = users.filter(u => u.role === "admin").length;
    const active = users.filter(u => !u.disabled).length;
    const verified = users.filter(u => u.verified).length;
    const disabled = users.filter(u => u.disabled).length;

    const totalCorrect = totalFromUsers(users, "correct");
    const totalWrong = totalFromUsers(users, "wrong");
    const totalExams = totalFromUsers(users, "exams");
    const totalFavorites = totalFromUsers(users, "favorites");
    const avgScore = averageScore(users);

    const firstAccessMs = users.reduce((min, u) => {
        const t = timestampToMs(u.createdAt || u.lastLogin);
        return t && (!min || t < min) ? t : min;
    }, 0);

    const lastAccessMs = users.reduce((max, u) => {
        const t = timestampToMs(u.lastLogin || u.createdAt);
        return t > max ? t : max;
    }, 0);

    const questionsWithMetrics = questions.map(q => {
        const stats = q.stats || {};
        const attempts = Number(stats.attempts || q.attempts || 0);
        const wrong = Number(stats.wrong || q.wrong || 0);
        const seen = Number(stats.seen || q.seen || 0);

        const failRate = attempts > 0 ? (wrong / attempts) * 100 : 0;

        return {
            ...q,
            attempts,
            wrong,
            seen,
            failRate
        };
    });

    const worstQuestions = [...questionsWithMetrics]
        .sort((a, b) => (b.failRate || 0) - (a.failRate || 0))
        .slice(0, 10);

    const bestUsers = [...users]
        .sort((a, b) => {
            const scoreDiff = Number(b.stats.bestScore || 0) - Number(a.stats.bestScore || 0);
            if (scoreDiff !== 0) return scoreDiff;
            return Number(b.stats.exams || 0) - Number(a.stats.exams || 0);
        })
        .slice(0, 10);

    const worstUsers = [...users]
        .sort((a, b) => {
            const scoreDiff = Number(a.stats.bestScore || 0) - Number(b.stats.bestScore || 0);
            if (scoreDiff !== 0) return scoreDiff;
            return Number(a.stats.exams || 0) - Number(b.stats.exams || 0);
        })
        .slice(0, 10);

    const topUsersHtml = bestUsers.map((u, idx) => `
        <div class="admin-compact-head">
            <div>
                <div class="admin-compact-title">#${idx + 1} ${escapeHtml(u.name || u.email || u.uid || "Sin nombre")}</div>
                <div class="admin-compact-sub">${escapeHtml(u.email || "Sin correo")} · Último acceso: ${formatDate(u.lastLogin)}</div>
            </div>
            <div class="admin-pill good">${formatPercent(u.stats.bestScore || 0)}</div>
        </div>
        <div class="admin-compact-pills">
            <span class="admin-pill">📝 Exámenes ${Number(u.stats.exams || 0)}</span>
            <span class="admin-pill">✅ Aciertos ${Number(u.stats.correct || 0)}</span>
            <span class="admin-pill">❌ Errores ${Number(u.stats.wrong || 0)}</span>
            <span class="admin-pill">⭐ Favoritas ${Number(u.stats.favorites || 0)}</span>
        </div>
    `);

    const worstUsersHtml = worstUsers.map((u, idx) => `
        <div class="admin-compact-head">
            <div>
                <div class="admin-compact-title">#${idx + 1} ${escapeHtml(u.name || u.email || u.uid || "Sin nombre")}</div>
                <div class="admin-compact-sub">${escapeHtml(u.email || "Sin correo")} · Último acceso: ${formatDate(u.lastLogin)}</div>
            </div>
            <div class="admin-pill bad">${formatPercent(u.stats.bestScore || 0)}</div>
        </div>
        <div class="admin-compact-pills">
            <span class="admin-pill">📝 Exámenes ${Number(u.stats.exams || 0)}</span>
            <span class="admin-pill">✅ Aciertos ${Number(u.stats.correct || 0)}</span>
            <span class="admin-pill">❌ Errores ${Number(u.stats.wrong || 0)}</span>
            <span class="admin-pill">⭐ Favoritas ${Number(u.stats.favorites || 0)}</span>
        </div>
    `);

    const worstQuestionsHtml = worstQuestions.length
        ? worstQuestions.map((q, idx) => `
            <div class="admin-compact-head">
                <div>
                    <div class="admin-compact-title">#${idx + 1} ${escapeHtml(q.id || q.docId || "SIN ID")} · ${escapeHtml(q.topic || "general")}</div>
                    <div class="admin-compact-sub">${escapeHtml(q.question || "(sin pregunta)")}</div>
                </div>
                <div class="admin-pill ${q.failRate > 50 ? "bad" : "warn"}">${formatPercent(q.failRate)} fallos</div>
            </div>
            <div class="admin-compact-pills">
                <span class="admin-pill">🧮 Intentos ${Number(q.attempts || 0)}</span>
                <span class="admin-pill">❌ Fallos ${Number(q.wrong || 0)}</span>
                <span class="admin-pill">👀 Vistas ${Number(q.seen || 0)}</span>
            </div>
        `)
        : [
            `
            <div class="admin-compact-title">Sin métricas aún</div>
            <div class="admin-compact-sub">Todavía no hay datos suficientes de preguntas.</div>
            `
        ];

    setText("statUsersTotal", users.length);
    setText("statUsersActive", active);
    setText("statUsersAdmin", admins);
    setText("statUsersVerified", verified);

    setText("statCorrect", totalCorrect);
    setText("statWrong", totalWrong);
    setText("statExams", totalExams);
    setText("statAvgScore", formatPercent(avgScore));

    setText("statLastAccess", formatDate(lastAccessMs));
    setText("statFirstAccess", formatDate(firstAccessMs));
    setText("statDisabledUsers", disabled);
    setText("statFavorites", totalFavorites);

    setText("statQuestionsFs", questions.length);
    setText("statQuestionsJson", jsonQuestions.length);
    setText("statQuestionsTotal", questions.length + jsonQuestions.length);

    const mostSeenQuestion = [...questionsWithMetrics]
        .sort((a, b) => (b.seen || 0) - (a.seen || 0))[0];

    setText(
        "statMostSeenQuestion",
        mostSeenQuestion
            ? `${mostSeenQuestion.id || mostSeenQuestion.docId || "SIN ID"} · ${mostSeenQuestion.topic || "general"}`
            : "—"
    );

    renderSimpleList("topUsersList", topUsersHtml, "Sin datos de ranking");
    renderSimpleList("worstUsersList", worstUsersHtml, "Sin datos de usuarios");
    renderSimpleList("worstQuestionsList", worstQuestionsHtml, "Sin datos de preguntas");

    setMessage("Estadísticas cargadas correctamente.");
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

onAuthStateChanged(auth, async user => {
    if (!user) return;

    const allowed = await checkAdmin(user);
    if (!allowed) {
        window.location.href = "index.html";
        return;
    }

    setText("adminUserEmail", `${prettyName(user)} · ${user.email}`);

    try {
        await loadStatsPage();
    } catch (error) {
        console.error(error);
        setMessage("❌ No se pudieron cargar las estadísticas.");
    }
});
