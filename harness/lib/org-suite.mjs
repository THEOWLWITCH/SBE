// תרגול צוותים בתרחיש (המרחב הארגוני, 28/10/2026).
// מבוסס על החבילה BE_GOOD_Organizational_Suite v1.0 (השרת המקומי server.mjs), מועבר לשרת של Begood:
//  - המנחה: כניסה עם קוד Begood עם הרשאת orgsuite. מי שפתח/ה את המפגש (אותו קוד) הוא/היא המנחה, מכל מכשיר.
//  - צופים וצופות: בלי קוד Begood, עם קוד המפגש (6 ספרות) וקוד צופה בדוי; מקבלים מפתח שנשמר בדפדפן.
//  - הנתונים במסד הקיים: ors:<id> (המפגש), orj:<קוד> (קוד המפגש). מפגש נמחק אחרי שנה, או כשהמנחה מוחק/ת.
// החוזה (נתיבים, מעברי מצב, כללי הקידוד) כמו בחבילה, דרך פעולה אחת: orsCall {method, path, input, key, token}.
import { readFileSync } from 'node:fs';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { ApiError, textField, activeElapsed, transition, normalizeObservation, profile } from './org-suite-core.mjs';

const DATA = new URL('../../app/org-suite/data/', import.meta.url);
const domains = JSON.parse(readFileSync(new URL('domains.json', DATA), 'utf8'));
const scenarios = JSON.parse(readFileSync(new URL('scenarios.json', DATA), 'utf8'));
const SCHEMA = 'BG-ORG-1.0';
const KEEP_DAYS = 365;
const MAX_OBSERVERS = 40, MAX_OBSERVATIONS = 3000, MAX_FEEDBACK = 200, MAX_PILOT = 60, MAX_MINE = 60;

const hash = (v) => createHash('sha256').update(String(v)).digest('hex');
const newKey = () => randomBytes(32).toString('hex');
const okId = (id) => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
const expired = (s) => !s || Date.parse(s.createdAt) + KEEP_DAYS * 86400000 < Date.now();

// כל פעולה על מפגש רצה אחרי הקודמת לאותו מפגש (שתי צופות שומרות באותו רגע).
const locks = new Map();
function locked(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(id, tail);
  tail.then(() => { if (locks.get(id) === tail) locks.delete(id); });
  return run;
}

function safeSession(s, actor, forExport = false) {
  const clone = structuredClone(s);
  delete clone._auth; delete clone.owner;
  if (actor.role !== 'facilitator' || forExport) delete clone.joinCode;
  if (actor.role !== 'facilitator') {
    clone.observations = clone.observations.filter((o) => o.coderId === actor.coderId);
    clone.feedback = [];
    clone.pilot = [];
  }
  clone.profiles = profile(clone.observations, domains.map((d) => d.code));
  clone.clock.elapsedMs = activeElapsed(s);
  clone.role = actor.role;
  clone.coderId = actor.coderId;
  return clone;
}

async function getSession(store, id) {
  if (!okId(id)) throw new ApiError('המפגש לא נמצא', 404);
  const s = await store.get('ors:' + id);
  if (!s || expired(s)) throw new ApiError('המפגש לא נמצא', 404);
  return s;
}
async function save(store, s) {
  s.updatedAt = new Date().toISOString();
  await store.set('ors:' + s.id, s);
}

// מי פונה: מנחה (קוד Begood של מי שפתח/ה את המפגש) או צופה (מפתח המפגש)
async function actorOf(s, body, who) {
  const me = await who(body.token);
  if (me && (me.sys || me.principal === s.owner)) return { role: 'facilitator', coderId: 'facilitator' };
  const key = typeof body.key === 'string' && /^[a-f0-9]{64}$/.test(body.key) ? body.key : '';
  const observer = key && s._auth.observers.find((o) => o.tokenHash === hash(key));
  if (observer) return { role: 'observer', coderId: observer.coderId };
  throw new ApiError('כדי להמשיך, אפשר להיכנס שוב למפגש', 401);
}
const ensureOpen = (s) => { if (s.status === 'closed') throw new ApiError('המפגש ננעל לקריאה בלבד', 409); };
const input = (body) => (body.input && typeof body.input === 'object' && !Array.isArray(body.input) ? body.input : {});

