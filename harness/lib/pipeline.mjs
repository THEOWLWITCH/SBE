// ארבעת שלבי הצינור. כל שלב מקבל את פלט קודמו.
import { loadPrompt, fill, extractJson } from './prompts.mjs';
import { assertCompletionResult, ProviderError } from './providers.mjs';
import { assertGenerationInput, assertStageContract, approvedSources, runGates, OutputContractError } from './gates.mjs';

// גם 24000 נקטע בפועל (28/09/2026) — טוקני החשיבה נספרים באותה תקרה, ושלב 1
// רץ ב-effort xhigh. זו תקרה בלבד (המודל לא כותב יותר ממה שצריך); הקריאות
// רצות ב-streaming (providers.mjs), אז תשובה ארוכה לא נחתכת על שקט בחיבור.
const MAX_TOKENS = 64000;

export async function runPipeline(input, provider, { sourceLibrary = [], onStage = () => {}, maxTokens = MAX_TOKENS, signal } = {}) {
  assertGenerationInput(input);
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_TOKENS) throw new OutputContractError('input', ['maxTokens חייב להיות מספר שלם בין 1 ל-64000']);
  // Freeze the validated work version for this run. Model output cannot replace given data.
  input = structuredClone(input);
  const sources = approvedSources(sourceLibrary);
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  const t0 = Date.now();
  const trace = [];
  const step = async (stage, variation, prompt, json = true) => {
    const s = Date.now();
    onStage(stage, 'start');
    try {
      if (controller.signal.aborted) throw new ProviderError('הבקשה בוטלה', { code: 'aborted' });
      const r = assertCompletionResult(await provider.complete({ prompt, variation, maxTokens, signal: controller.signal }));
      trace.push({ stage, ms: Date.now() - s, usage: r.usage });
      if (controller.signal.aborted) throw new ProviderError('הבקשה בוטלה', { code: 'aborted' });
      let value;
      try { value = json ? extractJson(r.text) : r.text.trim(); }
      catch { throw new OutputContractError(stage, ['JSON לא תקין']); }
      assertStageContract(stage, value, input, { sourceLibrary: sources.map(s => ({ ...s, approved: true })) });
      onStage(stage, 'done');
      return value;
    } catch (e) {
      controller.abort(); onStage(stage, 'error');
      if (!(e instanceof OutputContractError)) e.message = `שלב ${stage}: ${e.message}`;
      throw e;
    }
  };

  try {
  // שלב 1 — דמויות וקונפליקט. כאן נדרשת השונות הגדולה ביותר.
  const s1 = await step('stage1', 'high',
    fill(loadPrompt('stage1'), { LOCKED_FIELDS: input.locked || {} }) +
    `\n\nנתוני הקלט:\n${JSON.stringify(input.given, null, 2)}`);

  // שלב 2 ופסקת המתנסה — שניהם תלויים רק ב-s1, לא אחד בשני, מריצים במקביל.
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
  const [s2, traineeRawFull] = await Promise.all([
    step('stage2', 'medium',
      fill(loadPrompt('stage2'), {
        STAGE1_OUTPUT: s1,
        APPROACH: input.approach || '',
        APPROACH_RULES: input.approachRules || '',
        EXPERIENCE: input.experience || 'קבוצה מנוסה',
        SKILLS: (input.skills || []).join(' · '),
      })),
    step('trainee', 'low',
      fill(loadPrompt('trainee'), { TRAINEE_VISIBLE_DATA: visible }), false),
  ]);
  const traineeRaw = traineeRawFull.trim();
  const traineeParts = traineeRaw.split(/\n\s*-{3,}\s*\n/);
  const traineeDoc = traineeParts[0].trim();
  const traineeStakes = (traineeParts[1] || '').trim();

  // שלב 3 — כתיבת המסמכים. דיוק, לא המצאה.
  const s3 = await step('stage3', 'low',
    fill(loadPrompt('stage3'), {
      STAGE1_OUTPUT: s1, STAGE2_OUTPUT: s2,
      APPROACH: input.approach || '', APPROACH_RULES: input.approachRules || '',
      LANGUAGE: input.language || 'עברית',
      SKILLS: (input.skills || []).join(' · '),
      SOURCES: sources.length ? JSON.stringify(sources, null, 2) : '(אין מקורות בספרייה. אל תכתבי מקורות.)',
    }) + '\n\nחוזה המקורות: sources הוא מערך אובייקטים עם sourceId מהבנק המאושר בלבד. אפשר להוסיף citation זהה בדיוק לציטוט שבבנק. אין לכתוב מחרוזת מקור בלי sourceId. אם אין מקור מתאים, החזירי sources: [].');

  const output = {
    given: structuredClone(input.given),
    scenarioName: s3.scenarioName || s1.scenarioName,
    scenarioSubtitle: s3.scenarioSubtitle || s1.scenarioSubtitle,
    characters: s1.characters,
    conflict: s1.conflict,
    conflictNote: s1.conflictNote,
    setting: s1.setting,
    priorRelationship: s1.priorRelationship,
    rejectedDirections: s1.rejectedDirections,
    turningPoints: s2.turningPoints,
    endings: s2.endings,
    sources: s3.sources,
    documents: { ...s3.documents, trainee: traineeDoc, traineeStakes },
    _trace: trace,
    _ms: Date.now() - t0,
  };
  const gates = runGates(output, input, { sourceLibrary: sources.map(s => ({ ...s, approved: true })) });
  if (!gates.passed) throw new OutputContractError('final', gates.flagged.filter(g => g.kind === 'exact').map(g => g.detail || g.name));
  output._gates = gates;
  const usages = trace.map(t => t.usage || {});
  const sum = key => usages.some(u => typeof u[key] === 'number') ? usages.reduce((n,u) => n + (u[key] || 0),0) : null;
  output.usage = { inputTokens: sum('inputTokens') ?? sum('input_tokens'), outputTokens: sum('outputTokens') ?? sum('output_tokens'), totalTokens: sum('totalTokens') ?? sum('total_tokens') };
  if (output.usage.totalTokens === null && output.usage.inputTokens !== null && output.usage.outputTokens !== null) output.usage.totalTokens = output.usage.inputTokens + output.usage.outputTokens;
  return output;
  } finally { signal?.removeEventListener('abort', abort); }
}
