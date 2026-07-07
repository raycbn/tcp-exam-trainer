import { auth, db } from "./firebase.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    collection,
    getDocs,
    setDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const ADMIN_EMAIL = "rayvf2002@gmail.com";

let nextFirNumber = 1;
let editingDocId = null;
let editingQuestionId = null;
let editingCreatedAt = null;

let cachedQuestions = [];
let cachedUsers = [];

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

function normalizeText(value) {
    return String(value || "").trim();
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

function buildFirId(number) {
    return `FIR-${String(number).padStart(3, "0")}`;
}

function extractFirNumber(id) {
    const match = String(id || "").trim().match(/^FIR-(\d+)$/i);
    return match ? Number(match[1]) : null;
}

function computeNextFirNumber(ids) {
    let max = 0;

    ids.forEach(id => {
        const num = extractFirNumber(id);
        if (num && num > max) max = num;
    });

    return max + 1;
}

function normalizeQuestionPayload({
    id,
    topic,
    question,
    options,
    correct,
    explanation,
    source,
    image,
    createdAt = null
}) {
    const now = serverTimestamp();

    return {
        id,
        topic: normalizeText(topic).toLowerCase(),
        question: normalizeText(question),
        options: (options || []).map(opt => normalizeText(opt)),
        correct: Number(correct),
        explanation: normalizeText(explanation),
        source: normalizeText(source) || "firestore",
        image: normalizeText(image) || "",
        createdAt: createdAt || now,
        updatedAt: now
    };
}

function mapUserRecord(docSnap) {
    const data = docSnap.data() || {};
    const stats = data.stats || {};

    const lastLogin = data.lastLogin || data.updatedAt || data.createdAt || null;

    return {
        docId: docSnap.id,
        uid: data.uid || docSnap.id,
        email: data.email || "",
        name: data.name || "",
        role: data.role || "",
        verified: Boolean(data.verified),
        createdAt: data.createdAt || null,
        lastLogin,
        lastLoginMs: timestampToMs(lastLogin),
        stats: {
            testsDone: Number(stats.testsDone ?? stats.tests ?? stats.exams ?? 0),
            averageScore: Number(stats.averageScore ?? stats.average ?? stats.mean ?? 0),
            questionsDone: Number(stats.questionsDone ?? 0),
            correct: Number(stats.correct ?? 0),
            wrong: Number(stats.wrong ?? 0)
        }
    };
}

function questionMetrics(question) {
    const stats = question.stats || {};

    const attempts = Number(stats.attempts ?? question.attempts ?? 0);
    const wrong = Number(stats.wrong ?? question.wrong ?? stats.mistakes ?? question.mistakes ?? 0);

    const failRate = attempts > 0
        ? (wrong / attempts) * 100
        : Number(stats.failRate ?? question.failRate ?? stats.difficulty ?? question.difficulty ?? 0);

    const hasMetrics = attempts > 0 || wrong > 0 || failRate > 0;

    return {
        attempts,
        wrong,
        failRate,
        hasMetrics
    };
}

async function loadJsonQuestions() {
    try {
        const response = await fetch("./data/questions.json?ts=" + Date.now());
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Error leyendo questions.json", error);
        return [];
    }
}

function renderRecentQuestions(questions) {
    const recentWrap = $("recentQuestions");
    if (!recentWrap) return;

    if (!questions || questions.length === 0) {
        recentWrap.innerHTML = `
            <div class="admin-compact-card">
                <div class="admin-compact-title">Sin preguntas</div>
                <div class="admin-compact-sub">Todavía no hay preguntas en Firestore.</div>
            </div>
        `;
        return;
    }

    const sorted = [...questions].sort((a, b) => {
        const at = timestampToMs(a.createdAt || a.updatedAt);
        const bt = timestampToMs(b.createdAt || b.updatedAt);
        return bt - at;
    }).slice(0, 5);

    recentWrap.innerHTML = "";

    sorted.forEach(item => {
        const row = document.createElement("div");
        row.className = "admin-question-item";

        const left = document.createElement("div");
        left.className = "admin-question-meta";

        const title = document.createElement("div");
        title.className = "admin-question-title";
        title.textContent = `${item.id || item.docId || "SIN ID"} · ${item.topic || "general"}`;

        const questionText = document.createElement("div");
        questionText.className = "admin-question-text";
        questionText.textContent = item.question || "(sin pregunta)";

        left.appendChild(title);
        left.appendChild(questionText);

        const actions = document.createElement("div");
        actions.className = "admin-question-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "admin-mini-btn";
        editBtn.textContent = "✏️ Editar";
        editBtn.onclick = () => startEditQuestion(item.docId, item);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "admin-mini-btn danger";
        deleteBtn.textContent = "🗑️ Borrar";
        deleteBtn.onclick = () => deleteQuestion(item.docId, item);

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        row.appendChild(left);
        row.appendChild(actions);

        recentWrap.appendChild(row);
    });
}

function renderUsersList(users) {
    const wrap = $("adminUsersList");
    if (!wrap) return;

    if (!users.length) {
        wrap.innerHTML = `
            <div class="admin-compact-card">
                <div class="admin-compact-title">Sin usuarios</div>
                <div class="admin-compact-sub">Aún no hay usuarios sincronizados.</div>
            </div>
        `;
        return;
    }

    const sorted = [...users].sort((a, b) => {
        const scoreDiff = (b.stats.averageScore || 0) - (a.stats.averageScore || 0);
        if (scoreDiff !== 0) return scoreDiff;

        const testsDiff = (b.stats.testsDone || 0) - (a.stats.testsDone || 0);
        if (testsDiff !== 0) return testsDiff;

        return (b.lastLoginMs || 0) - (a.lastLoginMs || 0);
    }).slice(0, 10);

    wrap.innerHTML = "";

    sorted.forEach((user, index) => {
        const card = document.createElement("div");
        card.className = "admin-compact-card";

        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;

        card.innerHTML = `
            <div class="admin-compact-head">
                <div>
                    <div class="admin-compact-title">${medal} ${escapeHtml(user.name || user.email || user.uid || "Sin nombre")}</div>
                    <div class="admin-compact-sub">${escapeHtml(user.email || "Sin correo")} · UID ${escapeHtml(user.uid || user.docId)}</div>
                </div>
                <div class="admin-pill ${user.role === "admin" ? "good" : "warn"}">
                    ${user.role === "admin" ? "Admin" : "Alumno"}
                </div>
            </div>

            <div class="admin-compact-pills">
                <span class="admin-pill">📝 Tests ${Number(user.stats.testsDone || 0)}</span>
                <span class="admin-pill">📊 Media ${formatPercent(user.stats.averageScore || 0)}</span>
                <span class="admin-pill">📚 Preguntas ${Number(user.stats.questionsDone || 0)}</span>
                <span class="admin-pill ${user.verified ? "good" : "warn"}">
                    ${user.verified ? "✅ Verificado" : "⚠️ Sin verificar"}
                </span>
                <span class="admin-pill">🕒 Último: ${formatDate(user.lastLogin)}</span>
            </div>
        `;

        wrap.appendChild(card);
    });
}

function renderRanking(users) {
    const wrap = $("adminRankingList");
    if (!wrap) return;

    if (!users.length) {
        wrap.innerHTML = `
            <div class="admin-compact-card">
                <div class="admin-compact-title">Sin ranking todavía</div>
                <div class="admin-compact-sub">Aún no hay usuarios sincronizados con estadísticas.</div>
            </div>
        `;
        return;
    }

    const ranking = [...users].sort((a, b) => {
        const scoreDiff = (b.stats.averageScore || 0) - (a.stats.averageScore || 0);
        if (scoreDiff !== 0) return scoreDiff;

        const testsDiff = (b.stats.testsDone || 0) - (a.stats.testsDone || 0);
        if (testsDiff !== 0) return testsDiff;

        return (b.stats.correct || 0) - (a.stats.correct || 0);
    }).slice(0, 10);

    wrap.innerHTML = "";

    ranking.forEach((user, index) => {
        const card = document.createElement("div");
        card.className = "admin-compact-card";

        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;

        card.innerHTML = `
            <div class="admin-compact-head">
                <div>
                    <div class="admin-compact-title">${medal} ${escapeHtml(user.name || user.email || user.uid || "Sin nombre")}</div>
                    <div class="admin-compact-sub">${escapeHtml(user.email || "Sin correo")}</div>
                </div>
                <div class="admin-pill good">
                    ${formatPercent(user.stats.averageScore || 0)}
                </div>
            </div>

            <div class="admin-compact-pills">
                <span class="admin-pill">📝 Tests ${Number(user.stats.testsDone || 0)}</span>
                <span class="admin-pill">✅ Aciertos ${Number(user.stats.correct || 0)}</span>
                <span class="admin-pill">❌ Errores ${Number(user.stats.wrong || 0)}</span>
                <span class="admin-pill">🕒 Último: ${formatDate(user.lastLogin)}</span>
            </div>
        `;

        wrap.appendChild(card);
    });
}

function renderHardQuestions(questions) {
    const wrap = $("adminHardQuestionsList");
    if (!wrap) return;

    if (!questions || questions.length === 0) {
        wrap.innerHTML = `
            <div class="admin-compact-card">
                <div class="admin-compact-title">Sin preguntas</div>
                <div class="admin-compact-sub">No hay preguntas en Firestore todavía.</div>
            </div>
        `;
        return;
    }

    const scored = questions.map(q => {
        const metrics = questionMetrics(q);
        return {
            ...q,
            ...metrics
        };
    });

    const withMetrics = scored
        .filter(q => q.hasMetrics)
        .sort((a, b) => {
            const diff = (b.failRate || 0) - (a.failRate || 0);
            if (diff !== 0) return diff;
            return (b.attempts || 0) - (a.attempts || 0);
        })
        .slice(0, 5);

    const list = withMetrics.length > 0
        ? withMetrics
        : [...questions]
            .sort((a, b) => {
                const at = timestampToMs(a.createdAt || a.updatedAt);
                const bt = timestampToMs(b.createdAt || b.updatedAt);
                return bt - at;
            })
            .slice(0, 5)
            .map(q => ({ ...q, hasMetrics: false, failRate: 0, attempts: 0, wrong: 0 }));

    wrap.innerHTML = "";

    list.forEach(item => {
        const card = document.createElement("div");
        card.className = "admin-compact-card";

        card.innerHTML = `
            <div class="admin-compact-head">
                <div>
                    <div class="admin-compact-title">${escapeHtml(item.id || item.docId || "SIN ID")} · ${escapeHtml(item.topic || "general")}</div>
                    <div class="admin-compact-sub">${escapeHtml(item.question || "(sin pregunta)")}</div>
                </div>
                <div class="admin-pill ${item.hasMetrics ? "bad" : "warn"}">
                    ${item.hasMetrics ? `${formatPercent(item.failRate)} fallos` : "Sin métricas"}
                </div>
            </div>

            <div class="admin-compact-pills">
                <span class="admin-pill">🧮 Intentos ${Number(item.attempts || 0)}</span>
                <span class="admin-pill">❌ Fallos ${Number(item.wrong || 0)}</span>
                <span class="admin-pill">${item.hasMetrics ? "📈 Métrica real" : "⚠️ Pendiente de telemetría"}</span>
            </div>
        `;

        wrap.appendChild(card);
    });
}

function buildNextQuestionId() {
    return buildFirId(nextFirNumber);
}

function resetForm() {
    const form = $("questionForm");
    if (form) form.reset();

    const source = $("qSource");
    if (source) source.value = "firestore";

    editingDocId = null;
    editingQuestionId = null;
    editingCreatedAt = null;

    const banner = $("editingBanner");
    if (banner) banner.style.display = "none";

    const label = $("editingLabel");
    if (label) label.textContent = "";

    const saveBtn = $("saveQuestionBtn");
    if (saveBtn) saveBtn.textContent = "💾 Guardar pregunta";

    setText("nextQuestionId", buildNextQuestionId());
}

function startEditQuestion(docId, question) {
    editingDocId = docId;
    editingQuestionId = question.id || "";
    editingCreatedAt = question.createdAt || question.updatedAt || null;

    const banner = $("editingBanner");
    const label = $("editingLabel");
    const saveBtn = $("saveQuestionBtn");

    if (banner) banner.style.display = "flex";
    if (label) label.textContent = question.id || docId || "(sin ID)";
    if (saveBtn) saveBtn.textContent = "💾 Actualizar pregunta";

    $("qTopic").value = question.topic || "";
    $("qQuestion").value = question.question || "";
    $("qA").value = question.options?.[0] || "";
    $("qB").value = question.options?.[1] || "";
    $("qC").value = question.options?.[2] || "";
    $("qD").value = question.options?.[3] || "";
    $("qCorrect").value = String(question.correct ?? 0);
    $("qImage").value = question.image || "";
    $("qExplanation").value = question.explanation || "";
    $("qSource").value = question.source || "firestore";
}

async function deleteQuestion(docId, question) {
    const label = question?.id || docId || "esta pregunta";

    if (!confirm(`¿Borrar ${label}?`)) return;

    try {
        await deleteDoc(doc(db, "questions", docId));
        setMessage(`🗑️ Pregunta borrada: ${label}`);
        await loadStats();
    } catch (error) {
        console.error(error);
        setMessage("❌ No se pudo borrar la pregunta.");
    }
}

async function saveQuestionFromForm(event) {
    event.preventDefault();

    try {
        const topic = normalizeText($("qTopic")?.value);
        const question = normalizeText($("qQuestion")?.value);
        const qA = normalizeText($("qA")?.value);
        const qB = normalizeText($("qB")?.value);
        const qC = normalizeText($("qC")?.value);
        const qD = normalizeText($("qD")?.value);
        const correct = Number($("qCorrect")?.value ?? 0);
        const image = normalizeText($("qImage")?.value);
        const explanation = normalizeText($("qExplanation")?.value);
        const source = normalizeText($("qSource")?.value) || "firestore";

        const isEditing = Boolean(editingDocId);
        const docId = isEditing ? editingDocId : buildNextQuestionId();
        const payloadId = isEditing ? (editingQuestionId || docId) : docId;

        const payload = normalizeQuestionPayload({
            id: payloadId,
            topic,
            question,
            options: [qA, qB, qC, qD],
            correct,
            explanation,
            source,
            image,
            createdAt: editingCreatedAt
        });

        await setDoc(doc(db, "questions", docId), payload);

        if (!isEditing) {
            nextFirNumber += 1;
        }

        resetForm();
        setMessage(isEditing
            ? `✅ Pregunta actualizada (${payloadId}).`
            : `✅ Pregunta guardada correctamente (${payloadId}).`
        );

        await loadStats();
    } catch (error) {
        console.error(error);
        setMessage("❌ No se pudo guardar la pregunta.");
    }
}

async function importQuestionsFromFile(file) {
    try {
        const raw = await file.text();
        const parsed = JSON.parse(raw);

        const questionsArray = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.questions)
                ? parsed.questions
                : null;

        if (!questionsArray) {
            throw new Error("El JSON debe ser un array o tener la propiedad questions.");
        }

        const validItems = questionsArray.filter(item => {
            const options = Array.isArray(item?.options)
                ? item.options
                : Array.isArray(item?.answers)
                    ? item.answers
                    : [];

            return (
                item &&
                (item.question || item.pregunta) &&
                options.length >= 4
            );
        });

        if (validItems.length === 0) {
            throw new Error("No se encontraron preguntas válidas para importar.");
        }

        let currentNumber = nextFirNumber;
        const chunkSize = 400;
        let imported = 0;

        for (let i = 0; i < validItems.length; i += chunkSize) {
            const batch = writeBatch(db);
            const chunk = validItems.slice(i, i + chunkSize);

            chunk.forEach(item => {
                const options = Array.isArray(item.options)
                    ? item.options
                    : Array.isArray(item.answers)
                        ? item.answers
                        : [];

                const payload = normalizeQuestionPayload({
                    id: buildFirId(currentNumber++),
                    topic: item.topic ?? item.tema ?? "general",
                    question: item.question ?? item.pregunta ?? "",
                    options,
                    correct: item.correct ?? item.respuestaCorrecta ?? 0,
                    explanation: item.explanation ?? item.explication ?? item.explicacion ?? "",
                    source: item.source || "firestore",
                    image: item.image ?? item.imagen ?? ""
                });

                const ref = doc(db, "questions", payload.id);
                batch.set(ref, payload);
                imported += 1;
            });

            await batch.commit();
        }

        nextFirNumber = currentNumber;
        setText("nextQuestionId", buildNextQuestionId());

        setMessage(`📤 Importadas ${imported} preguntas correctamente.`);
        await loadStats();
    } catch (error) {
        console.error(error);
        setMessage("❌ No se pudo importar el JSON.");
    }
}

