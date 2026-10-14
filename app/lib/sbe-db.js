// Scenario reads and counters use the existing server and signed session. The
// server derives institution access; institutionId remains a display/filter hint.
function endpoint() {
  if (typeof window !== 'undefined' && typeof window.sbeAIOrigin === 'function') return window.sbeAIOrigin() + '/api/scenarios';
  return (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
    ? 'http://localhost:8790' : 'https://sbe-server.onrender.com') + '/api/scenarios';
}
function sessionToken() {
  try { return sessionStorage.getItem('sbe.session.token') || ''; } catch { return ''; }
}
async function scenarios(body) {
  const response = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, token: sessionToken() }), cache: 'no-store', signal: AbortSignal.timeout(20000) });
  let data;
  try { data = await response.json(); } catch { throw new Error('החיבור למאגר נקטע. אפשר לנסות שוב.'); }
  if (!response.ok) throw new Error(data.error || 'המאגר אינו זמין כעת. אפשר לנסות שוב בהמשך.');
  return data;
}
export async function fetchScenarios(options = {}) {
  return scenarios({ ...options, action: 'list' });
}
export async function getScenario(id) {
  return (await scenarios({ action: 'get', id })).scenario || null;
}
export async function incrementRuns(id) {
  try { await scenarios({ action: 'increment', id }); } catch { /* optional usage count */ }
}
