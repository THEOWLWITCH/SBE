// ממיר את פלט הצינור (runPipeline) לפורמט scenario.json שממנו build-docs.mjs
// ו-lib/doc-render.mjs מרכיבים את ארבעת המסמכים.
//
// עד 21/09/2026 לא היה שום קישור בין השניים: הצינור החזיר JSON במבנה של
// השלבים (characters.actor.visibleLayer, turningPoints[].characterDoes...),
// ו-scenario.json של "יש לך גן טוב" נבנה ידנית. עכשיו כל תרחיש שיוצא
// מהצינור עובר כאן פעם אחת ויוצא בפורמט שהתבנית קוראת — כולל שדות הפרוזה
// שהמודל כותב בשלב 3 (portrait / askAndBeneath / arc / portraitForActor /
// charactersProse / dynamics), לפי prompts/narrative-products.md.
//
//   import { toScenario } from './to-scenario.mjs';
//   const scenario = toScenario(pipelineOutput, { input, meta });
//   writeFileSync('app/scenarios/x.json', JSON.stringify(scenario, null, 2));

const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : x ? [x] : []);
const str = (x) => (x == null ? '' : String(x));
// טקסט חופשי → פסקאות (המודל לפעמים מחזיר מחרוזת אחת עם שורות ריקות במקום מערך).
const toParas = (x) => (Array.isArray(x) ? x.filter(Boolean) : str(x).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean));

const TYPE_MAP = { 'פתיחה': 'פתיחה', 'סגירה': 'סגירה', 'מותנה': 'מותנה', 'היפוך': 'היפוך', 'ניתוק': 'ניתוק', 'פתיחה עמוקה': 'פתיחה עמוקה' };

