import { auth, db } from "./firebase.js";
import {
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    collection,
    getDocs,
    setDoc,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import {
    getFunctions,
    httpsCallable
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-functions.js";

const ADMIN_EMAIL = "rayvf2002@gmail.com";
const PAGE = document.body?.dataset?.page || "";

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

function setBulkMessage(value) {
    setText("bulkUsersMessage", value);
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

function normalizeText(value = "") {
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
        name: data.displayName || data.name || "",
        role: data.role || "student",
        verified: Boolean(data.verified),
        disabled: Boolean(data.disabled),
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

    return { attempts, wrong, failRate, hasMetrics };
}

function getFunctionsInstance() {
    const app = auth?.app || db?.app || null;
    if (!app) {
        throw new Error("No se pudo obtener la instancia de Firebase App.");
    }
    return getFunctions(app, "us-central1");
}

function callAdminFunction(name, data) {
    const fn = httpsCallable(getFunctionsInstance(), name);
    return fn(data);
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

function parseCsvLine(line) {
    const out = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];

        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (ch === "," && !inQuotes) {
            out.push(current.trim());
            current = "";
            continue;
        }

        current += ch;
    }

    out.push(current.trim());
    return out;
}

function parseCsvText(text) {
    const cleaned = String(text || "").replace(/^\uFEFF/, "");
    const lines = cleaned
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (!lines.length) return [];

    const headers = parseCsvLine(lines[0]).map(h => h.trim());
    return lines.slice(1).map(line => {
        const cols = parseCsvLine(line);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = (cols[index] || "").trim();
        });
        return row;
    });
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

function renderHubSummary(usersCount, questionsCount, jsonCount) {
    setText("adminUsersCount", usersCount);
    setText("adminQuestionsCount", questionsCount);
    setText("adminJsonCount", jsonCount);
    setText("adminTotalCount", usersCount + questionsCount + jsonCount);
}

function renderUsersList(users) {
    const wrap = $("adminUserManagementList");
    if (!wrap) return;

    if (!users || users.length === 0) {
        wrap.innerHTML = `
            <div class="admin-compact-card">
                <div class="admin-compact-title">Sin usuarios</div>
                <div class="admin-compact-sub">Todavía no hay usuarios sincronizados.</div>
            </div>
        `;
        return;
    }

    const sorted = [...users].sort((a, b) => (b.lastLoginMs || 0) - (a.lastLoginMs || 0));
    wrap.innerHTML = "";

    sorted.forEach(user => {
        const card = document.createElement("div");
        card.className = "admin-compact-card";

        card.innerHTML = `
            <div class="admin-compact-head">
                <div>
                    <div class="admin-compact-title">${escapeHtml(user.name || user.email || user.uid || "Sin nombre")}</div>
                    <div class="admin-compact-sub">${escapeHtml(user.email || "Sin correo")} · UID ${escapeHtml(user.uid || user.docId)}</div>
                </div>
                <div class="admin-pill ${user.role === "admin" ? "good" : "warn"}">${user.role === "admin" ? "Admin" : "Alumno"}</div>
            </div>

            <div class="admin-compact-pills">
                <span class="admin-pill">🕒 Alta ${formatDate(user.createdAt)}</span>
                <span class="admin-pill">👁️ Último ${formatDate(user.lastLogin)}</span>
                <span class="admin-pill ${user.disabled ? "bad" : "good"}">${user.disabled ? "Desactivado" : "Activo"}</span>
                <span class="admin-pill">📊 Media ${formatPercent(user.stats.averageScore || 0)}</span>
            </div>

            <div style="display:grid;gap:10px;margin-top:14px;">
                <label style="display:grid;gap:6px;">
                    <span style="font-size:14px;opacity:.8;">Rol</span>
                    <select class="admin-role-select" data-uid="${escapeHtml(user.uid)}">
                        <option value="student" ${user.role !== "admin" ? "selected" : ""}>student</option>
                        <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
                    </select>
                </label>

                <div style="display:flex;flex-wrap:wrap;gap:10px;">
                    <button type="button" class="admin-mini-btn" data-action="save-role" data-uid="${escapeHtml(user.uid)}">💾 Guardar rol</button>
                    <button type="button" class="admin-mini-btn" data-action="reset-pass" data-email="${escapeHtml(user.email)}">🔑 Enviar reset</button>
                    <button type="button" class="admin-mini-btn ${user.disabled ? "good" : "danger"}" data-action="toggle-disabled" data-uid="${escapeHtml(user.uid)}" data-disabled="${user.disabled ? "1" : "0"}">
                        ${user.disabled ? "✅ Habilitar" : "⛔ Desactivar"}
                    </button>
                </div>
            </div>
        `;

        wrap.appendChild(card);
    });

    wrap.querySelectorAll('button[data-action="save-role"]').forEach(btn => {
        btn.onclick = async () => {
            const uid = btn.getAttribute("data-uid");
            const select = wrap.querySelector(`.admin-role-select[data-uid="${CSS.escape(uid)}"]`);
            const role = select ? select.value : "student";

            try {
                await callAdminFunction("setUserRoleAdmin", { uid, role });
                setMessage(`✅ Rol actualizado para ${uid}`);
                await loadAdminUsersPage();
            } catch (error) {
                console.error(error);
                setMessage("❌ No se pudo cambiar el rol.");
            }
        };
    });

    wrap.querySelectorAll('button[data-action="reset-pass"]').forEach(btn => {
        btn.onclick = async () => {
            const email = btn.getAttribute("data-email");
            if (!email) return;

            try {
                await sendPasswordResetEmail(auth, email);
                setMessage(`📩 Enviado correo de recuperación a ${email}`);
            } catch (error) {
                console.error(error);
                setMessage("❌ No se pudo enviar el correo de recuperación.");
            }
        };
    });

    wrap.querySelectorAll('button[data-action="toggle-disabled"]').forEach(btn => {
        btn.onclick = async () => {
            const uid = btn.getAttribute("data-uid");
            const disabled = btn.getAttribute("data-disabled") === "1";

            try {
                await callAdminFunction("setUserDisabledAdmin", { uid, disabled: !disabled });
                setMessage(disabled ? `✅ Usuario habilitado: ${uid}` : `⛔ Usuario desactivado: ${uid}`);
                await loadAdminUsersPage();
            } catch (error) {
                console.error(error);
                setMessage("❌ No se pudo cambiar el estado del usuario.");
            }
        };
    });
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

    const sorted = [...questions]
        .sort((a, b) => timestampToMs(b.createdAt || b.updatedAt) - timestampToMs(a.createdAt || a.updatedAt))
        .slice(0, 5);

    recentWrap.innerHTML = "";

    sorted.forEach(item => {
        const row = document.createElement("div");
        row.className = "admin-question-item";

        row.innerHTML = `
            <div class="admin-question-meta">
                <div class="admin-question-title">${escapeHtml(item.id || item.docId || "SIN ID")} · ${escapeHtml(item.topic || "general")}</div>
                <div class="admin-question-text">${escapeHtml(item.question || "(sin pregunta)")}</div>
            </div>

            <div class="admin-question-actions">
                <button type="button" class="admin-mini-btn" data-action="edit-question" data-id="${escapeHtml(item.docId)}">✏️ Editar</button>
                <button type="button" class="admin-mini-btn danger" data-action="delete-question" data-id="${escapeHtml(item.docId)}">🗑️ Borrar</button>
            </div>
        `;

        recentWrap.appendChild(row);
    });

    recentWrap.querySelectorAll('button[data-action="edit-question"]').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute("data-id");
            const q = cachedQuestions.find(item => item.docId === id);
            if (q) fillQuestionForm(q);
        };
    });

    recentWrap.querySelectorAll('button[data-action="delete-question"]').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute("data-id");
            if (!id) return;

            const q = cachedQuestions.find(item => item.docId === id);
            const label = q?.id || id;

            if (!confirm(`¿Borrar ${label}?`)) return;

            try {
                await deleteDoc(doc(db, "questions", id));
                setMessage(`🗑️ Pregunta borrada: ${label}`);
                await loadAdminQuestionsPage();
            } catch (error) {
                console.error(error);
                setMessage("❌ No se pudo borrar la pregunta.");
            }
        };
    });
}

