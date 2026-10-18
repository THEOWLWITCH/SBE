import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash, createHmac, randomUUID } from 'node:crypto';

export const SECRET = 'synthetic-research-auth-secret-not-a-production-key';
export const OWNER_PASSWORD = Object.freeze({salt:'synthetic-research-owner-salt',hash:'synthetic-research-owner-hash'});
export const OWNER_AUTH_VERSION = createHash('sha256').update(OWNER_PASSWORD.salt+':'+OWNER_PASSWORD.hash).digest('hex');
export function token(payload) {
  const body = Buffer.from(JSON.stringify({ exp: Date.now() + 3600_000, ...payload })).toString('base64url');
  return body + '.' + createHmac('sha256', SECRET).update(body).digest('base64url');
}
export const TOKENS = { owner: token({ k: 'sys', authVersion: OWNER_AUTH_VERSION }), a: token({ k: 'code', c: 'STAFFA', kind: 'staff', inst: 'Synthetic School' }), b: token({ k: 'code', c: 'STAFFB', kind: 'staff', inst: 'Synthetic School' }), participant: token({ k: 'code', c: 'PERSON1', kind: 'staff', inst: 'Synthetic School' }), worker: token({ k: 'research_worker', purpose: 'research', exp: Date.now() + 300_000 }) };
export const request = (extra = {}) => ({ requestId: randomUUID(), ...extra });
export async function createResearchDatabase() {
  const runtime = process.env.RESEARCH_PGLITE_PATH || fileURLToPath(new URL('../../../research-test-runtime/node_modules/@electric-sql/pglite/', import.meta.url));
  const { PGlite } = await import(pathToFileURL(runtime + '/dist/index.js').href);
  const { pgcrypto } = await import(pathToFileURL(runtime + '/dist/contrib/pgcrypto.js').href);
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE TABLE public.access_settings(key text PRIMARY KEY, value jsonb NOT NULL);");
  for (const [key, value] of [ ['token-secret', { secret: SECRET }], ['pw-sys', OWNER_PASSWORD], ['institutions', [{ name: 'Synthetic School', active: true }]], ['settings', { graceDays: 14 }], ...['STAFFA', 'STAFFB', 'PERSON1'].map(code => ['code:' + code, { code, kind: 'staff', inst: 'Synthetic School', perms: ['writer'], revoked: false }]) ]) await db.query('INSERT INTO public.access_settings VALUES ($1,$2)', [key, value]);
  try { await db.exec(await readFile(new URL('../migrations/20261013-research-management.sql', import.meta.url), 'utf8')); } catch (error) { await db.close(); throw error; }
  const rpc = async (credential, action, payload = {}) => { await db.exec('SET ROLE service_role'); try { return (await db.query('SELECT public.research_rpc($1,$2,$3::jsonb) AS result', [credential, action, payload])).rows[0].result; } finally { await db.exec('RESET ROLE'); } };
  return { db, rpc, close: () => db.close() };
}
