import test from 'node:test';
import assert from 'node:assert/strict';
import { getProvider, ProviderError } from '../lib/providers.mjs';
import { runGates } from '../lib/gates.mjs';
import { runPipeline } from '../lib/pipeline.mjs';
import { toScenario } from '../lib/to-scenario.mjs';

const red = 'קו אדום: גם במצבים מתוחים, אלימות מכל סוג, השפלה, זלזול או מניפולציה של סכום אפס אינם לגיטימיים.';
const source = { sourceId: 'approved', title: 'Synthetic approved citation', citation: 'Synthetic approved citation', approved: true };
const input = { given: { who: 'מורה והורה', whatHappened: 'נפגשו על מטלה', goals: 'לברר יחד' }, language: 'עברית', locked: { 'characters.actor.role': 'הורה' } };
function character(role) {
  return { role, nameAndAge: 'דמות בת 40', gender: 'נקבה', genderNote: '',
    domainMaterial: { thisWeek: 'קראה מטלה ביום שני', object: 'דף', lineUnderPressure: 'יש לי זמן', syntax: ['קצר'] },
    register: { answerLength: 'משפט אחד', insteadOfAnswering: 'בודקת דף', whenLong: 'כשיש שאלה' }, verbalTic: 'לפי הדף',
    visibleLayer: { emotions: ['דאגה'], needs: ['בירור'], statedPosition: 'נברר' },
    hiddenLayer: { emotions: ['חשש'], needs: ['אמון'], fear: 'החשש שהמידע יישאר חסר גם אחרי שנדבר ויהיה קשה להשלים אותו יחד' },
    wontSay: 'יש מידע חסר מאתמול שלא אמרתי', trustCondition: { form: 'נפתחת', what: 'ישאלו על האפשרויות', whyItWorks: 'תוכל לבחור' },
    pressureValve: 'בודקת שוב את הדף בתיק', contradiction: { fact: 'רצתה לברר אבל דחתה את הפגישה', howItCanSurface: 'לשאול על הזמן' } };
}
function fixture() {
  const stage1 = { rejectedDirections: ['א','ב','ג'], conflictNote: 'מידע חלקי',
    conflict: { surface: 'דיון במטלה', real: 'אי ודאות', asymmetry: { traineeDoesntKnow: 'פרט א', actorDoesntKnow: 'פרט ב' }, stakes: { trainee: 'אמון', actor: 'בחירה' } },
    setting: { place: 'חדר', timeAndCircumstance: 'אחרי שיעור' }, priorRelationship: 'מכירות', characters: { trainee: character('מורה'), actor: character('הורה') } };
  const point = { name: 'בירור', type: 'פתיחה', coreTurn: true, derivedFrom: 'characters.actor.trustCondition', trigger: 'מטלה',
    characterDoes: { line: 'מה אפשר לברר כעת?', action: 'מחזיקה דף' }, demands: 'להקשיב', ifMissed: 'תחכה', skill: 'הקשבה',
    branches: [{ traineeMove: 'שאלה', exampleWording: 'מה היית רוצה?', saidAloud: 'אפשר לחשוב יחד', underneath: 'יש בחירה', effect: 'פותח', quality: 'מקדם', next: 'בירור' }] };
  const stage2 = { turningPoints: [point], endings: Array.from({ length: 4 }, (_,i) => ({ name: 'בירור ' + i, howItLooks: 'קובעות המשך', whatItSays: 'השאלה נותרה פתוחה' })) };
  const stage3 = { scenarioName: 'על המטלה', scenarioSubtitle: 'שיחת בירור', sources: [{ sourceId: source.sourceId }], documents: {
    actor: { story: red + '\nנפגשו על מטלה', entrance: { posture: 'יושבת', doing: 'בודקת דף', firstLine: 'היי' },
      portrait: 'דמות', askAndBeneath: 'בקשה', arc: 'המשך', endingsProse: 'אפשרויות', whoSitsAcross: 'מורה', expectThis: 'שאלה' },
    facilitator: { fullBackground: red + '\nשיחת בירור', charactersProse: 'שתי דמויות', whatTheApproachSaysHere: 'הקשבה', dynamics: 'אי ודאות',
      skillsToTrain: 'הקשבה', observationPoints: 'שאלה', preSessionQuestions: 'מה נרצה?', debriefQuestions: 'מה השתנה?', reflectionQuestions: 'מה תנסי?' } } };
  const trainee = red + '\nנפגשו על מטלה\n---\n' + red + '\nלברר יחד';
  const output = { ...stage1, ...stage2, ...stage3, given: structuredClone(input.given), documents: { ...stage3.documents, trainee: trainee.split('\n---\n')[0], traineeStakes: trainee.split('\n---\n')[1] } };
  return { stage1, stage2, stage3, trainee, output };
}
const result = (text) => ({ text, toolCalls: [], usage: {}, status: 'completed', refusal: null, truncation: null });