function fillQuestionForm(question) {
    editingDocId = question.docId || null;
    editingQuestionId = question.id || "";
    editingCreatedAt = question.createdAt || question.updatedAt || null;

    const banner = $("editingBanner");
    const label = $("editingLabel");
    const saveBtn = $("saveQuestionBtn");

    if (banner) banner.style.display = "flex";
    if (label) label.textContent = question.id || question.docId || "(sin ID)";
    if (saveBtn) saveBtn.textContent = "💾 Actualizar pregunta";

    $("qId").value = question.id || "";
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

function resetQuestionForm() {
    const form = $("questionForm");
    if (form) form.reset();

    const source = $("qSource");
    if (source) source.value = "firestore";

    editingDocId = null;
    editingQuestionId = null;
    editingCreatedAt = null;

    const banner = $("editingBanner");
    const label = $("editingLabel");
    const saveBtn = $("saveQuestionBtn");

    if (banner) banner.style.display = "none";
    if (label) label.textContent = "";
    if (saveBtn) saveBtn.textContent = "💾 Guardar pregunta";

    setText("nextQuestionId", buildFirId(nextFirNumber));
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

async function loadAdminCounts() {
    const [questionsSnap, usersSnap, jsonQuestions] = await Promise.all([
        getDocs(collection(db, "questions")),
        getDocs(collection(db, "users")),
        loadJsonQuestions()
    ]);

    cachedQuestions = questionsSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
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

    return {
        usersCount: usersSnap.size,
        questionsCount: questionsSnap.size,
        jsonCount: jsonQuestions.length,
        users: cachedUsers,
        questions: cachedQuestions,
        jsonQuestions
    };
}

function renderQuestionStats(stats) {
    setText("adminQuestionsCount", stats.questionsCount);
    setText("adminJsonCount", stats.jsonCount);
    setText("adminTotalCount", stats.questionsCount + stats.jsonCount);
    setText("nextQuestionId", buildFirId(nextFirNumber));
    renderRecentQuestions(stats.questions);
}

async function loadAdminHub() {
    const stats = await loadAdminCounts();
    renderHubSummary(stats.usersCount, stats.questionsCount, stats.jsonCount);
}

async function loadAdminUsersPage() {
    const stats = await loadAdminCounts();
    const admins = stats.users.filter(u => u.role === "admin").length;
    const active = stats.users.filter(u => !u.disabled).length;

    setText("adminUsersCount", stats.usersCount);
    setText("adminAdminsCount", admins);
    setText("adminActiveUsersCount", active);
    setText("adminUsersLastUpdate", new Date().toLocaleString("es-ES"));

    renderUsersList(stats.users);
}

async function loadAdminQuestionsPage() {
    const stats = await loadAdminCounts();
    renderQuestionStats(stats);
    renderRecentQuestions(stats.questions);
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
        const docId = isEditing ? editingDocId : buildFirId(nextFirNumber);
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

        if (!isEditing) nextFirNumber += 1;

        resetQuestionForm();
        setMessage(isEditing ? `✅ Pregunta actualizada (${payloadId}).` : `✅ Pregunta guardada (${payloadId}).`);
        await loadAdminQuestionsPage();
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

            return item && (item.question || item.pregunta) && options.length >= 4;
        });

        if (!validItems.length) {
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

                batch.set(doc(db, "questions", payload.id), payload);
                imported += 1;
            });

            await batch.commit();
        }

        nextFirNumber = currentNumber;
        setText("nextQuestionId", buildFirId(nextFirNumber));
        setMessage(`📤 Importadas ${imported} preguntas correctamente.`);
        await loadAdminQuestionsPage();
    } catch (error) {
        console.error(error);
        setMessage(`❌ No se pudo importar el JSON: ${error.message || "error desconocido"}`);
    }
}

