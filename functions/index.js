const functions = require("firebase-functions");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const auth = getAuth();
const db = getFirestore();

const ADMIN_EMAIL = "rayvf2002@gmail.com";

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim();
}

function firstName(fullName = "") {
  const clean = normalizeText(fullName);
  const parts = clean.split(/[\s,-]+/).filter(Boolean);
  return parts[0] || "Alumno";
}

function buildPassword(displayName = "") {
  const base = firstName(displayName);
  return `${base}12345`;
}

function safeRole(role) {
  return String(role || "").toLowerCase() === "admin" ? "admin" : "student";
}

async function requireAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Debes iniciar sesión."
    );
  }

  const uid = context.auth.uid;
  const email = context.auth.token?.email || "";

  const snap = await db.collection("users").doc(uid).get();
  const role = snap.exists ? snap.data()?.role : null;

  const isAdmin = role === "admin" || email === ADMIN_EMAIL;

  if (!isAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No tienes permisos de administrador."
    );
  }

  return { uid, email };
}

async function upsertUserDoc({ uid, displayName, email, role, createdAt = null }) {
  await db.collection("users").doc(uid).set(
    {
      uid,
      displayName,
      email,
      role: safeRole(role),
      disabled: false,
      createdAt: createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      stats: {
        correct: 0,
        wrong: 0,
        exams: 0,
        favorites: 0,
        bestScore: 0,
        lastExam: null
      },
      settings: {
        theme: "dark",
        language: "es"
      }
    },
    { merge: true }
  );
}

exports.createUserAdmin = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const displayName = String(data.displayName || data.name || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "").trim() || buildPassword(displayName);
  const role = safeRole(data.role);

  if (!displayName || !email) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Faltan displayName o email."
    );
  }

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
      disabled: false
    });

    await upsertUserDoc({
      uid: userRecord.uid,
      displayName,
      email,
      role
    });

    return {
      ok: true,
      uid: userRecord.uid,
      displayName,
      email,
      password,
      role
    };
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      throw new functions.https.HttpsError(
        "already-exists",
        "Ese correo ya existe."
      );
    }

    throw new functions.https.HttpsError(
      "internal",
      error.message || "No se pudo crear el usuario."
    );
  }
});

exports.bulkCreateUsersAdmin = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const users = Array.isArray(data.users) ? data.users : [];

  if (users.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "No se han recibido usuarios."
    );
  }

  const created = [];
  const skipped = [];
  const failed = [];

  for (const item of users) {
    const displayName = String(item.displayName || item.name || "").trim();
    const email = String(item.email || "").trim().toLowerCase();
    const password = String(item.password || "").trim() || buildPassword(displayName);
    const role = safeRole(item.role);

    if (!displayName || !email) {
      failed.push({
        email,
        reason: "Faltan displayName o email"
      });
      continue;
    }

    try {
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: false,
        disabled: false
      });

      await upsertUserDoc({
        uid: userRecord.uid,
        displayName,
        email,
        role
      });

      created.push({
        uid: userRecord.uid,
        displayName,
        email,
        password,
        role
      });
    } catch (error) {
      if (error.code === "auth/email-already-exists") {
        skipped.push({
          email,
          reason: "Ya existe"
        });
      } else {
        failed.push({
          email,
          reason: error.message || "Error desconocido"
        });
      }
    }
  }

  return {
    ok: true,
    created,
    skipped,
    failed,
    summary: {
      created: created.length,
      skipped: skipped.length,
      failed: failed.length
    }
  };
});

exports.listUsersAdmin = functions.https.onCall(async (_data, context) => {
  await requireAdmin(context);

  const snap = await db.collection("users").get();

  const users = snap.docs.map(docSnap => ({
    docId: docSnap.id,
    ...docSnap.data()
  }));

  return {
    ok: true,
    users,
    count: users.length
  };
});

exports.setUserRoleAdmin = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const uid = String(data.uid || "").trim();
  const role = safeRole(data.role);

  if (!uid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Falta uid."
    );
  }

  await db.collection("users").doc(uid).set(
    {
      role,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return { ok: true, uid, role };
});

exports.setUserDisabledAdmin = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const uid = String(data.uid || "").trim();
  const disabled = Boolean(data.disabled);

  if (!uid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Falta uid."
    );
  }

  await auth.updateUser(uid, { disabled });

  await db.collection("users").doc(uid).set(
    {
      disabled,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return { ok: true, uid, disabled };
});