test('F08: empty and partial scenarios fail required schema gates', () => {
  assert.equal(runGates({}, {}).passed, false);
  assert.equal(runGates({ scenarioName: 'only a title' }, {}).passed, false);
  const { output } = fixture();
  for (const bad of [null, 'not-an-array', {}, [null]]) {
    assert.equal(runGates({ ...output, turningPoints: bad }, input, { sourceLibrary: [source] }).passed, false);
  }
});

test('F08: nested valid documents pass; a spoofed lock elsewhere does not', () => {
  const { output } = fixture();
  assert.equal(runGates(output, input, { sourceLibrary: [source] }).passed, true);
  output.characters.actor.role = 'מנהלת';
  output.documents.actor.story += '\nהורה';
  assert.equal(runGates(output, input, { sourceLibrary: [source] }).passed, false);
});

test('F08: supplied context cannot approve a source or an unsupported language', () => {
  const { output } = fixture();
  assert.equal(runGates(output, { ...input, sourceLibrary: [source] }).passed, false);
  assert.equal(runGates(output, { ...input, language: 'unsupported' }, { sourceLibrary: [source] }).passed, false);
  output.sources = [{ citation: source.citation }];
  assert.equal(runGates(output, input, { sourceLibrary: [source] }).passed, false);
});

test('F08: pipeline rejects an empty stage before marking it done', async () => {
  const stages = [];
  await assert.rejects(runPipeline(input, { complete: async () => result('{}') }, { onStage: (...x) => stages.push(x) }), /stage1|שלב stage1|סכמה/);
  assert.equal(stages.some(([s,state]) => s === 'stage1' && state === 'done'), false);
});

test('F07: OpenAI preserves ordered history, system, files and forced tools through mocked real payload', async () => {
  let request;
  const provider = getProvider('openai', { apiKey: 'synthetic-only', transport: async r => {
    request = r;
    return { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'תגובה' }] },
      { type: 'function_call', call_id: 'call2', name: 'report_turn', arguments: '{"turn":2}' }], usage: { input_tokens: 12, output_tokens: 5 } };
  } });
  const r = await provider.complete({ system: 'system separated', messages: [{ role: 'user', content: 'first' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'call1', name: 'report_turn', input: { turn: 1 } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call1', content: 'done' }, { type: 'text', text: 'second' }] }],
    files: [{ name: 'brief.pdf', mediaType: 'application/pdf', data: 'cGRm' }],
    tools: [{ name: 'report_turn', description: 'Reports', input_schema: { type: 'object', properties: { turn: { type: 'number' } }, required: ['turn'] } }],
    toolChoice: { type: 'tool', name: 'report_turn' }, variation: 'medium', maxTokens: 100 });
  assert.equal(request.body.instructions, 'system separated');
  assert.equal(request.body.input[0].content[0].text, 'first');
  assert.equal(request.body.input[1].type, 'function_call');
  assert.equal(request.body.input[2].type, 'function_call_output');
  assert.equal(request.body.input[3].content[0].text, 'second');
  assert.equal(request.body.input[3].content[1].type, 'input_file');
  assert.deepEqual(request.body.tool_choice, { type: 'function', name: 'report_turn' });
  assert.equal(request.body.tools[0].parameters.required[0], 'turn');
  assert.deepEqual(r.toolCalls, [{ id: 'call2', name: 'report_turn', input: { turn: 2 } }]);
  assert.equal(r.status, 'completed');
  assert.equal(r.usage.inputTokens, 12);
});