async function importUsersFromCsvFile(file) {
    const raw = await file.text();
    const rows = parseCsvText(raw);

    if (!rows.length) {
        throw new Error("El CSV está vacío.");
    }

    const payload = rows.map(row => ({
        displayName: row.displayName || row.name || row.nombre || "",
        email: row.email || row.mail || "",
        password: row.password || "",
        role: row.role || "student"
    }));

    const result = await callAdminFunction("bulkCreateUsersAdmin", { users: payload });
    const data = result.data || {};

    setBulkMessage(`✅ Importación finalizada. Creados: ${data.summary?.created ?? 0} · Existentes: ${data.summary?.skipped ?? 0} · Errores: ${data.summary?.failed ?? 0}`);
    await loadAdminUsersPage();
}

async function createSingleUser(event) {
    event.preventDefault();

    const displayName = normalizeText($("newUserName")?.value);
    const email = normalizeText($("newUserEmail")?.value).toLowerCase();
    const password = normalizeText($("newUserPassword")?.value);
    const role = $("newUserRole")?.value || "student";

    if (!displayName || !email) {
        setBulkMessage("❌ Faltan nombre o correo.");
        return;
    }

    try {
        const result = await callAdminFunction("createUserAdmin", { displayName, email, password, role });
        const data = result.data || {};

        setBulkMessage(`✅ Usuario creado: ${data.displayName || displayName} (${data.email || email}) · contraseña: ${data.password || "(autogenerada)"}`);

        const form = $("createUserForm");
        if (form) form.reset();

        await loadAdminUsersPage();
    } catch (error) {
        console.error(error);
        setBulkMessage(`❌ No se pudo crear el usuario: ${error?.message || "error desconocido"}`);
    }
}

