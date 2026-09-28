// כניסות מוגנות: סיסמאות הניהול וקוד "משוב לעבודות" נבדקים כאן, בשרת,
// ולא בקוד הדף — כך שאי אפשר לקרוא אותם ב"הצגת מקור".
// סיסמאות נשמרות כ-hash (scrypt + salt). הקוד למשוב לעבודות נשמר כפי שהוא,
// כי מנהלת המערכת צריכה לראות אותו כדי למסור אותו.
import { getStore } from "@netlify/blobs";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
// בתוקף רק עד שמנהלת המערכת מחליפה סיסמה בפעם הראשונה (אלה הסיסמאות שהיו
// כתובות עד עכשיו ב-entry.html).
const DEFAULT_PASSWORDS = { sys: "990211", inst: "550118" };
const MIN_PASSWORD = 8;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const pause = () => new Promise((r) => setTimeout(r, 400));

function hashPassword(pw, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(pw, salt, 32).toString("hex") };
}

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

async function checkPassword(store, kind, pw) {
  if (!DEFAULT_PASSWORDS[kind] || typeof pw !== "string" || !pw) return false;
  const rec = await store.get("pw-" + kind, { type: "json" });
  if (!rec) return same(pw, DEFAULT_PASSWORDS[kind]);
  return same(hashPassword(pw, rec.salt).hash, rec.hash);
}

const normCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function newCode() {
  const bytes = randomBytes(8);
  let s = "";
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s.slice(0, 4) + "-" + s.slice(4);
}

async function status(store) {
  const [code, sys, inst] = await Promise.all([
    store.get("code-academic", { type: "json" }),
    store.get("pw-sys", { type: "json" }),
    store.get("pw-inst", { type: "json" }),
  ]);
  return {
    academicCode: code ? code.code : null,
    academicCreatedAt: code ? code.createdAt : null,
    defaultPasswords: { sys: !sys, inst: !inst },
  };
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let store;
  try { store = getStore("sbe-access"); }
  catch { return json({ error: "storage unavailable" }, 503); }

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "invalid JSON" }, 400); }

  const { action } = body || {};

  if (action === "login") {
    const { kind, secret } = body;
    let ok = false;
    if (kind === "sys" || kind === "inst") ok = await checkPassword(store, kind, secret);
    else if (kind === "academic") {
      const rec = await store.get("code-academic", { type: "json" });
      ok = !!rec && normCode(secret).length > 0 && same(normCode(secret), normCode(rec.code));
    }
    if (!ok) { await pause(); return json({ error: "wrong" }, 403); }
    return json({ ok: true });
  }

  // כל פעולת ניהול מחייבת את סיסמת מנהלת המערכת בבקשה עצמה.
  if (!(await checkPassword(store, "sys", body.auth))) { await pause(); return json({ error: "unauthorized" }, 403); }

  if (action === "status") return json(await status(store));

  if (action === "newAcademicCode") {
    await store.setJSON("code-academic", { code: newCode(), createdAt: new Date().toISOString() });
    return json(await status(store));
  }

  if (action === "revokeAcademicCode") {
    await store.delete("code-academic");
    return json(await status(store));
  }

  if (action === "setPassword") {
    const { kind, newPassword } = body;
    if (kind !== "sys" && kind !== "inst") return json({ error: "bad kind" }, 400);
    if (typeof newPassword !== "string" || newPassword.trim().length < MIN_PASSWORD)
      return json({ error: "short", min: MIN_PASSWORD }, 400);
    await store.setJSON("pw-" + kind, hashPassword(newPassword.trim()));
    return json(await status(store));
  }

  return json({ error: "unknown action" }, 400);
};

export const config = { path: "/api/access" };