// who(token) → { principal, sys } או null, לפי הרשאה חיה ל-orgsuite (access.mjs)
export async function handleOrgSuite(store, body, { who, pause = async () => {} }) {
  try {
    if (body.action !== 'orsCall') throw new ApiError('פעולה אינה נתמכת', 405);
    if (JSON.stringify(body.input || {}).length > 65536) throw new ApiError('הבקשה גדולה מדי', 413);
    const method = String(body.method || 'GET').toUpperCase();
    const route = String(body.path || '');
    const data = input(body);

    if (route === '/catalog' && method === 'GET') return [200, { domains, scenarios }];

    if (route === '/mine' && method === 'GET') {
      const me = await who(body.token);
      if (!me) throw new ApiError('כדי להמשיך, אפשר להיכנס שוב עם הקוד', 401);
      const rows = await store.list('ors:');
      const mine = rows.map((r) => r.value).filter((s) => s && !expired(s) && (s.owner === me.principal))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, MAX_MINE)
        .map((s) => ({ id: s.id, title: s.title, status: s.status, createdAt: s.createdAt, mode: s.mode }));
      return [200, { sessions: mine }];
    }

    if (route === '/sessions' && method === 'POST') {
      const me = await who(body.token);
      if (!me) throw new ApiError('כדי לפתוח מפגש, אפשר להיכנס עם קוד שיש בו את הכלי', 401);
      const scenario = scenarios.find((s) => s.id === data.scenarioId);
      if (!scenario) throw new ApiError('אפשר לבחור תרחיש אימון');
      if (!['training', 'pilot'].includes(data.mode)) throw new ApiError('סוג מפגש לא תקין');
      if (!['intact_work_teams', 'constructed_role_units'].includes(data.teamConfiguration)) throw new ApiError('אפשר לבחור תצורת צוותים');
      const accessFactor = Number(data.accessFactor ?? 1);
      if (![1, 1.5, 2].includes(accessFactor)) throw new ApiError('מקדם זמן לא תקין');
      const owned = (await store.list('ors:')).filter((r) => r.value && r.value.owner === me.principal && !expired(r.value));
      if (owned.length >= MAX_MINE) throw new ApiError('יש כבר הרבה מפגשים. אפשר למחוק מפגשים ישנים ולנסות שוב', 429);
      let joinCode;
      for (let i = 0; i < 20; i++) { const c = String(randomInt(100000, 1000000)); if (!(await store.get('orj:' + c))) { joinCode = c; break; } }
      if (!joinCode) throw new ApiError('לא ניתן להפיק קוד מפגש כרגע. אפשר לנסות שוב', 503);
      const now = new Date().toISOString();
      const s = { id: randomUUID(), title: textField(data.title, 'שם המפגש', 140, true), scenarioId: scenario.id, scenarioVersion: scenario.version,
        mode: data.mode, teamConfiguration: data.teamConfiguration, accessFactor, status: 'draft', createdAt: now, updatedAt: now,
        joinCode, clock: { activeMs: 0, startedAt: null }, delivered: {}, observations: [], feedback: [], pilot: [],
        owner: me.principal, _auth: { observers: [] } };
      await store.set('ors:' + s.id, s);
      await store.set('orj:' + joinCode, { id: s.id });
      return [201, { session: safeSession(s, { role: 'facilitator', coderId: 'facilitator' }) }];
    }

    if (route === '/join' && method === 'POST') {
      const code = textField(data.code, 'קוד', 6, true);
      const ref = /^\d{6}$/.test(code) ? await store.get('orj:' + code) : null;
      if (!ref) { await pause(); throw new ApiError('קוד המפגש לא נמצא', 404); }
      return await locked(ref.id, async () => {
        const s = await getSession(store, ref.id);
        ensureOpen(s);
        const coderId = textField(data.coderId, 'קוד צופה', 40, true);
        if (!/^[A-Za-z0-9_-]{2,40}$/.test(coderId) || coderId === 'facilitator') throw new ApiError('אפשר להשתמש בקוד צופה בדוי, למשל OBS-01');
        if (s._auth.observers.some((o) => o.coderId === coderId)) throw new ApiError('קוד הצופה כבר בשימוש. לחזרה אפשר להשתמש בדפדפן המקורי או לבחור קוד חדש', 409);
        if (s._auth.observers.length >= MAX_OBSERVERS) throw new ApiError('במפגש הזה כבר יש מספר הצופים המרבי', 409);
        const key = newKey();
        s._auth.observers.push({ coderId, tokenHash: hash(key) });
        await save(store, s);
        return [200, { sessionId: s.id, observerToken: key, session: safeSession(s, { role: 'observer', coderId }), role: 'observer' }];
      });
    }

    const match = route.match(/^\/sessions\/([a-f0-9-]{36})(?:\/(transition|deliver|observations|feedback|pilot|export))?$/);
    if (!match) throw new ApiError('הנתיב לא נמצא', 404);
    const [, id, action] = match;
    return await locked(id, async () => {
      const s = await getSession(store, id);
      const actor = await actorOf(s, body, who);
      if (['transition', 'deliver', 'feedback', 'pilot', 'export'].includes(action) && actor.role !== 'facilitator') throw new ApiError('הפעולה זמינה למנחה בלבד', 403);
      if (!action && method === 'GET') return [200, safeSession(s, actor)];
      if (!action && method === 'DELETE') {
        if (actor.role !== 'facilitator') throw new ApiError('הפעולה זמינה למנחה בלבד', 403);
        await store.del('ors:' + s.id); await store.del('orj:' + s.joinCode);
        return [200, { ok: true }];
      }
      if (action === 'export' && method === 'GET') return [200, { schemaVersion: SCHEMA, exportedAt: new Date().toISOString(), session: safeSession(s, actor, true) }];
      ensureOpen(s);
      let record;
      if (action === 'transition' && method === 'POST') {
        transition(s, data.status);
        if (s.status === 'closed') await store.del('orj:' + s.joinCode);
      } else if (action === 'deliver' && method === 'POST') {
        if (s.status !== 'running') throw new ApiError('מסירת אירוע זמינה רק בזמן תרגול פעיל', 409);
        if (!scenarios.find((c) => c.id === s.scenarioId).opportunities.some((o) => o.id === data.opportunityId)) throw new ApiError('האירוע לא קיים');
        if (s.delivered[data.opportunityId]) throw new ApiError('האירוע כבר נמסר; זמן המקור נשמר', 409);
        s.delivered[data.opportunityId] = { activeMs: activeElapsed(s), deliveredAt: new Date().toISOString() };
        s.clock.activeMs = activeElapsed(s); s.clock.startedAt = Date.now();
      } else if (action === 'observations' && method === 'PUT') {
        if (!scenarios.find((c) => c.id === s.scenarioId).opportunities.some((o) => o.id === data.opportunityId)) throw new ApiError('האירוע לא קיים');
        if (data.deliveryStatus === 'DEL' && !s.delivered[data.opportunityId]) throw new ApiError('לא תועדה מסירת האירוע במפגש', 409);
        if (s.observations.length >= MAX_OBSERVATIONS) throw new ApiError('הגענו למספר התצפיות המרבי במפגש', 409);
        const obs = normalizeObservation(data);
        const originals = s.observations.filter((o) => o.coderId === actor.coderId && o.opportunityId === obs.opportunityId);
        const domain = domains.find((d) => d.code === obs.opportunityId.split('-')[0]);
        record = { ...obs, id: randomUUID(), coderId: actor.coderId, revision: originals.length + 1, previousId: originals.at(-1)?.id || null, codedAt: new Date().toISOString(), delivered: s.delivered[obs.opportunityId] || null,
          provenance: { sourceIds: domain.sourceIds, exerciseId: domain.exerciseId, sourceLibraryVersion: 'BE_GOOD_Research_Library_v1_2', scenarioVersion: s.scenarioVersion, attribution: 'BE GOOD proposed behavioral coding; sources inform training exercises and do not validate this measure' } };
        s.observations.push(record);
      } else if (action === 'feedback' && method === 'POST') {
        if (!['debrief', 'paused'].includes(s.status)) throw new ApiError('משוב נשמר בתחקיר או בהפסקה', 409);
        if (s.feedback.length >= MAX_FEEDBACK) throw new ApiError('הגענו למספר המשובים המרבי במפגש', 409);
        const dueDate = textField(data.dueDate, 'מועד', 10, true);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) throw new ApiError('המועד אינו תקין');
        record = { id: randomUUID(), strength: textField(data.strength, 'חוזקה', 1000, true), evidence: textField(data.evidence, 'ראיה', 2000, true), nextStep: textField(data.nextStep, 'צעד הבא', 1000, true), owner: textField(data.owner, 'קוד אחראי', 60, true), dueDate, createdAt: new Date().toISOString() };
        s.feedback.push(record);
      } else if (action === 'pilot' && method === 'POST') {
        if (s.mode !== 'pilot') throw new ApiError('אבני דרך זמינות במפגש פיילוט בלבד');
        if (!['T0', 'T1', 'T2'].includes(data.timepoint) || typeof data.completed !== 'boolean') throw new ApiError('אבן הדרך אינה תקינה');
        if (s.pilot.length >= MAX_PILOT) throw new ApiError('הגענו למספר הרשומות המרבי', 409);
        record = { id: randomUUID(), timepoint: data.timepoint, completed: data.completed, note: textField(data.note, 'הערה', 2000), recordedAt: new Date().toISOString(), kind: 'operational_checkpoint_not_research_outcome' };
        s.pilot.push(record);
      } else throw new ApiError('פעולה אינה נתמכת', 405);
      await save(store, s);
      return [200, { session: safeSession(s, actor), ...(record ? { record } : {}) }];
    });
  } catch (err) {
    if (err instanceof ApiError) return [err.status, { error: err.message }];
    console.error('org suite failed');
    return [500, { error: 'לא ניתן להשלים את הפעולה. הנתונים הקודמים נשמרו; אפשר לנסות שוב' }];
  }
}