export function toScenario(out, { input = {}, meta = {} } = {}) {
  const ch = out.characters || {};
  const a = ch.actor || {}, t = ch.trainee || {};
  const docs = out.documents || {};
  const da = docs.actor || {}, df = docs.facilitator || {};
  const asym = (out.conflict && out.conflict.asymmetry) || {};
  const dm = a.domainMaterial || {}, reg = a.register || {};
  const vis = a.visibleLayer || {}, hid = a.hiddenLayer || {};
  const tdm = t.domainMaterial || {}, treg = t.register || {};
  const tvis = t.visibleLayer || {}, thid = t.hiddenLayer || {};
  const trust = a.trustCondition || {};
  const contra = a.contradiction || {};
  const today = new Date();
  const id = meta.id || `TR-${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(meta.seq || 1).padStart(2, '0')}`;

  const turningPoints = arr(out.turningPoints).map((tp, i) => ({
    n: i + 1,
    name: str(tp.name),
    type: TYPE_MAP[str(tp.type)] || str(tp.type) || 'פתיחה',
    core: !!(tp.coreTurn || tp.core),
    trigger: str(tp.trigger),
    does: [str((tp.characterDoes || {}).line || tp.does), str((tp.characterDoes || {}).action)].filter(Boolean).join(' — '),
    demands: str(tp.demands),
    missed: str(tp.ifMissed || tp.missed),
    branches: arr(tp.branches).map((b) => ({
      move: [str(b.traineeMove || b.move), b.exampleWording ? `"${str(b.exampleWording)}"` : ''].filter(Boolean).join(': '),
      says: str(b.saidAloud || b.says),
      effect: str(b.effect),
      quality: str(b.quality),
    })),
  }));

  const endings = arr(out.endings).map((e) => (typeof e === 'string' ? e : [str(e.howItLooks), str(e.whatItSays)].filter(Boolean).join(' ')));
  const skills = arr(input.skills).length ? arr(input.skills) : toParas(df.skillsToTrain);

  return {
    id,
    name: str(out.scenarioName),
    subtitle: str(out.scenarioSubtitle),
    institution: str(meta.institution || 'מכללה לחינוך'),
    creator: str(meta.creator || ''),
    date: str(meta.date || today.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })),
    language: str(input.language || 'עברית'),
    duration: str(meta.duration || '5'),
    age: str(meta.age || input.age || ''),
    audience: str(meta.audience || ''),
    approach: str(input.approach || ''),
    conflictType: str(input.conflictType || (out.conflict || {}).type || ''),
    experience: str(input.experience || 'קבוצה מנוסה'),
    redLine: 'קו אדום: גם במצבים מתוחים, אלימות מכל סוג, השפלה, זלזול או מניפולציה של סכום אפס אינם לגיטימיים. אם זה קורה בכל זאת בסימולציה חיה, המנחה עוצרת את התרגיל ומתערבת — זה לא נרשם כישלון אישי, אלא רגע ללמידה משותפת.',
    trainee: {
      role: str(t.role),
      seniority: str(t.seniority || ''),
      anchor: [str(tdm.thisWeek), str(tdm.object)].filter(Boolean).join(' · '),
      traits: [str(treg.answerLength), str(treg.whenLong)].filter(Boolean),
      visibleEmotions: arr(tvis.emotions), hiddenEmotions: arr(thid.emotions),
      visibleNeeds: arr(tvis.needs), hiddenNeeds: arr(thid.needs),
      goal: str(tvis.statedPosition),
      likelyMoves: toParas(da.expectThis),
      knows: str(asym.actorDoesntKnow),
      opening: toParas(docs.trainee),
      portraitForActor: toParas(da.whoSitsAcross),
      stakesForTrainee: str(docs.traineeStakes),
    },
    actor: {
      nameAndAge: str(a.nameAndAge),
      gender: str(a.gender),
      role: str(a.role),
      story: toParas(da.story),
      material: [
        ['השבוע', str(dm.thisWeek)], ['החפץ', str(dm.object)],
        ['בלחץ תגידי', str(dm.lineUnderPressure)], ['איך את מנסחת', arr(dm.syntax).join(' · ')],
      ].filter(([, v]) => v),
      visible: [str(reg.answerLength), str(reg.whenLong), a.verbalTic ? `"${str(a.verbalTic).replace(/^"|"$/g, '')}"` : '', reg.insteadOfAnswering ? `במקום לענות: ${str(reg.insteadOfAnswering)}` : ''].filter(Boolean),
      hidden: [...arr(hid.emotions), ...arr(hid.needs), str(hid.fear), a.wontSay ? `לא תגידי: "${str(a.wontSay).replace(/^"|"$/g, '')}"` : ''].filter(Boolean),
      layerNote: str(out.conflictNote),
      knows: str(asym.traineeDoesntKnow),
      doesntKnow: str(asym.actorDoesntKnow),
      opens: [str(trust.what), str(trust.whyItWorks)].filter(Boolean).join('. '),
      valve: str(a.pressureValve),
      contradiction: [str(contra.fact), str(contra.howItCanSurface)].filter(Boolean).join(' '),
      entrance: {
        posture: str((da.entrance || {}).posture),
        doing: str((da.entrance || {}).doing),
        firstLine: str((da.entrance || {}).firstLine),
      },
      portrait: toParas(da.portrait),
      askAndBeneath: toParas(da.askAndBeneath),
      arc: toParas(da.arc),
      endingsProse: str(da.endingsProse),
    },
    turningPoints,
    endings,
    facilitator: {
      background: str(df.fullBackground),
      charactersProse: toParas(df.charactersProse || df.bothCharacters),
      approachInScenario: str(df.whatTheApproachSaysHere),
      dynamics: toParas(df.dynamics),
      skills,
      watchFor: toParas(df.observationPoints),
      preQuestions: toParas(df.preSessionQuestions),
      debrief: toParas(df.debriefQuestions),
      reflection: toParas(df.reflectionQuestions),
      sources: arr(out.sources),
    },
  };
}
