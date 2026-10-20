import { readFile } from 'node:fs/promises';
import { createResearchDatabase } from './research-database.mjs';
export { TOKENS, request, token } from './research-database.mjs';

export async function createPartnershipDatabase() {
  const base = await createResearchDatabase();
  try {
    for (const migration of ['20261018-research-partnerships.sql', '20261020-partnership-profile.sql', '20261020-partnership-intake.sql', '20261020-guided-agreement-contract.sql']) await base.db.exec(await readFile(new URL('../migrations/' + migration, import.meta.url), 'utf8'));
  }
  catch (error) { await base.close(); throw error; }
  const partnershipRpc = async (credential, action, payload = {}) => {
    await base.db.exec('SET ROLE service_role');
    try { return (await base.db.query('SELECT public.research_partnership_rpc($1,$2,$3::jsonb) AS result', [credential, action, payload])).rows[0].result; }
    finally { await base.db.exec('RESET ROLE'); }
  };
  const intakeRpc = async (credential, action, payload = {}) => {
    await base.db.exec('SET ROLE service_role');
    try { return (await base.db.query('SELECT public.research_intake_rpc($1,$2,$3::jsonb) AS result', [credential, action, payload])).rows[0].result; }
    finally { await base.db.exec('RESET ROLE'); }
  };
  return { ...base, partnershipRpc, intakeRpc };
}
