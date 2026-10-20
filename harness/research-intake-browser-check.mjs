// Local synthetic fixture only. Run the partnership browser server before this check.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = new URL(process.argv[2]);
assert.equal(base.hostname, '127.0.0.1', 'Only the local synthetic fixture is supported');
const out = resolve(process.argv[3] || '../research-plan/intake-browser');
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const results = [], errors = [], shots = [];
const report = { synthetic: true, results, screenshots: shots, pageErrors: errors, desktop: 1440, mobile: 390 };
const field = (page, label) => page.getByLabel(label, { exact: true });
const button = (page, label) => page.getByRole('button', { name: label, exact: true });
async function context(width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1100 }, locale: 'he-IL' });
  await ctx.route('**/*', route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  const page = await ctx.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { ctx, page };
}
function pass(name) { results.push(name); console.log('PASS ' + name); }
async function shot(page, name) {
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow: ' + name);
  await page.screenshot({ path: resolve(out, name + '.png'), fullPage: true });
  shots.push(name + '.png');
}
async function action(page, label, operation) {
  const pending = page.waitForResponse(response => response.request().method() === 'POST' && response.request().postDataJSON()?.action === operation);
  await button(page, label).click();
  const response = await pending, body = await response.json();
  assert.equal(response.status(), 200, operation + ': ' + JSON.stringify(body));
  return body;
}
async function fillApplication(page, type, title, name) {
  await field(page, 'סוג הפונה').selectOption(type);
  await field(page, 'כותרת הבקשה').fill(title);
  await field(page, 'שם מלא').fill(name);
  await field(page, 'דוא״ל').fill(type + '-browser@example.invalid');
  await field(page, 'מטרות בקצרה').fill('מחקר בדוי לבדיקת תקשורת ומוכנות משותפת.');
  await field(page, 'כלים מבוקשים').fill('תקשורת מקדמת חוסן חברתי');
  if (type === 'institution') await field(page, 'מוסד').fill('מוסד בדוי לבדיקת דפדפן');
  await field(page, 'קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם').check();
  assert.equal(await page.locator('input:not([dir="rtl"]),textarea:not([dir="rtl"])').count(), 0);
}
try {
  const publicDesktop = await context();
  await publicDesktop.page.goto(base.origin + '/research-partnership.html');
  await field(publicDesktop.page, 'כותרת הבקשה').waitFor();
  await shot(publicDesktop.page, 'public-desktop');
  const title = 'בקשת שותפות מבדיקת דפדפן';
  await fillApplication(publicDesktop.page, 'individual', title, 'דנה בדויה מהדפדפן');
  const submitted = await action(publicDesktop.page, 'הגשת בקשה', 'intakeSubmit');
  await publicDesktop.page.getByRole('heading', { name: 'הבקשה התקבלה לבדיקה' }).waitFor();
  assert.equal(submitted.receipt.status, 'submitted');
  assert.deepEqual(await publicDesktop.page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })), { local: [], session: [] });
  pass('anonymous individual submits without institution and receives receipt without browser persistence');

  const publicMobile = await context(390);
  await publicMobile.page.goto(base.origin + '/research-partnership.html');
  await field(publicMobile.page, 'כותרת הבקשה').waitFor();
  await fillApplication(publicMobile.page, 'institution', 'פנייה מוסדית מבדיקת דפדפן', 'נציגת מוסד בדויה מהדפדפן');
  await shot(publicMobile.page, 'public-mobile');
  await action(publicMobile.page, 'הגשת בקשה', 'intakeSubmit');
  await publicMobile.page.getByRole('heading', { name: 'הבקשה התקבלה לבדיקה' }).waitFor();
  pass('institution representative submits in mobile RTL layout');

  const owner = await context();
  await owner.page.goto(base.origin + '/qa/actor/owner');
  await owner.page.goto(base.origin + '/research-management.html?workspace=1');
  await button(owner.page, 'בקשות לשותפות').click();
  await button(owner.page, title).waitFor();
  await shot(owner.page, 'owner-inbox');
  await button(owner.page, title).click();
  await button(owner.page, 'יצירת מחקר כטיוטה מהבקשה').waitFor();
  const createdStudy = await action(owner.page, 'יצירת מחקר כטיוטה מהבקשה', 'studyCreate');
  await field(owner.page, 'מחקר לאישור').waitFor();
  await owner.page.waitForFunction(id => document.querySelector('[data-research-field="מחקר לאישור"]')?.value === id, createdStudy.study.id);
  await owner.page.getByText('קוד אישי חדש למחקר', { exact: true }).click();
  const createdIdentity = await action(owner.page, 'יצירת קוד אישי למחקר', 'intakeIdentityCreate');
  assert.equal(createdIdentity.identity.researchOnly, true);
  await owner.page.waitForFunction(code => document.querySelector('[data-research-field="זהות אישית מאומתת"]')?.value === code, createdIdentity.identity.code);
  await field(owner.page, 'וידוא זהות הפונה הושלם').check();
  const approved = await action(owner.page, 'אישור הבקשה וההרשאות שנבחרו', 'intakeReview');
  assert.equal(approved.application.status, 'approved');
  assert.deepEqual(approved.workspace.grantedPermissions, ['view_study', 'view_approved_findings']);
  assert.equal(approved.workspace.study.status, 'draft');
  pass('owner creates draft study and research-only identity from submitted data and grants only selected rights');

  await button(owner.page, 'כל השותפויות').click();
  const newPartnerCard = owner.page.getByRole('heading', { name: 'דנה בדויה מהדפדפן', exact: true }).locator('..');
  await newPartnerCard.getByRole('button', { name: 'פתיחת התיק', exact: true }).click();
  await owner.page.getByRole('heading', { name: 'המחקר וההרשאות בתיק', exact: true }).waitFor();
  assert.ok((await owner.page.locator('#research-root').innerText()).includes('מחקר בדוי לבדיקת תקשורת'));
  await shot(owner.page, 'owner-folder');
  await owner.page.setViewportSize({ width: 390, height: 844 });
  await shot(owner.page, 'owner-folder-mobile');
  pass('approved original application and actual study permissions appear in owner partner folder');

  const researcher = await context();
  await researcher.page.goto(base.origin + '/qa/actor/b');
  await researcher.page.goto(base.origin + '/research-management.html?workspace=1');
  assert.equal(await button(researcher.page, 'בקשות לשותפות').count(), 0);
  await button(researcher.page, 'פתיחת התיק').click();
  const selector = field(researcher.page, 'מחקר בתיק');
  await selector.waitFor();
  const studies = await selector.locator('option').evaluateAll(nodes => nodes.map(node => node.value));
  assert.equal(studies.length, 2);
  const first = await selector.inputValue();
  await selector.selectOption(studies.find(id => id !== first));
  await researcher.page.waitForFunction(id => document.querySelector('[data-research-field="מחקר בתיק"]')?.value === id, studies.find(id => id !== first));
  assert.ok(!(await researcher.page.locator('#research-root').innerText()).includes('דנה בדויה מהדפדפן'));
  await shot(researcher.page, 'researcher-folder');
  await researcher.page.setViewportSize({ width: 390, height: 844 });
  await shot(researcher.page, 'researcher-folder-mobile');
  pass('researcher sees her two authorized studies with working switcher and no owner inbox or sibling folder');
  assert.deepEqual(errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.message;
  throw error;
} finally {
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
