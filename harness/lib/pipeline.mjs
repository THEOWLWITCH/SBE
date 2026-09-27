// ארבעת שלבי הצינור. כל שלב מקבל את פלט קודמו.
import { loadPrompt, fill, extractJson } from './prompts.mjs';

// 16000 נמדד כלא מספיק בפועל (19/09/2026): שלב 1 (שני גיליונות דמות מלאים +
// קונפליקט) נקטע עם "max_tokens נמוך מדי". אותו סדר גודל בדיוק כמו מה
// שנמדד באותו יום ב-input-screen.html (משימה דומה בהיקפה, דרשה 24000
// בפועל) — הועלה כאן לאותו ערך.
const MAX_TOKENS = 24000;

export async function runPipeline(input, provider, { sourceLibrary = [] } = {}) {
  const t0 = Date.now();
  const trace = [];
  const step = async (stage, variation, prompt) => {
    const s = Date.now();
    const r = await provider.complete({ prompt, variation, maxTokens: MAX_TOKENS });
    trace.push({ stage, ms: Date.now() - s, usage: r.usage });
    return r.text;
  };

  // שלב 1 — דמויות וקונפליקט. כאן נדרשת השונות הגדולה ביותר.
  const s1 = extractJson(await step('stage1', 'high',
    fill(loadPrompt('stage1'), { LOCKED_FIELDS: input.locked || {} }) +
    `\n\nנתוני הקלט:\n${JSON.stringify(input.given, null, 2)}`));

  // שלב 2 — חמש התפניות. גזירה, לא המצאה.
  const s2 = extractJson(await step('stage2', 'medium',
    fill(loadPrompt('stage2'), {
      STAGE1_OUTPUT: s1,
      APPROACH: input.approach || '',
      APPROACH_RULES: input.approachRules || '',
      EXPERIENCE: input.experience || 'קבוצה מנוסה',
      SKILLS: (input.skills || []).join(' · '),
    })));

  // פסקת המתנסה — קריאה נפרדת שלא מקבלת את המידע הסמוי.
  const visible = {
    traineeRole: s1.characters?.trainee?.role,
    traineeAnchor: s1.characters?.trainee?.domainMaterial,
    actorRole: s1.characters?.actor?.role,
    actorVisible: s1.characters?.actor?.visibleLayer,
    priorRelationship: s1.priorRelationship,
    event: input.given?.whatHappened,
    setting: s1.setting,
    traineeGoal: input.given?.goals,
  };
  // הקריאה מחזירה את פסקת הפתיחה, ואחרי מפריד "---" גם את "מה על הפרק
  // בשבילך" (21/09/2026, prompts/narrative-products.md). שני החלקים נכתבים
  // מאותם נתונים גלויים בלבד — לכן גם השני לא יכול להדליף.
  const traineeRaw = (await step('trainee', 'low',
    fill(loadPrompt('trainee'), { TRAINEE_VISIBLE_DATA: visible }))).trim();
  const traineeParts = traineeRaw.split(/\n\s*-{3,}\s*\n/);
  const traineeDoc = traineeParts[0].trim();
  const traineeStakes = (traineeParts[1] || '').trim();

  // שלב 3 — כתיבת המסמכים. דיוק, לא המצאה.
  const s3 = extractJson(await step('stage3', 'low',
    fill(loadPrompt('stage3'), {
      STAGE1_OUTPUT: s1, STAGE2_OUTPUT: s2,
      APPROACH: input.approach || '', APPROACH_RULES: input.approachRules || '',
      LANGUAGE: input.language || 'עברית',
      SKILLS: (input.skills || []).join(' · '),
      SOURCES: sourceLibrary.length ? sourceLibrary.join('\n') : '(אין מקורות בספרייה. אל תכתבי מקורות.)',
    })));

  return {
    scenarioName: s3.scenarioName || s1.scenarioName,
    scenarioSubtitle: s3.scenarioSubtitle || s1.scenarioSubtitle,
    characters: s1.characters,
    conflict: s1.conflict,
    rejectedDirections: s1.rejectedDirections,
    turningPoints: s2.turningPoints,
    endings: s2.endings,
    sources: s3.sources || [],
    documents: { ...s3.documents, trainee: traineeDoc, traineeStakes },
    _trace: trace,
    _ms: Date.now() - t0,
  };
}
