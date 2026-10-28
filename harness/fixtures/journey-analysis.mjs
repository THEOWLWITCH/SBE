// Fictional contract cases only. These are not approved or model-generated product examples.
export function workspaceFixture(kind = 'school') {
  return {
    context: { population: kind === 'school' ? 'צוות בית ספר בדוי' : 'תושבי קהילה בדויה', groups: 'קבוצה א וקבוצה ב', periodStart: '2026-10-01', periodEnd: '2026-10-26', participants: 'נציגי הצוות', missingVoices: 'קבוצה ב טרם נשמעה', baseline: 'קיים נוהל; השימוש עדיין בבירור', baselineAt: '2026-10-26', mandate: 'למפות ולהציע לדיון', delegation: 'החלטה בידי ההנהלה או האספה' },
    roles: [{ id: 'r1', title: 'תיאום', person: 'שם פרטי אסור להעברה', authority: 'תיאום בלבד', knowledgeState: 'present', updatedBy: 'הצוות', updatedAt: '2026-10-26', evidenceIds: ['e2'] }],
    mechanisms: [{ id: 'm1', title: 'מפגש', roleIds: ['r1'], infrastructureIds: ['i1'], resourceIds: ['s1'], knowledgeState: 'unexamined', existence: 'נוהל כתוב', realization: 'טרם נבדק', evidenceIds: ['e2'] }, { id: 'm2', title: 'עדכון', roleIds: ['r1'], evidenceIds: ['e2'], knowledgeState: 'conflicting' }, { id: 'm_unused', title: 'לא נבחר', evidenceIds: ['e2'] }],
    infrastructures: [{ id: 'i1', title: 'מקום מפגש', evidenceIds: ['e2'] }],
    resources: [{ id: 's1', title: 'שעת תיאום', evidenceIds: ['e2'] }],
    evidence: [{ id: 'e1', title: 'שיחה על הקשר', source: 'רישום מורשה', observedAt: '2026-10-26', kind: 'account', method: 'שיחת צוות', voices: 'רכזים', missingVoices: 'קבוצה ב', caseContext: 'שינוי במועד', caseTrigger: 'היעדרות', caseAction: 'נשלח עדכון', caseResult: 'חלק מהשותפים לא קיבלו', details: 'שני ערוצים נשענים על אותו תיאום', limits: 'ההשפעה לא נבדקה' }, { id: 'e2', title: 'מידע שלא נבחר', details: 'אסור שיועבר ללא בחירה' }],
    links: [{ id: 'l1', title: 'זרימת עדכון', from: ['m1'], to: ['m2'], type: 'info', status: 'formal', conditions: 'זמינות התיאום', operators: 'אותו תפקיד בשני הערוצים', actualFlow: 'טרם נבדק באופן מלא', sharedDependency: 'אותו רכז', barriers: 'היעדרות', alternative: 'ערוץ נוסף', alternativeAvailability: 'לא נבחנה עצמאות הגיבוי', evidenceIds: ['e1'] }],
    findings: [{ id: 'f_old', title: 'אין להעביר פירוש קודם', kind: 'question', origin: 'ai', state: 'draft' }], decisions: [], actions: [], reviews: [], analyses: []
  };
}

export function reportFixture() {
  return {
    summary: { overview: 'הקשר מתועד; פעולתו והגיבוי דורשים בירור.', keyFindingIds: ['f1'], limits: 'קבוצה ב לא נשמעה. אין כאן הוכחת תוצאה.' },
    findings: [{ id: 'f1', title: 'תלות משותפת אפשרית', kind: 'tension', observation: 'תועד כי שני ערוצים נשענים על אותו תפקיד.', interpretation: 'ייתכן שהערוצים אינם גיבויים עצמאיים.', evidenceIds: ['e1'], contradictingEvidenceIds: [], entityRefs: [{ section: 'links', id: 'l1' }, { section: 'roles', id: 'r1' }], alternativeExplanations: ['ייתכן שפועלים ממלאי מקום שלא תועדו'], uncertainty: 'לא נצפתה פעולה בהיעדרות', presentImplication: 'יש לבחון עומס ונגישות בהווה', futureImplication: 'יש לברר רציפות בזמן היעדרות', lenses: ['existence', 'realization'] }],
    network: [{ title: 'שני ערוצים ותלות אחת', concern: 'עצם ריבוי הערוצים אינו מוכיח עצמאות.', entityRefs: [{ section: 'mechanisms', id: 'm1' }, { section: 'mechanisms', id: 'm2' }], evidenceIds: ['e1'], uncertainty: 'מצב הפעלה חלקי' }],
    missingInformation: [{ question: 'מה מספרת קבוצה ב על קבלת העדכון?', why: 'קולה חסר', entityRefs: [], evidenceIds: [] }],
    priorities: [{ id: 'p1', title: 'בירור גיבוי ונגישות', findingIds: ['f1'], evidenceIds: ['e1'], entityRefs: [{ section: 'links', id: 'l1' }], whyNow: 'הקשר חשוב לתיאום', criteria: 'נגישות, עומס, הוגנות וישימות', uncertainty: 'לא ידוע אם הגיבוי עצמאי', options: [{ id: 'o1', kind: 'verify', title: 'לברר עם המשתתפים', rationale: 'הפעולה טרם נבחנה', conditions: 'שיתוף קבוצה ב', costs: 'זמן שיחה', firstStep: 'לבנות שאלות עם הצוות', suggestedRoles: ['תפקיד תיאום לפי החלטת הצוות'], resources: 'זמן שיחה מוצע לבדיקה' }, { id: 'o2', kind: 'trial', title: 'לנסות העברה מתוכננת', rationale: 'בחינת אפשרות', conditions: 'הסכמה וזמן', costs: 'עומס אפשרי', firstStep: 'להחליט אם מתאים לנסות', suggestedRoles: [], resources: '' }] }]
  };
}
