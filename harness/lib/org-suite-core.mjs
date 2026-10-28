// מהחבילה BE_GOOD_Organizational_Suite v1.0 (core.mjs), עם ניסוח הודעות בשפה של הזמנה (28/10/2026).
export class ApiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function textField(value, label, max = 2000, required = false) {
  if (typeof value !== 'string') {
    if (!required && value == null) return '';
    throw new ApiError(`${label}: אפשר לכתוב כאן טקסט`);
  }
  const clean = value.trim();
  if (clean.length > max || (required && !clean)) throw new ApiError(`${label}: האורך לא מתאים`);
  return clean;
}

export function activeElapsed(session, now = Date.now()) {
  return session.clock.activeMs + (session.status === 'running' && session.clock.startedAt != null ? Math.max(0, now - session.clock.startedAt) : 0);
}

export function transition(session, target, now = Date.now()) {
  const allowed = {draft: ['running'], running: ['paused', 'debrief'], paused: ['running', 'debrief'], debrief: ['closed'], closed: []};
  if (!allowed[session.status]?.includes(target)) throw new ApiError('מעבר מצב אינו אפשרי', 409);
  session.clock.activeMs = activeElapsed(session, now);
  session.clock.startedAt = target === 'running' ? now : null;
  session.status = target;
  session.updatedAt = new Date(now).toISOString();
}

export function normalizeObservation(input) {
  const { deliveryStatus, observationStatus, score } = input;
  if (!['DEL', 'ND'].includes(deliveryStatus) || !['OBS', 'MD', 'EO'].includes(observationStatus)) throw new ApiError('סטטוס תצפית לא תקין');
  const valid = deliveryStatus === 'DEL' && observationStatus === 'OBS';
  if (valid && ![0, 1, 2].includes(score)) throw new ApiError('בתצפית תקפה אפשר לבחור ציון 0, 1 או 2');
  if (!valid && score !== null) throw new ApiError('נתון חסר או סירוב אתי נשארים בלי ציון');
  const evidence = textField(input.evidence, 'ראיה', 2000, valid);
  const lateResponse = input.lateResponse === true;
  const reciprocalChainObserved = input.reciprocalChainObserved === true;
  if (valid && input.opportunityId === 'EMP-1' && score === 2 && !lateResponse && !reciprocalChainObserved) throw new ApiError('ציון 2 דורש שרשרת הדדית שנצפתה');
  const seconds = key => {
    if (input[key] == null || input[key] === '') return null;
    const n = Number(input[key]);
    if (!Number.isFinite(n) || n < 0 || n > 86400) throw new ApiError('מיקום ראיה לא תקין');
    return n;
  };
  const evidenceStartSec = seconds('evidenceStartSec'), evidenceEndSec = seconds('evidenceEndSec');
  if (evidenceStartSec != null && evidenceEndSec != null && evidenceEndSec < evidenceStartSec) throw new ApiError('סוף הראיה מגיע אחרי תחילתה');
  return {
    opportunityId: input.opportunityId, deliveryStatus, observationStatus,
    validityStatus: valid ? 'VALID' : deliveryStatus === 'ND' ? 'ND' : observationStatus,
    score: valid ? Math.min(score, lateResponse ? 1 : 2) : null,
    evidence, evidenceStartSec, evidenceEndSec, lateResponse,
    anticipatoryCredit: input.anticipatoryCredit === true, reciprocalChainObserved,
    manualVersion: 'BG-CODE-1.0',
    scoringStatus: 'proposed_unvalidated_training_measure'
  };
}

export function profile(observations, domainCodes) {
  const coders = [...new Set(observations.map(o => o.coderId))];
  return coders.map(coderId => {
    const latest = new Map();
    for (const row of observations.filter(o => o.coderId === coderId)) latest.set(row.opportunityId, row);
    return { coderId, domains: domainCodes.map(code => {
      const rows = [latest.get(`${code}-1`), latest.get(`${code}-2`)];
      const valid = rows.filter(r => r?.deliveryStatus === 'DEL' && r?.observationStatus === 'OBS' && [0, 1, 2].includes(r.score));
      const sum = valid.reduce((n, r) => n + r.score, 0);
      return { code, validCount: valid.length, score: valid.length === 2 ? 100 * sum / 4 : null, rawMean: valid.length === 2 ? sum / 2 : null };
    }) };
  });
}
