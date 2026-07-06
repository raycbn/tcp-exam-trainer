import { auth, db } from "./firebase.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    collection,
    getDocs,
    addDoc,
    serverTimestamp,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const ADMIN_EMAIL = "rayvf2002@gmail.com";
const JSON_QUESTIONS_COUNT = 1219;

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

function prettyName(user) {
    if (user?.displayName) return user.displayName;
    if (!user?.email) return "Administrador";
    return user.email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeText(value) {
    return String(value || "").trim();
}

function buildQuestionId(topic) {
    const prefix = normalizeText(topic)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 12) || "Q";

    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `FIR-${prefix}-${rand}`;
}

async function loadStats() {
    try {
        const questionsSnap = await getDocs(collection(db, "questions"));
        const usersSnap = await getDocs(collection(db, "users"));

        const firestoreQuestionsCount = questionsSnap.size;
        const usersCount = usersSnap.size;
        const total = JSON_QUESTIONS_COUNT + firestoreQuestionsCount;

        setText("adminUsersCount", usersCount);
        setText("adminQuestionsCount", firestoreQuestionsCount);
        setText("adminJsonCount", JSON_QUESTIONS_COUNT);
        setText("adminTotalCount", total);

        const recentWrap = $("recentQuestions");
        if (recentWrap) {
            const recentQuery = query(
                collection(db, "questions"),
                orderBy("createdAt", "desc"),
                limit(5)
            );

            const recentSnap = await getDocs(recentQuery);

            if (recentSnap.empty) {
                recentWrap.innerHTML = `
                    <div class="activity-line">
                        <span class="activity-label">Estado</span>
                        <span class="activity-value">No hay preguntas nuevas en Firestore todavía.</span>
                    </div>
                `;
            } else {
                recentWrap.innerHTML = "";
                recentSnap.forEach(doc => {
                    const q = doc.data();
                    const row = document.createElement("div");
                    row.className = "activity-line";
                    row.innerHTML = `
                        <span class="activity-label">${q.topic || "General"}</span>
                        <span class="activity-value">${q.id || doc.id}</span>
                    `;
                    recentWrap.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error(error);
        setMessage("❌ No se pudieron cargar las estadísticas.");
    }
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
    reloadBtn.onclick = loadStats;
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
    form.onsubmit = async (e) => {
        e.preventDefault();

        try {
            const topic = normalizeText($("qTopic")?.value);
            const question = normalizeText($("qQuestion")?.value);
            const qA = normalizeText($("qA")?.value);
            const qB = normalizeText($("qB")?.value);
            const qC = normalizeText($("qC")?.value);
            const qD = normalizeText($("qD")?.value);
            const correct = Number($("qCorrect")?.value ?? 0);
            const explanation = normalizeText($("qExplanation")?.value);
            const source = normalizeText($("qSource")?.value) || "firestore";
            const image = normalizeText($("qImage")?.value);
            const manualId = normalizeText($("qId")?.value);

            const id = manualId || buildQuestionId(topic);

            const payload = {
                id,
                topic,
                question,
                options: [qA, qB, qC, qD],
                correct,
                explanation,
                source,
                image: image || "",
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, "questions"), payload);

            form.reset();
            $("qSource").value = "firestore";

            setMessage(`✅ Pregunta guardada correctamente (${id}).`);
            await loadStats();

        } catch (error) {
            console.error(error);
            setMessage("❌ No se pudo guardar la pregunta.");
        }
    };
}
