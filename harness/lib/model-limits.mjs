// Process-local protection shared by all AI routes. Multi-instance deployments
// require an approved atomic shared quota store; these caps do not claim that.
const DEFAULTS = { userRate: 30, institutionRate: 120, userConcurrent: 3, institutionConcurrent: 12, windowMs: 60000 };
const ENV_KEYS = { userRate:'MODEL_USER_RATE', institutionRate:'MODEL_INSTITUTION_RATE', userConcurrent:'MODEL_USER_CONCURRENT',
  institutionConcurrent:'MODEL_INSTITUTION_CONCURRENT', windowMs:'MODEL_RATE_WINDOW_MS' };

export function createModelLimits({ env = process.env, now = Date.now } = {}) {
  const config = {};
  let valid = true;
  for (const [key,fallback] of Object.entries(DEFAULTS)) {
    const raw = env[ENV_KEYS[key]];
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > (key === 'windowMs' ? 3600000 : 100000)) valid = false;
    config[key] = value;
  }
  const users = new Map(), institutions = new Map();
  function bucket(map, key, time) {
    let row = map.get(key);
    if (!row) { row = { count:0, active:0, started:time }; map.set(key,row); }
    if (time - row.started >= config.windowMs) { row.count = 0; row.started = time; }
    return row;
  }
  return {
    acquire(actor) {
      if (!valid || !actor?.principal || !actor?.institution) return { ok:false, status:503, code:'limits_config' };
      const time = now();
      for (const map of [users,institutions]) for (const [key,row] of map)
        if (!row.active && time - row.started >= config.windowMs) map.delete(key);
      const user = bucket(users,actor.principal,time), institution = bucket(institutions,actor.institution,time);
      if (user.count >= config.userRate || institution.count >= config.institutionRate
        || user.active >= config.userConcurrent || institution.active >= config.institutionConcurrent)
        return { ok:false, status:429, code:'model_limit', retryAfter:Math.max(1,Math.ceil((config.windowMs - (time-user.started))/1000)) };
      user.count++; institution.count++; user.active++; institution.active++;
      let released = false;
      return { ok:true, release() { if (!released) { released = true; user.active--; institution.active--; } } };
    },
  };
}
