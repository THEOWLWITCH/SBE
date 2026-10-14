import { scryptSync } from 'node:crypto';

export const SYNTHETIC_OWNER_PASSWORD = 'synthetic-owner-password-only';
export function syntheticOwnerRecord() {
  const salt = 'synthetic-test-salt';
  return {salt,hash:scryptSync(SYNTHETIC_OWNER_PASSWORD,salt,32).toString('hex')};
}
export async function seedOwnerPassword(store) {
  await store.set('pw-sys',syntheticOwnerRecord());
}