async function loadStats() {
    try {
        const [questionsSnap, usersSnap, jsonQuestions] = await Promise.all([
            getDocs(collection(db, "questions")),
            getDocs(collection(db, "users")),
            loadJsonQuestions()
        ]);

        cachedQuestions = questionsSnap.docs.map(d => ({
            docId: d.id,
            ...d.data()
        }));

        cachedUsers = usersSnap.docs.map(mapUserRecord);

        const allIds = [];

        cachedQuestions.forEach(q => {
            if (q.id) allIds.push(String(q.id));
            if (q.docId) allIds.push(String(q.docId));
        });

        jsonQuestions.forEach(q => {
            if (q?.id) allIds.push(String(q.id));
        });

        nextFirNumber = computeNextFirNumber(allIds);
        setText("nextQuestionId", buildNextQuestionId());

        setText("adminUsersCount", usersSnap.size);
        setText("adminQuestionsCount", questionsSnap.size);
        setText("adminJsonCount", jsonQuestions.length);
        setText("adminTotalCount", jsonQuestions.length + questionsSnap.size);

        renderRecentQuestions(cachedQuestions);
        renderUsersList(cachedUsers);
        renderHardQuestions(cachedQuestions);
        renderRanking(cachedUsers);
    } catch (error) {
        console.error(error);
        setMessage("❌ No se pudieron cargar las estadísticas.");
    }
}