test('Anthropic keeps adaptive thinking and prompt calls, including normalized file blocks and tools', async () => {
  const captured = [];
  const p = getProvider('anthropic', { apiKey: 'synthetic-only', transport: async r => {
    captured.push(r); return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'שלום' }], usage: { input_tokens: 3, output_tokens: 2 } };
  } });
  const promptResult = await p.complete({ prompt: 'old prompt', system: 'separate', variation: 'high', maxTokens: 100 });
  assert.deepEqual(captured[0].body.messages, [{ role: 'user', content: [{ type: 'text', text: 'old prompt' }] }]);
  assert.deepEqual(captured[0].body.thinking, { type: 'adaptive' });
  assert.deepEqual(captured[0].body.output_config, { effort: 'xhigh' });
  assert.equal(captured[0].body.system, 'separate');
  assert.equal(promptResult.usage.totalTokens, 5);
  await p.complete({ messages: [{ role: 'user', content: 'read' }], files: [
    { name: 'brief.pdf', mediaType: 'application/pdf', data: 'cGRm' },
    { name: 'note.txt', mediaType: 'text/plain', data: 'dGV4dA==' },
    { name: 'image.png', mediaType: 'image/png', data: 'cG5n' }], tools: [{ name: 'report_turn', input_schema: { type: 'object' } }], toolChoice: { type: 'tool', name: 'report_turn' } });
  assert.deepEqual(captured[1].body.messages[0].content.map(x => x.type), ['text','document','document','image']);
  assert.equal(captured[1].body.messages[0].content[2].source.data, 'text');
  assert.deepEqual(captured[1].body.tool_choice, { type: 'tool', name: 'report_turn' });
  assert.equal(captured[1].stream, true);
});

test('both adapters preserve ordered tool history and normalize tool-only results', async () => {
  let request;
  const p = getProvider('anthropic', { apiKey: 'synthetic-only', transport: async r => {
    request = r;
    return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'report_turn', input: { n: 2 } }], usage: { input_tokens: 4, output_tokens: 2 } };
  } });
  const history = [{ role: 'user', content: 'first', privateNotes: 'MUST NOT SEND' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'report_turn', input: { n: 1 } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'result' }, { type: 'text', text: 'continue' }] }];
  const r = await p.complete({ messages: history });
  assert.deepEqual(request.body.messages.map(x => x.role), ['user','assistant','user']);
  assert.equal(request.body.messages[2].content[0].tool_use_id, 't1');
  assert.equal(JSON.stringify(request.body).includes('MUST NOT SEND'), false);
  assert.deepEqual(r.toolCalls, [{ id: 't2', name: 'report_turn', input: { n: 2 } }]);
  assert.equal(r.text, '');
});

test('refusal, truncation and empty completion are typed failures carrying status and usage', async () => {
  const rawCases = [
    ['openai', { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'refused' }] }], usage: { input_tokens: 2, output_tokens: 1 } }, 'refused'],
    ['openai', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [], usage: { input_tokens: 2, output_tokens: 1 } }, 'incomplete'],
    ['anthropic', { stop_reason: 'refusal', content: [], usage: { input_tokens: 2, output_tokens: 1 } }, 'refused'],
    ['anthropic', { stop_reason: 'max_tokens', content: [{ type: 'text', text: 'partial' }], usage: { input_tokens: 2, output_tokens: 1 } }, 'incomplete'],
  ];
  for (const [name,raw,status] of rawCases) {
    let calls = 0;
    const p = getProvider(name, { apiKey: 'synthetic-only', transport: async () => { calls++; return raw; } });
    await assert.rejects(p.complete({ prompt: 'synthetic' }), e => e instanceof ProviderError && e.completionStatus === status && e.usage.inputTokens === 2 && e.result.status === status);
    assert.equal(calls, 1);
  }
  const p = getProvider('openai', { apiKey: 'synthetic-only', transport: async () => ({ status: 'completed', output: [] }) });
  await assert.rejects(p.complete({ prompt: 'synthetic' }), e => e.code === 'empty_output');
});

test('retry is bounded to one and cancellation prevents calls, while unsupported configurations fail before transport', async () => {
  let calls = 0;
  const p = getProvider('openai', { apiKey: 'synthetic-only', retryDelayMs: 0, transport: async () => { calls++; throw new ProviderError('synthetic timeout', { code: 'timeout', retryable: true }); } });
  await assert.rejects(p.complete({ prompt: 'synthetic' }), e => e instanceof ProviderError && e.code === 'timeout');
  assert.equal(calls, 2);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(p.complete({ prompt: 'synthetic', signal: controller.signal }), e => e.code === 'aborted');
  assert.equal(calls, 2);
  const badOptions = [
    { prompt: 'x', messages: [{ role: 'user', content: 'x' }] },
    { prompt: 'x', toolChoice: { type: 'tool', name: 'not_allowed' }, tools: [] },
    { prompt: 'x', files: [{ name: 'word.docx', mediaType: 'application/docx', data: 'dGV4dA==' }] },
    { prompt: 'x', variation: 'unknown' },
  ];
  for (const opts of badOptions) await assert.rejects(p.complete(opts), e => e.code === 'unsupported_configuration');
  assert.equal(calls, 2);
});

