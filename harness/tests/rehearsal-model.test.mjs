import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const M=require('../../app/lib/rehearsal-model.js');

const activity={kind:'activity',purpose:'לבנות פינת עזרה הדדית',fields:{age:'כיתה ה',goal:'x'},resilienceComponents:['שייכות'],facilitatorGuide:'שאלה פתוחה',
  document:{html:'<p>SECRET-DOC</p>'},steps:[{id:'opening',phase:'פתיחה',title:'פתיחה',instructions:'מעגל שמות',minutes:5},{id:'main',phase:'פעילות מרכזית',title:'פעילות מרכזית',instructions:'עבודה בזוגות',minutes:20}]};
const conversation={kind:'conversation',purpose:'להסכים על צעד אחד',fields:{otherParty:'אמא של התלמיד',otherPerspective:'דואגת',myTraits:{a:'רגועה'}},
  facilitatorGuide:'שיחה ביחידות',steps:[{id:'opening',phase:'פתיחה',title:'איך פותחים',instructions:'תודה שבאת',minutes:3}]};

test('activity rehearsal: the model plays the group, from the approved version and the chosen step', () => {
  const s=M.turnSystem('activity',activity,'main');
  assert.match(s,/את משחקת את הקבוצה/);
  assert.match(s,/השלב שמתרגלים: "פעילות מרכזית"/);
  assert.match(s,/גיל המשתתפים: כיתה ה/);
  assert.doesNotMatch(s,/SECRET-DOC/,'the document tree is never sent');
});

test('conversation rehearsal: the model plays the other side, without group-only fields', () => {
  const s=M.turnSystem('conversation',conversation,'opening');
  assert.match(s,/את משחקת את הצד השני/);
  assert.match(s,/הצד השני: אמא של התלמיד/);
  assert.doesNotMatch(s,/רכיבי החוסן|המנגנון החברתי/);
});

test('feedback is about actions, without a score, with headings per kind', () => {
  const a=M.feedbackSystem('activity',activity,'opening'),c=M.feedbackSystem('conversation',conversation,'opening');
  for (const s of [a,c]) { assert.match(s,/בלי ציון/); assert.match(s,/\*\*מה עבד\*\*/); assert.match(s,/\*\*מה אפשר לנסות בפעם הבאה\*\*/); }
  assert.match(a,/\*\*מה זה בונה בחוסן החברתי\*\*/); assert.match(a,/\*\*לפני המפגש האמיתי\*\*/);
  assert.match(c,/\*\*מה זה מאפשר בקשר\*\*/); assert.match(c,/\*\*לפני השיחה האמיתית\*\*/);
});

test('approved version text is bounded and the transcript names each side', () => {
  const big={...activity,facilitatorGuide:'א'.repeat(20000),steps:Array.from({length:40},(_,i)=>({id:'s'+i,title:'שלב '+i,instructions:'ב'.repeat(900)}))};
  assert.ok(M.contentText(big).length<=6001);
  assert.equal(M.transcript([{role:'user',content:'שלום'},{role:'assistant',content:'היי'}],'conversation'),'אני: שלום\n\nהצד השני: היי');
  assert.equal(M.transcript([{role:'user',content:'נתחיל'}],'activity'),'המנחה: נתחיל');
});

test('sequence rehearsal sends only the session of the chosen step', () => {
  const seq={kind:'sequence',purpose:'מטרה',fields:{topic:'עזרה הדדית'},sessions:[{n:1,goal:'להכיר',product:'רשימה'},{n:2,goal:'לקבוע תורנות',product:'לוח'}],
    steps:[{id:'m1-opening',session:1,phase:'פתיחה',title:'פתיחה',instructions:'ONE-OPEN',minutes:5},{id:'m2-main',session:2,phase:'פעילות מרכזית',title:'פעילות מרכזית',instructions:'TWO-MAIN',minutes:20}]};
  const s=M.turnSystem('sequence',seq,'m2-main');
  assert.match(s,/את משחקת את הקבוצה/);assert.match(s,/TWO-MAIN/);assert.doesNotMatch(s,/ONE-OPEN/);
  assert.match(s,/מפגש 2 מתוך 2/);assert.match(s,/היעד של המפגש: לקבוע תורנות/);assert.match(s,/נושא הרצף: עזרה הדדית/);
  assert.match(M.feedbackSystem('sequence',seq,'m2-main'),/\*\*לפני המפגש האמיתי\*\*/);
});