async function reloadStats() {
    await loadStats();
    setMessage("🔄 Estadísticas actualizadas.");
}

onAuthStateChanged(auth, async user => {
    if (!user) return;

    if (user.email !== ADMIN_EMAIL) {
        window.location.href = "index.html";
        return;
    }

    setText("adminUserEmail", `${prettyName(user)} · ${user.email}`);
    await loadStats();
});

const reloadBtn = $("reloadStatsBtn");
if (reloadBtn) {
    reloadBtn.onclick = reloadStats;
}

const logoutBtn = $("adminLogoutBtn");
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        try {
            await signOut(auth);
            window.location.href = "login.html";
        } catch {
            setMessage("❌ No se pudo cerrar la sesión.");
        }
    };
}

const form = $("questionForm");
if (form) {
    form.onsubmit = saveQuestionFromForm;
}

const cancelEditBtn = $("cancelEditBtn");
if (cancelEditBtn) {
    cancelEditBtn.onclick = () => {
        resetForm();
        setMessage("Edición cancelada.");
    };
}

const importBtn = $("importQuestionsBtn");
const importInput = $("importQuestionsInput");

if (importBtn && importInput) {
    importBtn.onclick = () => importInput.click();

    importInput.onchange = async () => {
        const file = importInput.files?.[0];
        if (!file) return;

        await importQuestionsFromFile(file);
        importInput.value = "";
    };
}
