import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../../app/lib/journey-starter-catalog.js');
const M = require('../../app/lib/journey-workspace-model.js');
const A = require('../../app/lib/journey-analysis-model.js');

test('school and community offer distinct candidate inventories without inserting facts', () => {
  const before = M.empty();
  const school = C.getCatalog('school'), community = C.getCatalog('community');
  assert.deepEqual(Object.keys(school), ['roles','mechanisms','infrastructures','resources']);
  assert.deepEqual(Object.values(school).map(a => a.length), [8,20,8,8]);
  assert.deepEqual(Object.values(community).map(a => a.length), [8,20,7,7]);
  assert.notDeepEqual(school.roles.map(a => a.title), community.roles.map(a => a.title));
  for (const kind of ['school','community']) {
    const ids = Object.values(C.getCatalog(kind)).flat().map(item => item.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(C.getCatalog(kind).mechanisms.some(item => /פתיחות וחיבור לקהילות אחרות/.test(item.title)));
    assert.ok(C.getCatalog(kind).mechanisms.some(item => /תודעת חוסן/.test(item.title)));
    assert.ok(C.getCatalog(kind).mechanisms.some(item => /מעגל למידה יוזם/.test(item.title)));
  }
  assert.deepEqual(before, M.empty());
  assert.equal(C.getCatalog('other'), null);
});

test('explicit selection reports existence with stable provenance and no empirical prefill', () => {
  const item = C.getCatalog('school').mechanisms.find(item => /למידת עמיתים/.test(item.title));
  const selected = C.createRecord('school','mechanisms',item.id,'m1','2026-10-27');
  assert.equal(selected.title, item.title);
  assert.equal(selected.catalogId, item.id);
  assert.equal(selected.knowledgeState, 'present');
  assert.equal(selected.updatedBy, 'דיווח הצוות');
  assert.equal(selected.updatedAt, '2026-10-27');
  assert.match(selected.catalogSource, /הצעת פתיחה/);
  const cleaned = M.clean({mechanisms:[selected]});
  assert.equal(cleaned.mechanisms[0].purpose, '');
  assert.equal(cleaned.mechanisms[0].activation, '');
  assert.deepEqual(cleaned.mechanisms[0].evidenceIds, []);
  assert.deepEqual(cleaned.links, []);
  cleaned.mechanisms[0].title = 'השם המקומי שלנו';
  const next = C.createRecord('school','mechanisms',item.id,'m2','2026-10-27');
  assert.equal(next.catalogId, cleaned.mechanisms[0].catalogId);
  assert.notEqual(next.id, cleaned.mechanisms[0].id);
  assert.equal(M.clean(cleaned).mechanisms[0].catalogId, item.id);
  assert.throws(() => C.createRecord('school','roles',item.id,'x','2026-10-27'));
});

test('parallel qualitative dimensions and nonbinary knowledge remain in factual input', () => {
  const w = M.clean({
    context:{autonomy:'לצוות יש מרחב בחירה בהקצאת זמן, בגבולות המנדט'},
    evidence:[{id:'e1',title:'דיווח הצוות',kind:'account'}],
    mechanisms:[{id:'m1',title:'מסורת משותפת',knowledgeState:'different',evidenceIds:['e1'],
      socialValue:'ערך תרבותי בפני עצמו',hiddenFunctions:'עוד לא ברור',cooperationPractice:'חלוקת אחריות',
      autonomyContribution:'המשתתפים מציעים ומחליטים יחד',autonomyConditions:'לא רק בעלי התפקידים; החלטות תקציביות דורשות אישור',
      use:'מועט',overlap:'חלקית',repetition:'יש פניות חוזרות',needFit:'לקבוצה קטנה',loadCapacity:'אותם אנשים',
      dependency:'ערוץ יחיד',trend:'התרשמות הצוות: מתרחב',trendBasis:'אין עדיין תצפיות בנות השוואה',trendPeriod:'ספטמבר–אוקטובר',supportRequirements:'זמן ומרחב נגיש'}],
    roles:[{id:'r1',knowledgeState:'planned'}], resources:[{id:'x1',knowledgeState:'not_applicable'}]
  });
  const input = A.buildInput(w,{kind:'school',label:'בית ספר'},['e1']);
  assert.equal(input.mechanisms[0].use,'מועט');
  assert.equal(input.mechanisms[0].socialValue,'ערך תרבותי בפני עצמו');
  assert.equal(input.mechanisms[0].overlap,'חלקית');
  assert.equal(input.mechanisms[0].knowledgeState,'different');
  assert.equal(input.mechanisms[0].trendBasis,'אין עדיין תצפיות בנות השוואה');
  assert.equal(input.mechanisms[0].supportRequirements,'זמן ומרחב נגיש');
  assert.equal(input.context.autonomy,'לצוות יש מרחב בחירה בהקצאת זמן, בגבולות המנדט');
  assert.equal(input.mechanisms[0].autonomyContribution,'המשתתפים מציעים ומחליטים יחד');
  assert.equal(input.mechanisms[0].autonomyConditions,'לא רק בעלי התפקידים; החלטות תקציביות דורשות אישור');
  assert.equal(w.roles[0].knowledgeState,'planned');
  assert.equal(w.resources[0].knowledgeState,'not_applicable');
});
