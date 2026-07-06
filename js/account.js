import { auth } from "./firebase.js";

import {
    onAuthStateChanged,
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

function $(id) {
    return document.getElementById(id);
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

    $("accountAvatar").textContent = getInitials(user);
    $("accountEmail").textContent = user.email || "Sin correo";
    $("accountEmailValue").textContent = user.email || "—";
    $("accountUid").textContent = user.uid || "—";
    $("accountCreated").textContent = user.metadata?.creationTime
        ? new Date(user.metadata.creationTime).toLocaleString()
        : "—";
    $("accountVerified").textContent = user.emailVerified ? "Sí" : "No";
});

const resetPasswordBtn = $("resetPasswordBtn");
const accountLogoutBtn = $("accountLogoutBtn");
const message = $("accountMessage");

if (resetPasswordBtn) {
    resetPasswordBtn.onclick = async () => {
        try {
            const user = auth.currentUser;
            if (!user?.email) {
                message.textContent = "No se ha podido detectar el correo.";
                return;
            }

            await sendPasswordResetEmail(auth, user.email);
            message.textContent = "📩 Hemos enviado un correo para cambiar la contraseña.";
        } catch (error) {
            message.textContent = "No se pudo enviar el correo de recuperación.";
        }
    };
}

if (accountLogoutBtn) {
    accountLogoutBtn.onclick = async () => {
        try {
            await signOut(auth);
            window.location.href = "login.html";
        } catch {
            message.textContent = "No se pudo cerrar la sesión.";
        }
    };
}
