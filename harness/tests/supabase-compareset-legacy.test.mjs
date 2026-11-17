import test from 'node:test';
import assert from 'node:assert/strict';
import { supabaseStore } from '../lib/access.mjs';

// רשומה שנשמרה בלי revision (למשל פעילות בירור דילמות שנוצרה ב-set) חייבת להתעדכן ב-compareSet עם revision 0.
test('compareSet with revision 0 also matches records saved without a revision', async () => {
  const urls = [];
  const st = supabaseStore('https://x.supabase.co', 'k', { fetchImpl: async (u) => { urls.push(decodeURIComponent(u)); return new Response('[{"key":"a"}]', { status: 200 }); } });
  assert.equal(await st.compareSet('dla:1', 0, { revision: 1 }), true);
  assert.match(urls[0], /or=\(value->>revision\.eq\.0,value->>revision\.is\.null\)/);
  await st.compareSet('dla:1', 3, { revision: 4 });
  assert.match(urls[1], /value->>revision=eq\.3&/);
});