test('malformed tool JSON retains usage; known model limits and unsupported forced tools fail without a call', async () => {
  let calls = 0;
  const p = getProvider('openai', { apiKey: 'synthetic-only', transport: async () => { calls++; return {
    status: 'completed', output: [{ type: 'function_call', call_id: 'broken', name: 'report_turn', arguments: '{broken' }], usage: { input_tokens: 8, output_tokens: 3 }
  }; } });
  await assert.rejects(p.complete({ prompt: 'x' }), e => e.code === 'malformed_response' && e.usage.inputTokens === 8 && e.completionStatus === 'failed');
  assert.equal(calls, 1);
  assert.equal(p.maxOutputTokens, 32768);
  await assert.rejects(p.complete({ prompt: 'x', maxTokens: 64000 }), e => e.code === 'unsupported_configuration');
  assert.equal(calls, 1);
  const a = getProvider('anthropic', { apiKey: 'synthetic-only', model: 'claude-opus-5-5', transport: async () => { calls++; } });
  await assert.rejects(a.complete({ prompt: 'x', tools: [{ name: 'report_turn', input_schema: { type: 'object' } }], toolChoice: { type: 'tool', name: 'report_turn' } }), e => e.code === 'unsupported_configuration');
  assert.equal(calls, 1);
});

test('pipeline validates each stage, snapshots given, excludes hidden sources, and protects conversion', async () => {
  const original = structuredClone(input), f = fixture();
  const prompts = [];
  const provider = { complete: async opts => {
    prompts.push(opts.prompt);
    if (opts.variation === 'high') { original.given.goals = 'mutated during request'; return result(JSON.stringify(f.stage1)); }
    if (opts.variation === 'medium') return result(JSON.stringify(f.stage2));
    return opts.prompt.includes('חוזה המקורות:') ? result(JSON.stringify(f.stage3)) : result(f.trainee);
  } };
  const sources = [source, { sourceId: 'private', title: 'PRIVATE SECRET', approved: true, hidden: true }];
  const out = await runPipeline(original, provider, { sourceLibrary: sources });
  assert.deepEqual(out.given, input.given);
  assert.equal(prompts.join('\n').includes('PRIVATE SECRET'), false);
  assert.equal(out._gates.passed, true);
  const converted = toScenario(out, { input, sourceLibrary: sources });
  assert.deepEqual(converted.sourceRefs, [{ sourceId: 'approved' }]);
  assert.deepEqual(converted.facilitator.sources, [source.citation]);
  out.characters.actor.role = 'changed';
  await assert.rejects(async () => toScenario(out, { input, sourceLibrary: sources }), e => e.code === 'output_contract');
});

test('empty, invalid JSON and invalid later stages fail before done or persistence', async () => {
  for (const [stage,bad] of [['stage1','invalid JSON'], ['stage2','{}'], ['stage3','{}'], ['trainee','']]) {
    const f = fixture(), done = [];
    const p = { complete: async opts => {
      const which = opts.variation === 'high' ? 'stage1' : opts.variation === 'medium' ? 'stage2' : opts.prompt.includes('חוזה המקורות:') ? 'stage3' : 'trainee';
      return result(which === stage ? bad : which === 'trainee' ? f.trainee : JSON.stringify(f[which]));
    } };
    await assert.rejects(runPipeline(input, p, { sourceLibrary: [source], onStage: (s,state) => { if (state === 'done') done.push(s); } }));
    assert.equal(done.includes(stage), false, stage);
  }
  const f = fixture(); f.output.documents.traineeStakes += '\n' + f.output.characters.actor.wontSay;
  assert.equal(runGates(f.output, input, { sourceLibrary: [source] }).passed, false);
  f.output.documents.traineeStakes = red;
  f.output.given.goals += ' ';
  assert.equal(runGates(f.output, input, { sourceLibrary: [source] }).passed, false);
});
