import { auth, db } from "./firebase.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    query,
    orderBy,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const ADMIN_EMAIL = "rayvf2002@gmail.com";
const JSON_QUESTIONS_COUNT = 1219;

let nextFirNumber = 1;
let editingDocId = null;
let editingQuestionId = null;

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

function normalizeText(value) {
    return String(value || "").trim();
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
    image
}) {
    return {
        id,
        topic: normalizeText(topic).toLowerCase(),
        question: normalizeText(question),
        options: options.map(opt => normalizeText(opt)),
        correct: Number(correct),
        explanation: normalizeText(explanation),
        source: normalizeText(source) || "firestore",
        image: normalizeText(image) || "",
        createdAt: serverTimestamp()
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

async function loadStats() {
    try {
        const [questionsSnap, usersSnap, jsonQuestions] = await Promise.all([
            getDocs(collection(db, "questions")),
            getDocs(collection(db, "users")),
            loadJsonQuestions()
        ]);

        const firestoreQuestions = [];
        const allIds = [];

        questionsSnap.forEach(d => {
            const data = d.data();
            firestoreQuestions.push({
                docId: d.id,
                ...data
            });

            if (data?.id) allIds.push(String(data.id));
            allIds.push(String(d.id));
        });

        jsonQuestions.forEach(q => {
            if (q?.id) allIds.push(String(q.id));
        });

        const firestoreQuestionsCount = questionsSnap.size;
        const usersCount = usersSnap.size;
        const total = JSON_QUESTIONS_COUNT + firestoreQuestionsCount;

        nextFirNumber = computeNextFirNumber(allIds);
        setText("nextQuestionId", buildFirId(nextFirNumber));

        setText("adminUsersCount", usersCount);
        setText("adminQuestionsCount", firestoreQuestionsCount);
        setText("adminJsonCount", JSON_QUESTIONS_COUNT);
        setText("adminTotalCount", total);

        renderRecentQuestions(firestoreQuestions);
    } catch (error) {
        console.error(error);
        setMessage("❌ No se pudieron cargar las estadísticas.");
    }
}

function renderRecentQuestions(questions) {
    const recentWrap = $("recentQuestions");
    if (!recentWrap) return;

    if (!questions || questions.length === 0) {
        recentWrap.innerHTML = `
            <div class="activity-line">
                <span class="activity-label">Estado</span>
                <span class="activity-value">No hay preguntas nuevas en Firestore todavía.</span>
            </div>
        `;
        return;
    }

    const sorted = [...questions].sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
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

function resetForm() {
    const form = $("questionForm");
    if (form) form.reset();

    const source = $("qSource");
    if (source) source.value = "firestore";

    editingDocId = null;
    editingQuestionId = null;

    const banner = $("editingBanner");
    if (banner) banner.style.display = "none";

    const label = $("editingLabel");
    if (label) label.textContent = "";

    const saveBtn = $("saveQuestionBtn");
    if (saveBtn) saveBtn.textContent = "💾 Guardar pregunta";

    setText("nextQuestionId", buildFirId(nextFirNumber));
}

function startEditQuestion(docId, question) {
    editingDocId = docId;
    editingQuestionId = question.id || "";

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
        const id = isEditing
            ? (editingQuestionId || buildFirId(nextFirNumber))
            : buildFirId(nextFirNumber);

        const payload = normalizeQuestionPayload({
            id,
            topic,
            question,
            options: [qA, qB, qC, qD],
            correct,
            explanation,
            source,
            image
        });

        if (isEditing) {
            await updateDoc(doc(db, "questions", editingDocId), payload);
            setMessage(`✅ Pregunta actualizada (${id}).`);
        } else {
            await addDoc(collection(db, "questions"), payload);
            nextFirNumber += 1;
            setText("nextQuestionId", buildFirId(nextFirNumber));
            setMessage(`✅ Pregunta guardada correctamente (${id}).`);
        }

        resetForm();
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

        const validItems = questionsArray.filter(item =>
            item &&
            item.question &&
            Array.isArray(item.options) &&
            item.options.length >= 4
        );

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
                const payload = normalizeQuestionPayload({
                    id: buildFirId(currentNumber++),
                    topic: item.topic || "general",
                    question: item.question,
                    options: item.options,
                    correct: item.correct ?? 0,
                    explanation: item.explanation || "",
                    source: item.source || "firestore",
                    image: item.image || ""
                });

                const ref = doc(collection(db, "questions"));
                batch.set(ref, payload);
                imported += 1;
            });

            await batch.commit();
        }

        nextFirNumber = currentNumber;
        setText("nextQuestionId", buildFirId(nextFirNumber));

        setMessage(`📤 Importadas ${imported} preguntas correctamente.`);
        await loadStats();
    } catch (error) {
        console.error(error);
        setMessage("❌ No se pudo importar el JSON.");
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
