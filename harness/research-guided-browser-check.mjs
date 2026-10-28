// Run only against research-partnership-browser-server.mjs, with invented data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = new URL(process.argv[2]);
assert.equal(base.hostname, '127.0.0.1', 'Only the local synthetic fixture is supported');
const out = resolve(process.argv[3] || '../research-plan/guided-browser-u3');
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const P = require('../app/lib/research-partnership-core.js');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const report = { synthetic: true, desktop: 1440, mobile: 390, results: [], screenshots: [], pageErrors: [] };
const runTag = Date.now().toString();
const agreementTitle = 'הסכם מודרך | בדיקת דפדפן ' + runTag;
const researcherName = 'מובילת מחקר עדכנית | בדיקה ' + runTag;
const button = (page, name) => page.getByRole('button', { name, exact: true });
const field = (page, name) => page.getByLabel(name, { exact: true });
async function openActor(actor, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1100 }, locale: 'he-IL' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.goto(base.origin + '/qa/actor/' + actor);
  await page.goto(base.origin + '/research-management.html?workspace=1');
  await button(page, 'פתיחת התיק').first().waitFor();
  assert.match(await page.locator('body').innerText(), /כל המחקרים והזהויות כאן בדויים/);
  return { page, context };
}
async function reveal(control) {
  for (const summary of await control.locator('xpath=ancestor::details/summary').all()) {
    if (!await summary.evaluate(node => node.parentElement.open)) await summary.click();
  }
  await control.scrollIntoViewIfNeeded();
  return control;
}
async function action(page, label, operation) {
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.request().postDataJSON()?.action === operation);
  await button(page, label).click();
  const response = await responsePromise;
  const result = await response.json();
  assert.equal(response.status(), 200, operation + ' failed');
  return result;
}
async function shot(page, name) {
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow: ' + name);
  assert.deepEqual(await page.locator('input:not([dir="rtl"]),textarea:not([dir="rtl"]),select:not([dir="rtl"])').evaluateAll(nodes=>nodes.map(n=>({html:n.outerHTML.slice(0,350),parent:n.parentElement.outerHTML.slice(0,450)}))), []);
  await page.screenshot({ path: resolve(out, name + '.png'), fullPage: true });
  report.screenshots.push(name + '.png');
  await page.screenshot({path:resolve(out,name+'-focus.png')});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:resolve(out,name+'-top.png')});
  report.screenshots.push(name+'-focus.png',name+'-top.png');
}
function pass(name) { report.results.push(name); console.log('PASS ' + name); }
try {
  const owner = await openActor('owner');
  const card = owner.page.locator('section.r-card').filter({ has: owner.page.getByRole('heading', { name: /שושי|מובילת מחקר/ }) }).last();
  await card.getByRole('button', { name: 'פתיחת התיק', exact: true }).click();
  await button(owner.page, 'הסכם חדש').waitFor();
  const prepared = await action(owner.page, 'הסכם חדש', 'agreementPrepare');
  assert.equal(prepared.record.kind, 'agreement');
  assert.equal(prepared.record.status, 'draft');
  assert.equal(prepared.record.binding, false);
  if (prepared.template) assert.equal(prepared.template.record.status, 'draft');
  else assert.equal(prepared.resumed, true);
  await field(owner.page, 'כותרת').fill(agreementTitle);
  await (await reveal(field(owner.page, 'מטרות המחקר'))).fill('');
  const dateControl=owner.page.locator('input.sbe-date[aria-label="תחילת המחקר"]');
  await (await reveal(dateControl)).fill('12.11.26');
  await dateControl.press('Tab');
  const saved = await action(owner.page, 'שמירת טיוטה', 'recordSave');
  assert.equal(saved.version.data.objectives, '');
  assert.equal(saved.version.data.startDate, '2026-11-12');
  assert.equal(await dateControl.inputValue(), '12.11.26');
  assert.equal(await dateControl.getAttribute('dir'), 'rtl');
  assert.match(await owner.page.locator('body').innerText(), /הרשאות פעילות כעת/);
  assert.match(await owner.page.locator('body').innerText(), /כלים מוצעים מתוך הבקשה/);
  pass('owner prepares a nonbinding draft and saves a deliberate empty override');

  await button(owner.page, 'חזרה לתיק החוקרת').click();
  await button(owner.page, 'עריכת פרטים מקצועיים').click();
  await field(owner.page, 'שם מלא').fill(researcherName);
  await action(owner.page, 'שמירת הפרופיל', 'partnerSave');
  await button(owner.page, agreementTitle).click();
  await action(owner.page, 'בדיקת עדכונים מהמקורות', 'agreementRefreshPreview');
  const replaceLead = field(owner.page, 'החלפת שם החוקרת האחראית');
  await replaceLead.waitFor();
  assert.equal(await replaceLead.isChecked(), false);
  const replaceObjectives = field(owner.page, 'החלפת מטרות המחקר');
  assert.equal(await replaceObjectives.isChecked(), false);
  await replaceLead.check();
  const refreshed = await action(owner.page, 'החלת העדכונים שנבחרו', 'agreementRefreshApply');
  assert.equal(refreshed.version.data.objectives, '');
  assert.equal(refreshed.version.data.startDate, '2026-11-12');
  assert.equal(refreshed.version.data.leadResearcher, researcherName);
  await (await reveal(field(owner.page, 'תחולת נספח B'))).selectOption('not_applicable');
  await field(owner.page, 'נימוק לאי תחולת נספח B').fill('נספח זה הוחרג בניסוי המקומי בלבד ' + runTag);
  const excluded = await action(owner.page, 'שמירת טיוטה', 'recordSave');
  assert.equal(Object.hasOwn(excluded.version.data, 'annexB'), false);
  await shot(owner.page, 'owner-guided-agreement-desktop');
  pass('selected refresh preserves overrides and an inapplicable annex is excluded');

  await (await reveal(owner.page.getByRole('button', {name:'בדיקת הרשאת עיבוד',exact:true,includeHidden:true}))).click();
  await field(owner.page, 'מטרת העברה').selectOption('external_impact');
  await field(owner.page, 'ספק').fill('synthetic-provider');
  await field(owner.page, 'גרסת ספק').fill('synthetic-v1');
  await field(owner.page, 'שינויי הסכם').check();
  await field(owner.page, 'בעלת המערכת, הרשאת עיבוד').check();
  await owner.page.getByRole('checkbox', { name: /החוקרת בתיק.*הרשאת עיבוד/ }).check();
  for (const definition of P.PROCESSING_POLICY_FIELDS.filter(f => !['purpose', 'provider', 'providerVersion', 'dataCategories', 'authorizedActors'].includes(f.id))) {
    await owner.page.locator('[data-field-id="' + definition.id + '"]').fill('החלטת בדיקה מומצאת ומפורשת');
  }
  const policyDraft = await action(owner.page, 'שמירת הרשאת עיבוד כטיוטה', 'processingPolicySave');
  assert.equal(policyDraft.policy.approved, false);
  const policyApproved = await action(owner.page, 'אישור הרשאת העיבוד השמורה', 'processingPolicyApprove');
  assert.equal(policyApproved.policy.approved, true);
  assert.equal(policyApproved.policy.data.authorizedActors.length, 2);
  assert.doesNotMatch(await owner.page.locator('body').innerText(), /partyRoles|authorizedActors|agreement_changes|code:STAFFA/);
  await shot(owner.page, 'owner-processing-policy-desktop');
  pass('owner reviews and separately approves the exact processing policy with Hebrew actor choices');

  for (const width of [1440, 390]) {
    const partner = await openActor('a', width);
    await button(partner.page, 'פתיחת התיק').first().click();
    await button(partner.page, agreementTitle).click();
    await field(partner.page, 'כותרת').waitFor();
    assert.equal(await button(partner.page, 'הסכם חדש').count(), 0);
    assert.equal(await button(partner.page, 'בדיקת הרשאת עיבוד').count(), 0);
    assert.equal(await field(partner.page, 'שם החוקרת האחראית').inputValue(), researcherName);
    assert.equal(await field(partner.page, 'מטרות המחקר').inputValue(), '');
    await shot(partner.page, 'partner-guided-' + (width === 390 ? 'mobile' : 'desktop'));
    await partner.context.close();
  }
  pass('researcher resumes her prepared agreement in desktop and mobile RTL without owner controls');
  assert.deepEqual(report.pageErrors, []);
} finally {
  await browser.close();
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
}