async function wireCommonButtons() {
    const logoutBtn = $("adminLogoutBtn");
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            try {
                await signOut(auth);
                window.location.href = "login.html";
            } catch {
                setMessage("❌ No se pudo cerrar la sesión.");
                setBulkMessage("❌ No se pudo cerrar la sesión.");
            }
        };
    }
}

async function wireHubPage() {
    const reloadBtn = $("reloadStatsBtn");
    if (reloadBtn) {
        reloadBtn.onclick = async () => {
            await loadAdminHub();
            setMessage("🔄 Estadísticas actualizadas.");
        };
    }
}

async function wireUsersPage() {
    const reloadBtn = $("reloadUsersBtn");
    if (reloadBtn) {
        reloadBtn.onclick = async () => {
            await loadAdminUsersPage();
            setMessage("🔄 Usuarios actualizados.");
        };
    }

    const createUserForm = $("createUserForm");
    if (createUserForm) createUserForm.onsubmit = createSingleUser;

    const bulkUsersBtn = $("bulkUsersBtn");
    const bulkUsersInput = $("usersCsvInput");

    if (bulkUsersBtn && bulkUsersInput) {
        bulkUsersBtn.onclick = () => bulkUsersInput.click();
        bulkUsersInput.onchange = async () => {
            const file = bulkUsersInput.files?.[0];
            if (!file) return;

            try {
                await importUsersFromCsvFile(file);
                bulkUsersInput.value = "";
            } catch (error) {
                console.error(error);
                setBulkMessage(`❌ No se pudo importar el CSV: ${error?.message || "error desconocido"}`);
            }
        };
    }
}

async function wireQuestionsPage() {
    const reloadBtn = $("reloadQuestionsBtn");
    if (reloadBtn) {
        reloadBtn.onclick = async () => {
            await loadAdminQuestionsPage();
            setMessage("🔄 Preguntas actualizadas.");
        };
    }

    const form = $("questionForm");
    if (form) form.onsubmit = saveQuestionFromForm;

    const cancelEditBtn = $("cancelEditBtn");
    if (cancelEditBtn) {
        cancelEditBtn.onclick = () => {
            resetQuestionForm();
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
}

onAuthStateChanged(auth, async user => {
    if (!user) return;

    const allowed = await checkAdmin(user);
    if (!allowed) {
        window.location.href = "index.html";
        return;
    }

    setText("adminUserEmail", `${prettyName(user)} · ${user.email}`);

    await wireCommonButtons();

    try {
        if (PAGE === "admin") {
            await loadAdminHub();
            await wireHubPage();
        } else if (PAGE === "admin-users") {
            await loadAdminUsersPage();
            await wireUsersPage();
        } else if (PAGE === "admin-questions") {
            await loadAdminQuestionsPage();
            await wireQuestionsPage();
        }
    } catch (error) {
        console.error(error);
        setMessage("❌ Error cargando el panel de administración.");
        setBulkMessage("❌ Error cargando el panel de administración.");
    }
});
