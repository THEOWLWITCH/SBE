import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { workspaceFixture, reportFixture } from '../fixtures/journey-analysis.mjs';

const require = createRequire(import.meta.url);
const A = require('../../app/lib/journey-analysis-model.js');
const M = require('../../app/lib/journey-workspace-model.js');
const runtime = process.env.BE_GOOD_PLAYWRIGHT_MODULE;
const executablePath = process.env.BE_GOOD_BROWSER_PATH;
const source = name => readFileSync(new URL('../../app/lib/' + name, import.meta.url), 'utf8');
const scripts = ['journey-analysis-model.js','journey-workspace-model.js','journey-feedback.js','journey-workspace.js'].map(source);
const css = source('journey-workspace.css') + source('journey-feedback.css');

test('guided school and community journey: reviewed analysis, deliberation, history and stale-response protection', {
  skip: !runtime || !executablePath ? 'Set BE_GOOD_PLAYWRIGHT_MODULE and BE_GOOD_BROWSER_PATH to run the real browser acceptance test.' : false,
  timeout: 120000
}, async t => {
  const { chromium } = require(runtime);
  const browser = await chromium.launch({ headless:true, executablePath });
  async function pageFor(kind = 'school', width = 1280, workspace = workspaceFixture(kind)) {
    const page = await browser.newPage({ viewport:{width,height:900} });
    const errors = []; page.on('pageerror',e => errors.push(e.message));
    await page.setContent('<html dir="rtl" lang="he"><head></head><body><main id="host"></main></body></html>');
    await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:0;padding:16px;font:16px Arial}.card{padding:16px}.btn,.btn-secondary{padding:8px}' + css});
    for (const content of scripts) await page.addScriptTag({content});
    await page.evaluate(({kind,workspace,report}) => {
      window.SBE_JOURNEY = {UNITS:[{k:'school',t:'בית ספר'},{k:'community',t:'קהילה'}]};
      window.calls = []; window.modelCalls = []; window.waiting = []; window.holdStage = ''; window.failAudit = false;
      window.serverWorkspace = workspace; window.serverRevision = 2; window.confirmResult = true; window.confirm = () => window.confirmResult;
      window.printed = null; window.SBE_DOC = {print:options => { window.printed = {html:options.node.outerHTML,text:options.node.textContent,css:options.extraCss}; }};
      window.controller = SBE_WORKSPACE_UI.mount(document.querySelector('#host'),{
        journey:{id:'j1',unit:kind,unitName:kind === 'school' ? 'בית ספר בדוי' : 'קהילה בדויה',workspace,revision:2},
        api:async (action,body) => {
          calls.push({action,body});
          if (action === 'jrGet') return {journey:{mode:'workspace',revision:serverRevision,workspace:serverWorkspace}};
          if (action !== 'jrSaveWorkspace') throw Error('Unexpected API call');
          serverWorkspace = SBE_JOURNEY_WORKSPACE.clean(body.workspace); serverRevision++;
          return {ok:true,revision:serverRevision,workspace:serverWorkspace};
        },
        completeJson:async (system,messages,tokens,review,check) => {
          const payload = JSON.parse(messages[0].content), stage = payload.reviewedInput ? 'audit' : 'draft';
          modelCalls.push({system,payload,tokens,review,stage});
          if (holdStage === stage) await new Promise(resolve => waiting.push(resolve));
          const reply = stage === 'audit' && failAudit ? {...report,unknown:true} : report;
          if (!check(reply)) throw Error('Synthetic response rejected by the actual report validator');
          return reply;
        }
      });
    },{kind,workspace:M.clean(workspace),report:reportFixture()});
    return {page,errors};
  }
  async function analyze(page) {
    await page.locator('[data-step="analysis"]').click();
    await page.getByRole('group',{name:'בחירת הראיות לשליחה',exact:true}).getByRole('checkbox').first().check();
    await page.getByRole('button',{name:'הצגת המידע לשליחה',exact:true}).click();
  }
  async function generate(page) {
    await analyze(page); await page.locator('[data-ai-reviewed]').check(); await page.locator('[data-ai-generate]').click();
    await page.getByRole('button',{name:'שמירת הניתוח בניתוחי הצוות',exact:true}).waitFor();
  }
  async function save(page) { await page.getByRole('button',{name:'שמירת השינויים',exact:true}).click(); await page.waitForFunction(() => !controller.isDirty()); }
  try {
    await t.test('six steps and essential/optional fields work in both settings at desktop and mobile widths',async () => {
      for (const kind of ['school','community']) for (const width of [1280,390]) {
        const {page,errors} = await pageFor(kind,width);
        assert.equal(await page.locator('[data-step]').count(),6);
        assert.equal(await page.locator('.jws-all-sections').getAttribute('open'),null);
        assert.equal(await page.getByLabel('האוכלוסייה שבמיפוי',{exact:true}).inputValue(),kind === 'school' ? 'צוות בית ספר בדוי' : 'תושבי קהילה בדויה');
        await page.getByLabel('מי עדיין לא נשמעו',{exact:true}).fill('עוד קבוצה לשמיעה');
        await page.locator('[data-step="inventories"]').click();
        assert.equal(await page.locator('.jws-subnav button').count(),4);
        await page.locator('[data-step="depth"]').click();
        assert.equal(await page.getByLabel('מימוש',{exact:true}).inputValue(),'טרם נבדק');
        assert.equal(await page.getByLabel('נגישות',{exact:true}).isVisible(),false);
        await page.locator('.jws-depth > summary').click();
        assert.equal(await page.getByLabel('נגישות',{exact:true}).isVisible(),true);
        await page.locator('[data-step="network"]').click();
        assert.equal(await page.getByLabel('מי מפעילים את הקשר',{exact:true}).inputValue(),'אותו תפקיד בשני הערוצים');
        await page.locator('[data-step="learning"]').click();
        await page.locator('[data-step="context"]').click();
        assert.equal(await page.getByLabel('מי עדיין לא נשמעו',{exact:true}).inputValue(),'עוד קבוצה לשמיעה');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.deepEqual(errors,[]); await page.close();
      }
    });
    await t.test('preview is exact, graph-complete and requires review and an explicit request before either model pass',async () => {
      const {page,errors} = await pageFor(); await analyze(page);
      const preview = await page.locator('.jws-input-review').textContent();
      assert.match(preview,/m1/); assert.match(preview,/m2/); assert.match(preview,/r1/); assert.match(preview,/i1/); assert.match(preview,/s1/);
      assert.match(preview,/גרסת מבנה המידע: 1/); assert.match(preview,/פריטים שנוספו להבנת ההקשר/);
      assert.doesNotMatch(preview,/שם פרטי אסור להעברה|אסור שיועבר ללא בחירה|אין להעביר פירוש קודם/);
      assert.equal(await page.evaluate(() => modelCalls.length),0);
      assert.equal(await page.locator('[data-ai-generate]').isDisabled(),true);
      await page.locator('[data-ai-reviewed]').check(); assert.equal(await page.evaluate(() => modelCalls.length),0);
      await page.locator('[data-ai-generate]').click(); await page.getByRole('button',{name:'שמירת הניתוח בניתוחי הצוות',exact:true}).waitFor();
      const calls = await page.evaluate(() => modelCalls);
      assert.equal(calls.length,2); assert.deepEqual(calls.map(x => x.stage),['draft','audit']);
      assert.ok(calls.every(x => x.review === true && x.tokens === 16000));
      assert.deepEqual(calls[1].payload.reviewedInput,calls[0].payload);
      assert.deepEqual(calls[0].payload,A.buildInput(M.clean(workspaceFixture()),{kind:'school',label:'בית ספר בדוי'},['e1']));
      await page.locator('[data-step="context"]').click(); await page.locator('[data-step="analysis"]').click();
      assert.equal(await page.getByRole('button',{name:'שמירת הניתוח בניתוחי הצוות',exact:true}).count(),1);
      assert.deepEqual(errors,[]); await page.close();
    });
    await t.test('team response does not approve action; explicit option creates empty-assignment drafts with source navigation',async () => {
      const {page,errors} = await pageFor('community',390); await generate(page);
      await page.getByRole('button',{name:'שמירת הניתוח בניתוחי הצוות',exact:true}).click();
      await page.getByText('התייחסות הצוות',{exact:true}).click();
      await page.getByLabel('עמדת הצוות',{exact:true}).selectOption('rejected');
      await page.getByLabel('תגובת הצוות',{exact:true}).fill('יש עדות אחרת שעדיין לא נכללה.');
      await page.getByLabel('מי בחנו בצוות',{exact:true}).fill('צוות המיפוי');
      await page.getByRole('button',{name:'תיעוד ההתייחסות',exact:true}).click();
      await save(page);
      let stored = await page.evaluate(() => serverWorkspace);
      assert.equal(stored.analyses[0].responses[0].state,'rejected'); assert.equal(stored.decisions.length,0); assert.equal(stored.actions.length,0);
      await page.getByText('החלופות ושיקולי הבחירה',{exact:true}).click();
      await page.getByRole('button',{name:'יצירת טיוטת פעולה',exact:true}).click();
      assert.equal(await page.evaluate(() => controller.isDirty()),false);
      await page.getByLabel('החלופה שנבחרה לדיון',{exact:true}).selectOption('o2');
      await page.getByLabel('נימוק הצוות לבחירה',{exact:true}).fill('נבחן באופן מוגבל ובזמן שהצוות יקצה.');
      await page.getByRole('button',{name:'יצירת טיוטת פעולה',exact:true}).click();
      assert.equal(await page.getByLabel('אחריות',{exact:true}).inputValue(),'');
      assert.equal(await page.getByLabel('זמן ומשאבים שהוקצו',{exact:true}).inputValue(),'');
      await save(page); stored = await page.evaluate(() => serverWorkspace);
      assert.equal(stored.decisions.length,1); assert.equal(stored.actions.length,1);
      assert.equal(stored.decisions[0].approvedBy,''); assert.equal(stored.actions[0].authority,''); assert.equal(stored.actions[0].owner,'');
      assert.deepEqual(stored.actions[0].decisionId,[stored.decisions[0].id]);
      assert.equal(stored.actions[0].analysisId,stored.analyses[0].id);
      await page.getByRole('button',{name:'פתיחת ניתוח המקור והחלופות',exact:true}).click();
      assert.equal(await page.getByText('תמצית לצוות',{exact:true}).isVisible(),true);
      await page.getByRole('button',{name:'הדפסת תמונת המצב',exact:true}).click();
      const printed = await page.evaluate(() => window.printed);
      assert.match(printed.text,/משוב לצוות/); assert.match(printed.text,/צוות המיפוי/); assert.doesNotMatch(printed.html,/<textarea|<select|<input/);
      assert.deepEqual(errors,[]); await page.close();
    });
    await t.test('edits or review revocation while drafting prevent audit and invalid audit never becomes a report',async () => {
      for (const mode of ['edit','revoke','audit']) {
        const {page,errors} = await pageFor(); await page.evaluate(mode => { holdStage = mode === 'audit' ? '' : 'draft'; failAudit = mode === 'audit'; },mode);
        await analyze(page); await page.locator('[data-ai-reviewed]').check(); await page.locator('[data-ai-generate]').click();
        if (mode === 'edit') { await page.locator('[data-step="context"]').click(); await page.getByLabel('מה רוצים לקדם',{exact:true}).fill('מטרה השתנתה בזמן ההמתנה'); }
        if (mode === 'revoke') await page.locator('[data-ai-reviewed]').uncheck();
        if (mode !== 'audit') await page.evaluate(() => waiting.shift()());
        if (mode === 'edit') await page.locator('[data-step="analysis"]').click();
        if (mode === 'audit') await page.locator('.jws-content').getByText('לא התקבל ניתוח תקין בשני שלבי הבדיקה.',{exact:false}).waitFor();
        await page.waitForTimeout(40);
        assert.equal(await page.getByRole('button',{name:'שמירת הניתוח בניתוחי הצוות',exact:true}).count(),0);
        assert.equal(await page.evaluate(() => modelCalls.length),mode === 'audit' ? 2 : 1);
        assert.deepEqual(errors,[]); await page.close();
      }
    });
    await t.test('historical evidence survives mapping edits; baseline comparison is explicit and deletion is declared only after confirmation',async () => {
      const workspace = M.clean(workspaceFixture());
      workspace.analyses.push(A.cleanAnalysis({id:'a1',createdAt:'2026-10-26T10:00:00.000Z',sourceRevision:1,input:A.buildInput(workspace,{kind:'school',label:'בית ספר'},['e1']),output:reportFixture(),responses:[]}));
      const {page,errors} = await pageFor('school',1280,workspace);
      await page.getByLabel('תחילת תקופת המיפוי',{exact:true}).fill('2026-10-05'); await save(page);
      await page.locator('[data-step="analysis"]').click();
      assert.equal(await page.getByText('זהו דוח המבוסס על תמונת מידע קודמת.',{exact:false}).count(),1);
      await page.getByRole('group',{name:'בחירת הראיות לשליחה',exact:true}).getByRole('checkbox').first().check();
      await page.locator('#jws-baseline').selectOption('a1'); await page.getByRole('button',{name:'הצגת המידע לשליחה',exact:true}).click();
      await page.getByText('השוואת המידע שנבדק בין שתי תמונות המצב',{exact:true}).click();
      assert.match(await page.locator('.jws-comparison').textContent(),/2026-10-01/); assert.match(await page.locator('.jws-comparison').textContent(),/2026-10-05/);
      await page.evaluate(() => confirmResult = false); await page.getByRole('button',{name:'מחיקת הדוח השמור',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'מחיקת הדוח השמור',exact:true}).count(),1);
      await page.evaluate(() => confirmResult = true); await page.getByRole('button',{name:'מחיקת הדוח השמור',exact:true}).click(); await save(page);
      const result = await page.evaluate(() => calls.filter(x => x.action === 'jrSaveWorkspace').at(-1));
      assert.deepEqual(result.body.removedAnalysisIds,['a1']); assert.equal(result.body.workspace.analyses.length,0);
      assert.deepEqual(errors,[]); await page.close();
    });
  } finally { await browser.close(); }
});
