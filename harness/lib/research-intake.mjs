import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { activeResearchInstitutions, handleAccess, isActiveResearchIdentity } from './access.mjs';

const require = createRequire(import.meta.url);
const CORE = require('../../app/lib/research-intake-core.js');
const PUBLIC = new Set(CORE.PUBLIC_ACTIONS), CLIENT = new Set(CORE.CLIENT_ACTIONS);
const own = Object.hasOwn;
const statuses = { invalid: 400, unauthorized: 403, not_found: 404, conflict: 409, rate_limited: 429, not_configured: 503, unavailable: 503 };
const messages = { invalid: 'אפשר לבדוק את הפרטים ולהשלים את השדות המסומנים.', unauthorized: 'אין הרשאה לפעולה זו.', not_found: 'הפריט אינו זמין.', conflict: 'הגרסה השתנתה. אפשר לרענן לפני שמירה נוספת.', rate_limited: 'נשלחו כמה פניות. אפשר לנסות שוב בהמשך.', not_configured: 'להשלמת הפעולה נדרשת הגדרת השירות בידי בעלת המערכת.', unavailable: 'השירות אינו זמין כעת.' };
const fail = code => { throw Object.assign(new Error(code), { code }); };
export const isIntakeAction = action => CLIENT.has(action);
export const isPublicIntakeAction = action => PUBLIC.has(action);
const identity = record => ({ code: record.code.toUpperCase().replace(/[^A-Z0-9]/g, ''), label: record.label || '', institution: record.inst, ...(record.researchOnly === true ? { researchOnly: true } : {}) });

export async function handleIntake(accessStore, researchStore, body, options = {}) {
  try {
    const action = body?.action;
    if (!(options.privateEndpoint === true ? CLIENT.has(action) : PUBLIC.has(action))) fail('invalid');
    const payload = CORE.validatePayload(action, body);
    if (CLIENT.has(action)) {
      if (typeof options.verifyIdentity !== 'function') fail('not_configured');
      const actor = await options.verifyIdentity(accessStore, body.token);
      if (!actor.owner) fail('unauthorized');
      if (action === 'intakeIdentityCreate') {
        const [status, result] = await handleAccess(accessStore, { action: 'codeCreate', token: body.token, requestId: payload.requestId,
          kind: 'staff', inst: payload.institution, label: payload.label, perms: [], researchOnly: true });
        if (status !== 200) fail(own(statuses, result.error) ? result.error : status === 404 ? 'not_found' : status === 403 ? 'unauthorized' : 'invalid');
        return [200, { identity: identity(result.code) }];
      }
    } else if (action === 'intakeSubmit') {
      const secret = (await accessStore?.get?.('token-secret'))?.secret;
      if (typeof secret !== 'string' || !secret) fail('not_configured');
      payload.rateBucket = createHmac('sha256', secret).update(JSON.stringify(['BEGOOD/research-intake-rate/v1', typeof options.clientAddress === 'string' && options.clientAddress ? options.clientAddress : 'unknown'])).digest('hex');
    }
    if (typeof researchStore?.rpc !== 'function') fail('not_configured');
    const result = await researchStore.rpc(PUBLIC.has(action) ? '' : body.token, action, payload);
    if (result?.error) fail(result.error);
    const output = Object.fromEntries(Object.keys(CORE.OPERATIONS[action].result).filter(key => own(result || {}, key)).map(key => [key, result[key]]));
    if (action === 'intakeOwnerBootstrap') {
      const [status, listed] = await handleAccess(accessStore, { action: 'codesList', token: body.token });
      if (status !== 200) fail('unauthorized');
      const institutions = await activeResearchInstitutions(accessStore);
      const live = await Promise.all(listed.codes.map(async record => await isActiveResearchIdentity(accessStore, record, institutions) ? identity(record) : null));
      output.identities = live.filter(Boolean);
      output.institutions = institutions.map(institution => institution.name);
    }
    return [200, output];
  } catch (error) {
    const code = own(statuses, error?.code) ? error.code : 'unavailable';
    return [statuses[code], { code, error: messages[code] }];
  }
}
