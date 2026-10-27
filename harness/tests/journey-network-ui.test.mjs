import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const runtime=process.env.BE_GOOD_PLAYWRIGHT_MODULE, executablePath=process.env.BE_GOOD_BROWSER_PATH;
const source=name=>readFileSync(new URL('../../app/lib/'+name,import.meta.url),'utf8');
const scripts=['journey-analysis-model.js','journey-network-model.js','journey-workspace-model.js','journey-network-ui.js'].map(source);

test('network workbench preserves baseline, captures future assessments and rejects a late scenario reply', {
  skip:!runtime || !executablePath ? 'Set browser runtime to exercise the real interface.' : false,timeout:120000
},async()=>{
  const {chromium}=require(runtime), browser=await chromium.launch({headless:true,executablePath});
  try {
    for (const kind of ['school','community']) for (const width of [1280,390]) {
      const page=await browser.newPage({viewport:{width,height:900}}), errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.setContent('<html lang="he" dir="rtl"><body><main id="host"></main></body></html>');
      await page.addStyleTag({content:'*{box-sizing:border-box}body{font:16px Arial;margin:16px}'+source('journey-workspace.css')+source('journey-network.css')});
      for(const content of scripts) await page.addScriptTag({content});
      await page.evaluate(kind=>{
        window.SBE_JOURNEY={};window.n=0;window.dirty=false;window.modelCalls=[];window.releases=[];window.hold=false;window.failAudit=false;window.confirm=()=>true;
        window.data=SBE_JOURNEY_WORKSPACE.clean({mechanisms:[{id:'m1',title:'תקשורת'},{id:'m2',title:'למידה'}],links:[{id:'l1',from:['m1'],to:['m2'],type:'info',status:'observed'}]});
        data.lab ||= SBE_JOURNEY_NETWORK.empty();
        const render=()=>{const host=document.querySelector('#host');host.replaceChildren();controller.render(host);};
        window.controller=SBE_NETWORK_UI.create({getWorkspace:()=>data,getRevision:()=>2,unit:{kind,label:'מסגרת בדויה'},cleanMap:v=>SBE_JOURNEY_NETWORK.mapOf(SBE_JOURNEY_WORKSPACE.clean(v)),schema:SBE_JOURNEY_WORKSPACE.SECTIONS,uid:()=> 'r_'+(++n),message:(t,error)=>window.lastMessage={t,error},changed:()=>{dirty=true;controller.invalidate();},rerender:render,draftDecision:v=>window.decision=v,
          renderFields:(parent,key,record,map,onChange,prefix)=>{const label=document.createElement('label');label.textContent='שם הרשומה המוצעת';const input=document.createElement('input');input.value=record.title || '';input.addEventListener('input',()=>{record.title=input.value;onChange();});label.append(input);parent.append(label);},
          completeJson:async(system,messages,tokens,review,check)=>{const payload=JSON.parse(messages[0].content),input=payload.reviewedInput || payload;modelCalls.push(input);if(hold) await new Promise(resolve=>releases.push(resolve));const result={summary:'משוב בדוי לבדיקת הממשק',direct:[],conditional:[],hypotheses:[],comparisons:input.futures.map(f=>({futureId:f.id,present:'לבדיקה',future:'אפשרות',tensions:'',needs:'',preparation:'',signals:'',unknown:''})),supportSuggestions:[]};if(failAudit && payload.reviewedInput)result.comparisons=[];if(!check(result)) throw Error('invalid fixture');return result;}
        });render();
      },kind);
      await page.getByRole('button',{name:'חלופה חדשה מהמיפוי הקיים',exact:true}).click();
      await page.getByLabel('שם החלופה',{exact:true}).fill('מעגל למידה חדש');
      await page.locator('[data-network-view="map"]').click();
      await page.getByRole('button',{name:'הוספת פריט מוצע',exact:true}).click();
      await page.getByLabel('שם הרשומה המוצעת',{exact:true}).fill('מנגנון מוצע ללא ראיה');
      assert.equal(await page.evaluate(()=>data.mechanisms.length),2);
      assert.equal(await page.evaluate(()=>data.lab.alternatives[0].proposal.mechanisms.length),3);
      await page.locator('[data-network-view="futures"]').click();
      for(const [title,conditions] of [['התרחבות','הצטרפות משתתפים'],['זמן מצטמצם','פחות זמן משותף']]) {
        await page.getByRole('button',{name:'הוספת עתיד אפשרי',exact:true}).click();
        await page.getByLabel('שם העתיד האפשרי',{exact:true}).fill(title);
        await page.getByLabel('תנאים אפשריים',{exact:true}).fill(conditions);
      }
      await page.locator('[data-network-view="assessment"]').click();
      assert.equal(await page.locator('[data-future-assessment]').count(),2);
      await page.locator('[data-future-assessment]').first().getByRole('textbox').first().fill('מקום לפעולה יחד');
      assert.equal(await page.evaluate(()=>data.lab.alternatives[0].assessments.length),1);
      await page.locator('[data-network-view="feedback"]').click();
      await page.getByRole('button',{name:'הצגת המידע לתרחיש',exact:true}).click();
      await page.locator('[data-network-reviewed]').check();
      await page.getByRole('button',{name:'בקשת משוב לתרחיש',exact:true}).click();
      await page.getByText('משוב בדוי לבדיקת הממשק',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>modelCalls.length),2);
      assert.equal(await page.evaluate(()=>modelCalls[0].proposal.mechanisms.length),3);
      assert.match(await page.evaluate(()=>controller.report().textContent),/מקום לפעולה יחד/);
      await page.getByRole('button',{name:'יצירת טיוטת החלטה מהחלופה',exact:true}).click();
      assert.equal(await page.evaluate(()=>decision.approvedBy),'');
      const previousFeedback=await page.evaluate(()=>JSON.stringify(data.lab.alternatives[0].feedback));
      await page.evaluate(()=>failAudit=true);
      await page.getByRole('button',{name:'הצגת המידע לתרחיש',exact:true}).click();
      await page.locator('[data-network-reviewed]').check();
      await page.getByRole('button',{name:'בקשת משוב לתרחיש',exact:true}).click();
      await page.getByText(/הבקשה לא הושלמה בשני שלבי הבדיקה/).waitFor();
      assert.equal(await page.evaluate(()=>JSON.stringify(data.lab.alternatives[0].feedback)),previousFeedback);
      await page.evaluate(()=>failAudit=false);
      await page.getByRole('button',{name:'הצגת המידע לתרחיש',exact:true}).click();
      await page.locator('[data-network-reviewed]').check();await page.evaluate(()=>hold=true);
      await page.getByRole('button',{name:'בקשת משוב לתרחיש',exact:true}).click();
      await page.waitForFunction(()=>releases.length===1);
      assert.equal(await page.evaluate(()=>controller.hasPending()),true);
      await page.getByLabel('שם החלופה',{exact:true}).fill('שם מעודכן בזמן ההמתנה');
      await page.evaluate(()=>{hold=false;releases.splice(0).forEach(r=>r());});
      await page.waitForTimeout(50);
      assert.equal(await page.evaluate(()=>controller.hasPending()),false);
      assert.equal(await page.evaluate(()=>data.lab.alternatives[0].feedback.input.title),'מעגל למידה חדש');
      await page.locator('[data-network-view="map"]').click();
      await page.getByLabel('בחירת פריט מוצע',{exact:true}).selectOption('m1');
      await page.getByRole('button',{name:'השהיית הפעולה בחלופה',exact:true}).click();
      assert.deepEqual(await page.evaluate(()=>data.lab.alternatives[0].inactiveIds),['m1']);
      await page.locator('[data-network-view="comparison"]').click();
      assert.ok(await page.getByText(/בהנחת ההשהיה, השתתפות בקשר/).count());
      await page.locator('[data-network-view="map"]').click();
      await page.getByRole('button',{name:'הסרת הפריט מהחלופה',exact:true}).click();
      assert.equal(await page.evaluate(()=>data.lab.alternatives[0].proposal.links.length),0);
      assert.equal(await page.evaluate(()=>data.lab.alternatives[0].baseline.links.length),1);
      assert.equal(await page.evaluate(()=>data.links.length),1);
      await page.locator('[data-network-view="futures"]').click();
      await page.getByRole('button',{name:'הסרת העתיד האפשרי',exact:true}).click();
      assert.equal(await page.evaluate(()=>data.lab.futures.length),1);
      assert.equal(await page.evaluate(()=>data.lab.alternatives[0].assessments.length),1);
      assert.equal(await page.evaluate(()=>data.lab.alternatives[0].feedback.input.futures.length),2);
      assert.equal(await page.evaluate(()=>SBE_JOURNEY_NETWORK.clean(data.lab,v=>SBE_JOURNEY_NETWORK.mapOf(SBE_JOURNEY_WORKSPACE.clean(v))).alternatives.length),1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.deepEqual(errors,[]);await page.close();
    }
  } finally {await browser.close();}
});
