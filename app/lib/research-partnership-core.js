(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./research-core.js'));
  else root.SBE_RESEARCH_PARTNERSHIPS = factory(root.SBE_RESEARCH);
})(typeof self !== 'undefined' ? self : this, function (base) {
  'use strict';

  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  const VERSIONS = { api: '1.1.0', schema: 3, agreement: '1.1.0' };
  const PERMISSIONS = {
    view_approved_findings: 'צפייה בממצאים מאושרים', download_approved_findings: 'הורדת ממצאים מאושרים',
    propose_analysis: 'הצעת ניתוח', view_analysis_results: 'צפייה בתוצאות ניתוח מאושרות',
    comment_on_findings: 'הוספת תגובה לממצא', view_approved_pseudonymized_data: 'צפייה בנתונים מאושרים עם מזהי מחקר',
    export_approved_dataset: 'ייצוא מערך נתונים מאושר', view_study_progress: 'צפייה בהתקדמות המחקר',
    view_approved_contributions: 'צפייה בתרומות מאושרות'
  };
  const PERMISSION_ALIASES = { manage_study_questionnaires: 'manage_questionnaires' };
  const ACCESS_PRESETS = {
    approved_findings: ['view_study', 'view_approved_findings'],
    collaborative_analysis: ['view_study', 'view_approved_findings', 'propose_analysis', 'view_analysis_results', 'comment_on_findings']
  };
  const ROLE_PRESETS = { researcher: ACCESS_PRESETS.approved_findings };
  const CLIENT_ACTIONS = [
    'workspaceBootstrap', 'partnerSave', 'partnerGet', 'workspaceList', 'recordGet', 'recordSave', 'recordSubmit', 'recordReview', 'recordVersions',
    'findingPublish', 'findingWithdraw', 'findingComment', 'partnerInviteCreate', 'partnerInviteGet', 'partnerInviteAccept', 'partnerInviteRevoke',
    'agreementApprove', 'agreementAmend', 'signingStart', 'signingView', 'signingRefresh', 'workspaceDocumentPut', 'workspaceDocumentGet',
    'workspaceExport', 'workspaceImpact', 'workspaceAnalysis'
  ];
  const READ_ACTIONS = ['workspaceBootstrap', 'partnerGet', 'workspaceList', 'recordGet', 'recordVersions', 'partnerInviteGet', 'signingView', 'workspaceDocumentGet', 'workspaceExport', 'workspaceImpact'];
  const INTERNAL_ACTIONS = ['signatureComplete'];
  const CONTRIBUTION_CATEGORIES = {
    scientific: 'תרומה מדעית', methodological: 'תרומה מתודולוגית', questionnaires: 'שאלונים', educational_content: 'תוכן חינוכי',
    technology: 'טכנולוגיה', funding: 'מימון', professional_services: 'שירותים מקצועיים', other: 'אחר'
  };
  const REVIEW_STATUSES = { draft: 'טיוטה', submitted: 'הוגשה', under_review: 'בבדיקה', changes_requested: 'הוזמנה השלמה', approved: 'אושרה', rejected: 'נדחתה' };
  const FINDING_STATUSES = { draft: 'טיוטה', owner_review: 'בדיקת בעלת המערכת', approved: 'אושר', published: 'פורסם למורשים', withdrawn: 'הוסר מפרסום' };
  const RECORD_KINDS = {
    application: 'בקשה לשותפות, למחקר או לגישה', analysis_request: 'בקשת ניתוח', analysis_result: 'תוצאת ניתוח', finding: 'ממצא',
    contribution: 'תרומה', agreement: 'הסכם', agreement_template: 'תבנית הסכם', budget: 'תקציב', obligation: 'התחייבות', decision: 'החלטה'
  };
  const RECORD_STATUSES = {
    application: REVIEW_STATUSES, analysis_request: REVIEW_STATUSES, analysis_result: FINDING_STATUSES, finding: FINDING_STATUSES,
    contribution: { ...REVIEW_STATUSES, completed: 'הושלמה' },
    agreement: { ...REVIEW_STATUSES, signing: 'בתהליך חתימה', executed: 'נחתם ואומת' },
    agreement_template: { draft: 'טיוטה', approved: 'תבנית מאושרת', retired: 'תבנית קודמת' },
    budget: REVIEW_STATUSES,
    obligation: { draft: 'טיוטת חילוץ', under_review: 'בדיקת בעלת המערכת', approved: 'אושרה למעקב', in_progress: 'בביצוע', completed: 'הושלמה', disputed: 'בבירור', cancelled: 'בוטלה לפי מקור מתועד' },
    decision: REVIEW_STATUSES
  };
  const AGREEMENT_SECTIONS = [
    ['parties', 'פרטי הצדדים'], ['study', 'המחקר ומטרותיו'], ['tools', 'כלים, שאלונים והרשאות'], ['contributions', 'תרומות הצדדים'],
    ['sharedExpenses', 'הוצאות משותפות'], ['professionalFees', 'שכר ושירותים מקצועיים'], ['development', 'פיתוח ותמיכה'],
    ['mutualIP', 'קניין רוחני הדדי'], ['privacyEthics', 'פרטיות ואתיקה'], ['durationTermination', 'תקופה וסיום'],
    ['annexes', 'נספחים וסעיפים נוספים'], ['reviewSigning', 'עיון, אישור וחתימה']
  ].map(([id, label]) => ({ id, label }));
  const PARTIES = { owner: 'בעלת המערכת', partner: 'החוקרת', shared: 'שני הצדדים' };
  const CURRENCIES = { ILS: 'שקל', USD: 'דולר ארה״ב', EUR: 'אירו', GBP: 'ליש״ט' };
  const ANALYSIS_OPERATIONS = { descriptive: 'סיכום תיאורי', frequency: 'התפלגות שכיחויות', comparison: 'השוואת קבוצות', trend: 'השוואה בין מועדים' };
  const ALL_PERMISSION_IDS = ['view_study', 'edit_study', 'manage_questionnaires', 'view_aggregate_results', 'view_pseudonymized_data', 'view_identifiable_data', 'view_document_content', 'export_data', 'manage_participants', 'contact_participants', 'manage_researchers', 'manage_consent', 'view_audit_log', ...Object.keys(PERMISSIONS)];
  function field(id, label, type = 'text', options = {}) { return { id, label, type, ...options }; }
  const text = (id, label, options) => field(id, label, 'text', options);
  const reference = (id, label, target, options) => field(id, label, 'id', { reference: target, ...options });
  const tags = (id, label, options) => field(id, label, 'tags', options);
  const refs = (id, label, target, options) => tags(id, label, { itemType: 'id', reference: target, ...options });
  const rows = (id, label, fields, options) => field(id, label, 'rows', { fields, ...options });
  const title = () => text('title', 'כותרת', { required: true, maxLength: 240 });
  const documents = () => refs('supportingDocumentIds', 'מסמכים תומכים', 'document');
  const date = (id, label, options) => field(id, label, 'date', options);
  const money = (id, label, options) => field(id, label, 'money', { category: 'financial', ...options });
  const choice = (id, label, choices, options) => field(id, label, 'enum', { choices, ...options });
  const expenseFields = [text('description', 'תיאור', { required: true }), money('amount', 'סכום', { required: true }), choice('party', 'הצד האחראי', PARTIES, { required: true }), date('dueDate', 'מועד תשלום', { category: 'deadline' }), text('terms', 'תנאים', { category: 'obligations' }), reference('contributionId', 'תרומה קשורה', 'contribution')];
  const PARTNER_FIELDS = [text('fullName', 'שם מלא', { required: true }), field('email', 'דוא״ל', 'email', { required: true }), choice('applicantType', 'סוג הפונה', { individual: 'אדם פרטי', institution: 'מוסד' }), text('institution', 'מוסד', { required: true, requiredUnless: { field: 'applicantType', equals: 'individual' } }), text('department', 'מחלקה'), text('position', 'תפקיד'), text('phone', 'טלפון'), text('profileNotes', 'פרטים מקצועיים'), tags('researchInterests', 'תחומי מחקר')];
  const APPROVED_TERMS_FIELDS = [text('recognition', 'הכרה מוסכמת'), money('compensation', 'תמורה מוצעת לאישור'), choice('currency', 'מטבע', CURRENCIES), text('usage', 'שימוש מוסכם', { category: 'access' }), text('ip', 'תנאי קניין רוחני מוצעים', { category: 'IP' }), text('ownerObligations', 'התחייבויות מוצעות לבעלת המערכת', { category: 'obligations' }), text('partnerObligations', 'התחייבויות מוצעות לחוקרת', { category: 'obligations' }), date('deadline', 'מועד', { category: 'deadline' }), documents()];
  const RECORD_SCHEMAS = {
    application: { label: RECORD_KINDS.application, fields: [title(), choice('applicationType', 'סוג הבקשה', { partnership: 'שותפות', study: 'מחקר', access: 'גישה' }, { required: true }), ...PARTNER_FIELDS,
      text('background', 'רקע'), text('objectives', 'מטרות', { required: true }), tags('researchQuestions', 'שאלות מחקר', { required: true }), text('method', 'שיטת המחקר', { required: true }), text('population', 'אוכלוסיית המחקר', { required: true }),
      tags('requestedTools', 'כלים מבוקשים', { required: true }), refs('questionnaireVersionIds', 'גרסאות שאלונים', 'instrument'), date('startDate', 'מועד התחלה', { required: true }), date('endDate', 'מועד סיום', { required: true }),
      choice('ethicsStatus', 'מצב אישור אתי', { pending: 'בתהליך', approved: 'אושר', not_required: 'לא נדרש לפי תיעוד' }, { required: true }), text('ethicsDetails', 'פירוט אישורים', { required: true }), text('consentPlan', 'תוכנית הסכמה', { required: true }),
      tags('requestedPermissions', 'הרשאות מבוקשות', { choices: ALL_PERMISSION_IDS, category: 'access', required: true }), text('requestedSupport', 'סיוע מבוקש'), documents()] },
    analysis_request: { label: RECORD_KINDS.analysis_request, fields: [title(), tags('questions', 'שאלות לניתוח', { required: true }), tags('variables', 'משתנים', { required: true }), tags('comparisons', 'השוואות'), text('groupingVariable', 'משתנה קבוצות מאושר להשוואה', { maxLength: 120 }), tags('timePoints', 'מועדים'), tags('requestedOutputs', 'תוצרים מבוקשים', { required: true }), choice('operation', 'סוג ניתוח מוצע', ANALYSIS_OPERATIONS, { required: true }), reference('sourceSnapshotId', 'תמונת מקור', 'snapshot'), text('rationale', 'מטרת הניתוח'), documents()] },
    analysis_result: { label: RECORD_KINDS.analysis_result, fields: [title(), reference('analysisRequestId', 'בקשת הניתוח', 'analysis_request', { required: true }), reference('sourceSnapshotId', 'תמונת מקור', 'snapshot', { required: true }), choice('operation', 'סוג הניתוח', ANALYSIS_OPERATIONS, { required: true }), text('analysisVersion', 'גרסת הניתוח', { required: true }), text('summary', 'סיכום', { required: true }), text('method', 'שיטת הניתוח', { required: true }), text('limitations', 'מגבלות'), text('privacyReview', 'סקירת פרטיות', { required: true, category: 'privacy' }), text('consentReview', 'התאמה להסכמות', { required: true, category: 'privacy' }), reference('consentProtocolVersionId', 'גרסת פרוטוקול הסכמה', 'consent', { required: true }), refs('resultDocumentIds', 'מסמכי תוצאה', 'document')] },
    finding: { label: RECORD_KINDS.finding, fields: [title(), text('summary', 'סיכום הממצא', { required: true }), text('evidence', 'ראיות ותימוכין', { required: true }), reference('sourceSnapshotId', 'תמונת מקור', 'snapshot', { required: true }), reference('analysisResultId', 'תוצאת ניתוח', 'analysis_result'), text('method', 'שיטה', { required: true }), text('analysisVersion', 'גרסת ניתוח', { required: true }), text('toolVersion', 'גרסת כלי', { required: true }), refs('questionnaireVersionIds', 'גרסאות שאלונים', 'instrument', { required: true }), reference('consentProtocolVersionId', 'גרסת פרוטוקול הסכמה', 'consent', { required: true }), text('limitations', 'מגבלות'), text('privacyReview', 'סקירת פרטיות', { required: true, category: 'privacy' }), text('consentReview', 'התאמה להסכמות', { required: true, category: 'privacy' }), documents()] },
    contribution: { label: RECORD_KINDS.contribution, fields: [title(), choice('category', 'סוג התרומה', CONTRIBUTION_CATEGORIES, { required: true }), text('description', 'תיאור התרומה', { required: true }), text('deliverables', 'תוצרים מוצעים'), text('requestedRecognition', 'הכרה מבוקשת'), money('requestedCompensation', 'תמורה מבוקשת'), choice('currency', 'מטבע', CURRENCIES), text('requestedUsage', 'שימוש מבוקש', { category: 'access' }), text('requestedIP', 'תנאי קניין רוחני מבוקשים', { category: 'IP' }), text('requestedOwnerObligations', 'בקשות מבעלת המערכת', { category: 'obligations' }), text('partnerResponsibilities', 'אחריות מוצעת לחוקרת', { category: 'obligations' }), date('dueDate', 'מועד מוצע', { category: 'deadline' }), documents()] },
    agreement: { label: RECORD_KINDS.agreement, fields: [] },
    agreement_template: { label: RECORD_KINDS.agreement_template, fields: [title(), text('templateVersion', 'גרסת התבנית', { required: true }), text('explanationVersion', 'גרסת הסבר הקניין הרוחני', { required: true }), rows('sectionClauses', 'סעיפים שסופקו ואושרו', [choice('sectionId', 'פרק', Object.fromEntries(AGREEMENT_SECTIONS.map(s => [s.id, s.label])), { required: true }), text('text', 'טקסט שסופק', { required: true })], { required: true }), text('ipExplanation', 'הסבר קניין רוחני שסופק', { required: true }), text('mutualIPClause', 'סעיף הדדיות שסופק', { required: true }), tags('requiredFieldIds', 'שדות להשלמת ההסכם')] },
    budget: { label: RECORD_KINDS.budget, fields: [title(), choice('currency', 'מטבע', CURRENCIES, { required: true }), rows('items', 'סעיפי תקציב', expenseFields, { required: true, category: 'financial' }), text('fundingSource', 'מקור מימון'), text('notes', 'הערות'), documents()] },
    obligation: { label: RECORD_KINDS.obligation, fields: [title(), reference('sourceAgreementId', 'הסכם מקור', 'agreement', { required: true }), reference('sourceAgreementVersionId', 'גרסת הסכם חתומה', 'agreement_version', { required: true }), text('clauseReference', 'הפניה לסעיף', { required: true }), choice('party', 'הצד האחראי', PARTIES, { required: true }), text('description', 'תיאור ההתחייבות', { required: true, category: 'obligations' }), money('amount', 'סכום'), choice('currency', 'מטבע', CURRENCIES), date('dueDate', 'מועד ביצוע', { category: 'deadline' }), text('completionEvidence', 'תיעוד השלמה'), refs('evidenceDocumentIds', 'מסמכי תיעוד', 'document')] },
    decision: { label: RECORD_KINDS.decision, fields: [title(), text('summary', 'תיאור ההחלטה', { required: true }), text('rationale', 'נימוקים', { required: true }), date('decisionDate', 'מועד ההחלטה', { required: true }), refs('relatedRecordIds', 'רשומות קשורות', 'record'), text('nextSteps', 'הצעדים הבאים', { category: 'obligations' }), documents()] }
  };
  function section(id, fields) { return fields.map(f => ({ ...f, section: id })); }
  RECORD_SCHEMAS.agreement.fields = [
    ...section('parties', [title(), text('ownerName', 'שם בעלת המערכת', { required: true }), text('ownerInstitution', 'מוסד בעלת המערכת'), field('ownerEmail', 'דוא״ל בעלת המערכת', 'email'), text('ownerAddress', 'כתובת בעלת המערכת'), text('ownerSignatory', 'מורשית חתימה מטעם בעלת המערכת'), text('ownerAuthority', 'סמכות החתימה מטעם בעלת המערכת'), text('partnerName', 'שם החוקרת', { required: true }), text('partnerInstitution', 'מוסד החוקרת'), field('partnerEmail', 'דוא״ל החוקרת', 'email'), text('partnerAddress', 'כתובת החוקרת'), text('partnerSignatory', 'מורשית חתימה מטעם החוקרת'), text('partnerAuthority', 'סמכות החתימה מטעם החוקרת')]),
    ...section('study', [text('studyTitle', 'שם המחקר', { required: true }), text('purpose', 'מטרת ההסכם', { required: true }), text('objectives', 'מטרות המחקר'), tags('researchQuestions', 'שאלות מחקר'), text('method', 'שיטת המחקר'), text('population', 'אוכלוסיית המחקר'), date('startDate', 'תחילת המחקר', { category: 'deadline' }), date('endDate', 'סיום המחקר', { category: 'deadline' }), reference('applicationId', 'הבקשה שאושרה', 'application')]),
    ...section('tools', [tags('toolIds', 'כלים'), refs('questionnaireVersionIds', 'גרסאות שאלונים', 'instrument'), tags('requestedPermissions', 'הרשאות מוצעות', { choices: ALL_PERMISSION_IDS, category: 'access' }), text('accessTerms', 'תנאי גישה', { category: 'access' }), text('toolLimitations', 'מגבלות השימוש', { category: 'access' })]),
    ...section('contributions', [refs('contributionIds', 'תרומות קשורות', 'contribution'), text('ownerResponsibilities', 'אחריות בעלת המערכת', { category: 'obligations' }), text('partnerResponsibilities', 'אחריות החוקרת', { category: 'obligations' }), text('recognition', 'הכרה בתרומות')]),
    ...section('sharedExpenses', [reference('budgetId', 'תקציב קשור', 'budget'), choice('currency', 'מטבע ההוצאות', CURRENCIES, { category: 'financial' }), rows('sharedExpenses', 'הוצאות משותפות', expenseFields, { category: 'financial' }), text('expenseApprovalTerms', 'תנאי אישור הוצאות', { category: 'financial' })]),
    ...section('professionalFees', [rows('professionalFees', 'שכר ושירותים מקצועיים', [text('service', 'שירות', { required: true }), text('provider', 'נותנת השירות', { required: true }), money('amount', 'סכום', { required: true }), choice('currency', 'מטבע', CURRENCIES, { required: true }), date('dueDate', 'מועד תשלום', { category: 'deadline' }), text('conditions', 'תנאי תשלום', { category: 'obligations' })], { category: 'financial' }), text('taxTerms', 'תנאי מס ותיעוד שסופקו', { category: 'financial' })]),
    ...section('development', [text('developmentScope', 'היקף הפיתוח'), text('developmentResponsibilities', 'אחריות לפיתוח', { category: 'obligations' }), rows('milestones', 'אבני דרך', [text('title', 'אבן דרך', { required: true }), choice('party', 'הצד האחראי', PARTIES, { required: true }), date('dueDate', 'מועד יעד', { required: true, category: 'deadline' }), text('deliverable', 'תוצר', { required: true }), money('amount', 'סכום')], { category: 'obligations' }), text('ongoingSupport', 'תמיכה ותחזוקה', { category: 'obligations' })]),
    ...section('mutualIP', [text('preExistingOwnerIP', 'זכויות קודמות של בעלת המערכת', { category: 'IP' }), text('preExistingPartnerIP', 'זכויות קודמות של החוקרת', { category: 'IP' }), text('newIPOwnership', 'זכויות בתוצרים חדשים', { category: 'IP' }), text('usageLicence', 'רישיונות שימוש מוצעים', { category: 'IP' }), text('publicationRights', 'זכויות פרסום מוצעות', { category: 'IP' }), text('commercialRights', 'שימוש מסחרי מוצע', { category: 'IP' }), text('attribution', 'ייחוס והכרה', { category: 'IP' }), text('proposedIPAmendments', 'שינויים מוצעים בזכויות', { category: 'IP' }), reference('ipExplanationVersionId', 'גרסת הסבר קניין רוחני', 'agreement_template_version', { required: true, category: 'IP' })]),
    ...section('privacyEthics', [text('ethicsApproval', 'תיעוד אישור אתי', { category: 'privacy' }), reference('consentProtocolVersionId', 'גרסת פרוטוקול הסכמה', 'consent', { category: 'privacy' }), text('privacyTerms', 'תנאי פרטיות', { category: 'privacy' }), text('dataSecurity', 'אבטחת מידע', { category: 'privacy' }), text('retentionTerms', 'שמירה ומחיקה', { category: 'privacy' }), text('withdrawalTerms', 'פרישה מהמחקר', { category: 'privacy' }), text('confidentiality', 'סודיות', { category: 'privacy' })]),
    ...section('durationTermination', [date('effectiveDate', 'תחילת תוקף מוצעת', { required: true, category: 'deadline' }), date('terminationDate', 'סיום תוקף מוצע', { category: 'deadline' }), field('terminationNoticeDays', 'ימי הודעה מראש', 'integer', { category: 'deadline' }), text('terminationTerms', 'תנאי סיום שסופקו', { category: 'obligations' }), text('postTermination', 'אחריות לאחר סיום', { category: 'obligations' })]),
    ...section('annexes', [refs('annexDocumentIds', 'מסמכי נספחים', 'document'), rows('customClauses', 'סעיפים מוצעים נוספים', [choice('sectionId', 'פרק', Object.fromEntries(AGREEMENT_SECTIONS.map(s => [s.id, s.label])), { required: true }), text('title', 'כותרת הסעיף', { required: true }), text('text', 'נוסח מוצע', { required: true })], { category: 'obligations' })]),
    ...section('reviewSigning', [reference('templateVersionId', 'גרסת תבנית מאושרת', 'agreement_template_version', { required: true }), field('ipReadAcknowledgement', 'קראתי את הסבר הקניין הרוחני', 'boolean'), text('reviewNotes', 'הערות לעיון'), reference('amendsAgreementVersionId', 'גרסה חתומה לתיקון', 'agreement_version')])
  ];

  // Field vocabulary is public; source clauses and hints stay in the private server catalog.
  const GUIDED_AGREEMENT = { version: '4', annexes: [
    ['A', 'תוכנית המחקר, מועדים ואחריות', 'study'], ['B', 'כלים והרשאות', 'tools'], ['C', 'תקציב, הוצאות ושכר', 'sharedExpenses'],
    ['D', 'תרומות ופיתוח', 'contributions'], ['E', 'פרטיות, הסכמות ואתיקה', 'privacyEthics'], ['F', 'תוצרים, זכויות ופרסום', 'mutualIP']
  ].map(([id, label, section]) => ({ id, label, section, statusField: 'annex' + id + 'Status', reasonField: 'annex' + id + 'Reason', rowsField: 'annex' + id })) };
  const guided = { required: true, requiredWhen: { field: 'guidedVersion', equals: '4' } };
  const guidedText = (id, label, category) => text(id, label, { ...guided, ...(category ? { category } : {}) });
  const rowText = (id, label) => text(id, label, { required: true });
  const partyKinds = { individual: 'אדם פרטי', institution: 'מוסד', both: 'אדם ומוסד' };
  RECORD_SCHEMAS.agreement.fields.push(
    ...section('parties', [choice('guidedVersion', 'גרסת ההסכם המונחה', { '4': 'גרסה 4' }), choice('ownerPartyKind', 'הגורם המתקשר מטעם בעלת המערכת', partyKinds, guided), choice('partnerPartyKind', 'הגורם המתקשר מטעם השותפה', partyKinds, guided),
      ...[['ownerRegistration','מספר זיהוי או רישום בעלת המערכת'],['partnerRegistration','מספר זיהוי או רישום השותפה'],['ownerSignatoryRole','תפקיד מורשית חתימת בעלת המערכת'],['partnerSignatoryRole','תפקיד מורשית חתימת השותפה'],['institutionApproval','אישור מוסדי להתקשרות או אי תחולה'],['leadResearcher','שם החוקרת האחראית'],['leadResearcherRole','תפקיד החוקרת האחראית'],['leadResearcherInstitution','מוסד החוקרת האחראית או אי תחולה']].map(([id,label])=>guidedText(id,label)),
      rows('agreementContacts', 'אנשי קשר מקצועיים ולהודעות', [choice('party','צד',PARTIES,{required:true}),rowText('name','שם'),rowText('role','תפקיד'),field('email','דוא״ל','email',{required:true}),text('phone','טלפון'),rowText('purpose','תחום פנייה')],guided)]),
    ...section('study', [['studyIdentifier','מזהה המחקר'],['centralResearchQuestion','שאלת המחקר המרכזית'],['researchLimits','מגבלות המסקנות'],['humanAIReview','אחריות לבדיקה אנושית של תוצרי AI']].map(([id,label])=>guidedText(id,label))),
    ...section('sharedExpenses', [guidedText('freeTierTerms','שימוש חינמי וטיפול בהגעה למכסה','financial')]),
    ...section('development', [rows('developmentTasks','משימות התאמה ופיתוח',[
      ...[['school','בית הספר והצורך'],['users','משתמשות'],['requestedChange','השינוי המבוקש'],['deliverable','תוצר מדיד'],['performer','מבצעת'],['milestones','אבני דרך'],['testEnvironment','סביבת בדיקה'],['acceptance','תנאי קבלה והגורם המאשר'],['training','הדרכה'],['usabilityEvaluation','בדיקת התאמה ושימושיות'],['maintenance','אחריות לתחזוקה'],['rights','זכויות בתוצר']].map(([id,label])=>rowText(id,label)),money('budget','תקציב'),choice('currency','מטבע',CURRENCIES),date('dueDate','מועד')],{category:'obligations'}),
      ...[['supportChannels','ערוצי תמיכה'],['supportDays','ימי תמיכה'],['supportExtent','היקף תמיכה'],['supportResponse','זמני מענה ותחזוקה'],['supportEscalation','טיפול בהסלמה']].map(([id,label])=>guidedText(id,label))]),
    ...section('privacyEthics', [['consentConfiguration','הסכמות למשתתפים ולקטינים או אי תחולה'],['confidentialScope','סוגי מידע סודי'],['confidentialDuration','משך הסודיות'],['confidentialExceptions','חריגים וחובות גילוי']].map(([id,label])=>guidedText(id,label,'privacy'))),
    ...section('durationTermination',[field('breachCureDays','ימי תיקון הפרה','integer',{category:'deadline'}),... [['breachNoticeTerms','הודעה על הפרה ותנאי תיקון או אי תחולה'],['suspensionTerms','עצירה והגבלת גישה'],['handoverTerms','העברת תוצרים וסגירת הרשאות'],['finalSettlement','התחשבנות בסיום']].map(([id,label])=>guidedText(id,label,'obligations'))]),
    ...section('annexes',[field('publicationReviewPeriod','תקופת עיון מוקדם בפרסום','integer',{...guided,category:'deadline'}),choice('publicationReviewUnit','יחידת תקופת העיון',{days:'ימים',business_days:'ימי עסקים'},guided),
      ...[['authorshipTerms','מחברות וקרדיט לפי התרומה'],['logoUseTerms','הרשאה לשם, ללוגו ולשיווק'],['disputeContacts','אנשי קשר וגורמים מוסמכים למחלוקת'],['disputePeriod','פרק זמן ליישוב מחלוקת'],['documentPrecedence','סדר עדיפות בין המסמכים'],['governingLaw','דין מוסכם'],['jurisdiction','סמכות שיפוט מוסכמת'],['liabilityTerms','אחריות ופיצוי או אי תחולה מנומקת'],['insuranceTerms','ביטוח או אי תחולה מנומקת']].map(([id,label])=>guidedText(id,label))]),
    ...section('reviewSigning',[... [['finalVersionLabel','מספר הגרסה הסופית'],['finalAnnexReferences','גרסאות הנספחים הנבחרים'],['signerIdentityChecks','בדיקת זהות וסמכות החותמות'],['signatureProvider','ספק חתימה מוצע'],['signatureType','סוג חתימה ודרישות מוסד'],['signaturePolicy','מדיניות חתימה מוסכמת'],['signatureVerification','ראיות ובדיקות אימות נדרשות'],['signingConsentTerms','הסכמה לחתום'],['signedStorage','מקום שמירה והרשאות לעותק חתום'],['activationConditions','תנאי תחילת הפעילות']].map(([id,label])=>guidedText(id,label)),
      rows('copyRecipients','נמעני עותק ודרך מסירה',[choice('party','צד',PARTIES,{required:true}),rowText('name','שם'),field('email','דוא״ל','email',{required:true}),rowText('deliveryMethod','אופן מסירה')],guided)])
  );
  const annexTextFields = {
    A: [['stage','שלב המחקר'],['questions','שאלות ושיטה'],['population','אוכלוסייה'],['sites','מסגרות חינוכיות'],['recruitment','דרך גיוס'],['measurementVersions','כלי מדידה, מקור וגרסה'],['responsible','אחראית לשלב'],['deliverables','תוצרים'],['schoolAdaptation','התאמה לבית הספר'],['adaptationEvaluation','בדיקת ההתאמה'],['permits','היתרים ואישורים'],['terminationHandover','העברת תוצרים בסיום']],
    B: [['tool','כלי או שאלון'],['source','מקור'],['version','גרסה'],['dataScope','מידע מותר'],['exportTerms','ייצוא מותר או אי תחולה'],['quota','מכסות והיקף'],['training','הדרכה'],['humanReview','בדיקה אנושית של תוצרי AI']],
    C: [['description','שירות וצורך'],['purpose','מטרה ותכולה'],['calculationBasis','בסיס חישוב ותמחור'],['taxTerms','מסים או אי תחולה'],['shareTerms','חלוקת עלויות'],['payer','משלמת בפועל'],['payee','מקבלת התשלום'],['approver','גורם מאשר'],['approvalEvidence','אישור ואסמכתאות או טרם אושר'],['paymentTerms','תנאי ומועד תשלום'],['invoiceTerms','מסמכי חיוב או אי תחולה'],['partialWorkTerms','עבודה חלקית וסיום מוקדם'],['unpaidTerms','החלטה על תמורה או תרומה ללא תשלום']],
    D: [['contributionIdentifier','מזהה תרומה'],['contributor','תורמת'],['institution','מוסד או אי תחולה'],['description','תיאור'],['deliverable','תוצר'],['milestones','אבני דרך'],['acceptance','בדיקת ביצוע'],['ownerDuties','התחייבות מוצעת לבעלת המערכת'],['requestedRecognition','קרדיט מבוקש'],['requestedRights','זכויות מבוקשות'],['agreedRecognition','קרדיט מוסכם או טרם הוסכם'],['agreedRights','זכויות מוסכמות או טרם הוסכמו'],['agreedConditions','תנאים מוסכמים או טרם הוסכמו'],['confirmingVersion','מסמך וגרסה מאשרים או טרם אושר']],
    E: [['dataCategories','סוגי מידע'],['purposes','מטרות עיבוד'],['partyRoles','תפקידי הצדדים בעיבוד'],['providers','ספקי עיבוד או אין ספק'],['transferBasis','תנאי ובסיס העברה או אין העברה'],['storageLocation','מקום אחסון'],['retention','תקופות שמירה ובסיסן'],['backups','גיבויים ושמירתם'],['deletion','מחיקה ומגבלותיה'],['withdrawal','פרישה ומגבלות לאחר איגום'],['ethicsReferences','אישורי אתיקה ומוסד'],['participantConsent','הסכמות וקטינים או אי תחולה'],['securityResponsible','אחראית אבטחה'],['securityMeasures','הפרדת הרשאות והגנת מסמכים'],['incidentHandling','בקשות ואירועים'],['contact','פרטי פנייה'],['terminationHandling','סיום, שמירה וסגירת גישה']],
    F: [['description','תיאור נכס או תוצר'],['creators','יוצרות'],['rightsHolders','בעלי זכויות וסמכות'],['ownership','בעלות מוסכמת'],['licence','רישיון או אי תחולה'],['permittedUses','תחומים ושימושים מותרים'],['modification','שינוי'],['distribution','הפצה'],['commercialUse','שימוש מסחרי'],['term','תקופת הרשאה'],['compensation','תמורה או אי תחולה'],['publication','פרסום'],['credit','קרדיט']]
  };
  const annexTypedFields = {
    A: [field('populationSize','היקף משתתפים','integer',{required:true}),date('startDate','התחלה',{required:true}),date('endDate','סיום',{required:true})],
    B: [tags('authorizedUsers','משתמשות מורשות',{required:true}),tags('actions','פעולות מותרות',{required:true}),date('startDate','התחלה',{required:true}),date('endDate','סיום',{required:true})],
    C: [choice('kind','סוג',{operating:'הוצאה תפעולית',service:'שירות מקצועי'},{required:true}),... [['estimatedAmount','הערכה'],['approvedCap','תקרה מוצעת לאישור'],['ownerShare','חלק בעלת המערכת'],['partnerShare','חלק השותפה']].map(([id,label])=>money(id,label,{required:true})),money('actualAmount','ביצוע מתועד'),choice('currency','מטבע',CURRENCIES,{required:true}),date('settlementDate','מועד התחשבנות'),choice('pricingMethod','שיטת תמחור השירות',{fixed:'לפי תוצר',hourly:'לפי שעה',mixed:'שילוב מוגדר',unpaid:'תרומה ללא תשלום'},{required:true,requiredWhen:{field:'kind',equals:'service'}}),money('serviceAmount','סכום השירות',{required:true,requiredWhen:{field:'kind',equals:'service'}}),... [['provider','נותנת שירות'],['serviceRecipient','מקבלת השירות'],['deliverable','תוצר השירות'],['hourCap','תקרת שעות והיקף או אי תחולה'],['acceptance','קבלת התוצר'],['credit','קרדיט לשירות או אי תחולה']].map(([id,label])=>text(id,label,{required:true,requiredWhen:{field:'kind',equals:'service'}}))],
    D: [choice('category','סוג תרומה',CONTRIBUTION_CATEGORIES,{required:true}),date('dueDate','מועד',{required:true}),money('requestedPayment','תשלום מבוקש'),money('agreedPayment','תשלום שהוסכם'),choice('currency','מטבע',CURRENCIES),text('executionEvidence','ראיות לביצוע')],
    E: [tags('authorizedPeople','מורשות גישה',{required:true})],
    F: [choice('assetKind','סוג נכס',{owner_prior:'נכס קודם של בעלת המערכת',partner_prior:'נכס קודם של השותפה או המוסד',third_party:'נכס צד שלישי',new_output:'תוצר חדש'},{required:true})]
  };
  for (const annex of GUIDED_AGREEMENT.annexes) RECORD_SCHEMAS.agreement.fields.push(...section(annex.section,[
    choice(annex.statusField,'תחולת נספח '+annex.id,{applicable:'נכלל בהסכם',not_applicable:'לא חל, עם נימוק'},guided),
    text(annex.reasonField,'נימוק לאי תחולת נספח '+annex.id,{required:true,requiredWhen:{field:annex.statusField,equals:'not_applicable'}}),
    rows(annex.rowsField,'נספח '+annex.id+': '+annex.label,[...annexTextFields[annex.id].map(([id,label])=>rowText(id,label)),...annexTypedFields[annex.id]],{required:true,requiredWhen:{field:annex.statusField,equals:'applicable'},category:{B:'access',C:'financial',D:'obligations',E:'privacy',F:'IP'}[annex.id]||'content'})
  ]));
  for (const definition of RECORD_SCHEMAS.agreement.fields) if (['ownerEmail','ownerAddress','ownerSignatory','ownerAuthority','partnerEmail','partnerAddress','partnerSignatory','partnerAuthority','objectives','researchQuestions','method','population','startDate','endDate','ownerResponsibilities','partnerResponsibilities','ethicsApproval','terminationDate','terminationNoticeDays','terminationTerms','postTermination'].includes(definition.id)) Object.assign(definition,guided);

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function safeError(code) {
    const messages = { invalid: 'אפשר לבדוק את הפרטים ולהשלים את השדות המסומנים.', conflict: 'הגרסה השתנתה. אפשר לרענן לפני שמירה נוספת.', not_configured: 'להשלמת הפעולה נדרשת הגדרת השירות בידי בעלת המערכת.' };
    if (!own(messages, code)) code = 'invalid';
    const error = new Error(code); error.code = code; error.userMessage = messages[code]; return error;
  }
  function invalid() { throw safeError('invalid'); }
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
  function empty(value) { return value === undefined || value === null || value === '' || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0); }
  function required(definition, data) { return definition.required && (!definition.requiredWhen || data[definition.requiredWhen.field] === definition.requiredWhen.equals) && !(definition.requiredUnless && data[definition.requiredUnless.field] === definition.requiredUnless.equals); }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function validateValue(definition, value, complete) {
    if (value === undefined) return undefined;
    if (value === '' && ['text', 'email', 'date', 'id', 'enum', 'money'].includes(definition.type)) return '';
    switch (definition.type) {
      case 'text': if (typeof value !== 'string' || value.length > (definition.maxLength || 20000)) invalid(); return value;
      case 'email': if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) invalid(); return value;
      case 'id': if (typeof value !== 'string' || !UUID.test(value)) invalid(); return value;
      case 'date': if (typeof value !== 'string' || !validDate(value)) invalid(); return value;
      case 'money': if (typeof value !== 'string' || !/^(0|[1-9]\d{0,11})\.\d{2}$/.test(value)) invalid(); return value;
      case 'integer': if (!Number.isSafeInteger(value) || value < 0) invalid(); return value;
      case 'boolean': if (typeof value !== 'boolean') invalid(); return value;
      case 'enum': if (typeof value !== 'string' || !own(definition.choices, value)) invalid(); return value;
      case 'tags': {
        if (!Array.isArray(value) || value.length > 200 || new Set(value).size !== value.length) invalid();
        return value.map(item => {
          if (typeof item !== 'string' || !item.trim() || item.length > 500) invalid();
          if (definition.itemType === 'id' && !UUID.test(item)) invalid();
          if (definition.choices && !definition.choices.includes(item)) invalid();
          return item;
        });
      }
      case 'rows': if (!Array.isArray(value) || value.length > 200) invalid(); return value.map(row => validateFields(definition.fields, row, complete));
      default: invalid();
    }
  }
  function validateFields(fields, data, complete) {
    if (!object(data)) invalid();
    const byId = new Map(fields.map(f => [f.id, f]));
    for (const key of Object.keys(data)) if (!byId.has(key)) invalid();
    const result = {};
    for (const definition of fields) {
      if (own(data, definition.id)) result[definition.id] = validateValue(definition, data[definition.id], complete);
      if (complete && required(definition, data) && empty(result[definition.id])) invalid();
    }
    for (const [start, end] of [['startDate','endDate'],['effectiveDate','terminationDate']]) if (result[start] && result[end] && result[start] > result[end]) invalid();
    return result;
  }
  function schema(kind) { if (!own(RECORD_SCHEMAS, kind)) invalid(); return RECORD_SCHEMAS[kind]; }
  function missingFields(kind, data, requiredIds = []) {
    const definitions = schema(kind).fields;
    const checked = validateFields(definitions, data, false);
    const ids = new Set(definitions.filter(f => required(f, checked)).map(f => f.id));
    if (kind === 'analysis_request' && checked.operation === 'comparison') ids.add('groupingVariable');
    for (const id of requiredIds) { if (!definitions.some(f => f.id === id)) invalid(); ids.add(id); }
    const missing = [];
    for (const definition of definitions) {
      const value = checked[definition.id];
      if (ids.has(definition.id) && empty(value)) missing.push(definition.id);
      if (definition.type === 'rows' && Array.isArray(value)) value.forEach((row, index) => definition.fields.forEach(nested => { if (required(nested, row) && empty(row[nested.id])) missing.push(definition.id + '[' + index + '].' + nested.id); }));
    }
    return missing;
  }
  function templateChecks(data, complete) {
    const known = RECORD_SCHEMAS.agreement.fields.map(f => f.id);
    for (const id of data.requiredFieldIds || []) if (!known.includes(id)) invalid();
    const seen = new Set();
    for (const clause of data.sectionClauses || []) { if (seen.has(clause.sectionId)) invalid(); seen.add(clause.sectionId); }
    if (complete && AGREEMENT_SECTIONS.some(s => !seen.has(s.id))) invalid();
    const texts = [data.ipExplanation, data.mutualIPClause, ...(data.sectionClauses || []).map(clause => clause.text)];
    for (const text of texts) if (typeof text === 'string') {
      const remainder = text.replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (_, id) => { if (!known.includes(id)) invalid(); return ''; });
      if (remainder.includes('{{') || remainder.includes('}}')) invalid();
    }
  }
  function validateRecord(kind, data, options = {}) {
    const checked = validateFields(schema(kind).fields, data, options.complete === true);
    for (const [start, end] of [['startDate', 'endDate'], ['effectiveDate', 'terminationDate']]) if (checked[start] && checked[end] && checked[start] > checked[end]) invalid();
    if (kind === 'agreement_template') templateChecks(checked, options.complete === true);
    if (kind === 'analysis_request' && checked.operation === 'comparison' && options.complete === true && empty(checked.groupingVariable)) invalid();
    return checked;
  }
  function validatePartner(data, options = {}) { return validateFields(PARTNER_FIELDS, data, options.complete === true); }
  function validateApprovedTerms(data) { return validateFields(APPROVED_TERMS_FIELDS, data, false); }

  function transition(from, to, action, authority) { return { from, to, action, authority }; }
  function proposalTransitions() { return [
    transition('draft', 'submitted', 'recordSubmit', 'author'), transition('changes_requested', 'submitted', 'recordSubmit', 'author'),
    ...['submitted', 'under_review'].flatMap(from => ['under_review', 'changes_requested', 'approved', 'rejected'].filter(to => to !== from).map(to => transition(from, to, 'recordReview', 'owner')))
  ]; }
  function findingTransitions() { return [transition('draft', 'owner_review', 'recordSubmit', 'author'), transition('owner_review', 'draft', 'recordReview', 'owner'), transition('owner_review', 'approved', 'recordReview', 'owner'), transition('approved', 'published', 'findingPublish', 'owner'), transition('published', 'withdrawn', 'findingWithdraw', 'owner')]; }
  const RECORD_TRANSITIONS = {
    application: proposalTransitions(), analysis_request: proposalTransitions(), contribution: [...proposalTransitions(), transition('approved', 'completed', 'recordReview', 'owner')], budget: proposalTransitions(), decision: proposalTransitions(),
    finding: findingTransitions(), analysis_result: findingTransitions().map(t => t.action === 'findingPublish' || t.action === 'findingWithdraw' ? { ...t, action: 'recordReview' } : t),
    agreement: [...proposalTransitions(), transition('approved', 'signing', 'signingStart', 'owner'), transition('signing', 'executed', 'signatureComplete', 'internal')],
    agreement_template: [transition('draft', 'approved', 'recordReview', 'owner'), transition('approved', 'retired', 'recordReview', 'owner')],
    obligation: [transition('draft', 'under_review', 'recordSubmit', 'owner'), transition('under_review', 'approved', 'recordReview', 'owner'), transition('approved', 'in_progress', 'recordReview', 'owner'), ...['approved', 'in_progress', 'disputed'].flatMap(from => ['completed', 'disputed', 'cancelled'].filter(to => to !== from).map(to => transition(from, to, 'recordReview', 'owner')))]
  };
  function canTransition(kind, from, to, action, authority) { return own(RECORD_TRANSITIONS, kind) && RECORD_TRANSITIONS[kind].some(t => t.from === from && t.to === to && t.action === action && (t.authority === authority || (t.authority === 'author' && authority === 'owner'))); }

  function compareRecords(kind, before, after) {
    const definitions = schema(kind).fields;
    before = validateRecord(kind, before); after = validateRecord(kind, after);
    const changes = [];
    function compare(definition, a, b, path, parent) {
      if (definition.type === 'rows' && Array.isArray(a) && Array.isArray(b)) {
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          if (a[i] && b[i]) for (const nested of definition.fields) compare({ ...nested, category: nested.category || definition.category }, a[i][nested.id], b[i][nested.id], path + '[' + i + '].' + nested.id, parent);
          else changes.push({ path: path + '[' + i + ']', fieldId: parent.id, label: parent.label, category: definition.category || 'content', before: a[i] || null, after: b[i] || null });
        }
      } else if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ path, fieldId: parent.id, label: parent === definition ? definition.label : parent.label + ' / ' + definition.label, category: definition.category || parent.category || 'content', before: a === undefined ? null : a, after: b === undefined ? null : b });
    }
    for (const definition of definitions) compare(definition, before[definition.id], after[definition.id], definition.id, definition);
    return changes;
  }
  function permissionLabel(id) { const key = PERMISSION_ALIASES[id] || id; return base?.PERMISSIONS?.[key] || PERMISSIONS[key] || id; }
  function formatValue(definition, value) {
    if (empty(value)) return '[חסר: ' + definition.label + ']';
    if (definition.type === 'boolean') return value ? 'כן' : 'לא';
    if (definition.type === 'enum') return definition.choices[value];
    if (definition.type === 'rows') return value.map((row, index) => (index + 1) + '. ' + definition.fields.filter(f => !empty(row[f.id])).map(f => f.label + ': ' + formatValue(f, row[f.id])).join(' · ')).join('\n');
    if (Array.isArray(value)) return (definition.id === 'requestedPermissions' ? value.map(permissionLabel) : value).join(', ');
    return String(value);
  }
  function renderAgreement(data, suppliedTemplate) {
    data = validateRecord('agreement', data);
    const template = suppliedTemplate ? validateRecord('agreement_template', suppliedTemplate, { complete: true }) : null;
    const definitions = RECORD_SCHEMAS.agreement.fields;
    const byId = new Map(definitions.map(f => [f.id, f]));
    const missing = missingFields('agreement', data, template ? template.requiredFieldIds : []);
    const required = new Set(template ? template.requiredFieldIds : []);
    function replace(text) { return text.replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (_, id) => { if (empty(data[id])) required.add(id); return formatValue(byId.get(id), data[id]); }); }
    const sections = AGREEMENT_SECTIONS.map(section => {
      const fields = definitions.filter(f => f.section === section.id && own(data, f.id)).map(f => ({ id: f.id, label: f.label, value: formatValue(f, data[f.id]) }));
      const clause = template && template.sectionClauses.find(c => c.sectionId === section.id);
      let text = clause ? replace(clause.text) : '';
      if (template && section.id === 'mutualIP') text += '\n' + replace(template.mutualIPClause);
      for (const custom of data.customClauses || []) if (custom.sectionId === section.id) text += '\n' + custom.title + '\n' + custom.text;
      return { id: section.id, label: section.label, text: text.trim(), fields };
    });
    const ipExplanation = template ? replace(template.ipExplanation) : '';
    for (const id of required) if (empty(data[id]) && !missing.includes(id)) missing.push(id);
    const text = [data.title || 'טיוטת הסכם', ...sections.map(s => s.label + '\n' + [s.text, ...s.fields.map(f => f.label + ': ' + f.value)].filter(Boolean).join('\n')), ipExplanation ? 'הסבר הקניין הרוחני\n' + ipExplanation : 'להשלמת ההסכם נדרשים תבנית מאושרת והסבר קניין רוחני שסופק.'].join('\n\n');
    return { direction: 'rtl', lang: 'he', title: data.title || 'טיוטת הסכם', templateVersion: template ? template.templateVersion : null, explanationVersion: template ? template.explanationVersion : null, sections, ipExplanation, missingFields: missing, dependency: template ? null : 'approved_template_missing', ready: !!template && missing.length === 0, text };
  }
  // This describes trusted server output only. Passing client JSON is never evidence of execution.
  function isBindingObligation(record) {
    return !!record && record.kind === 'obligation' && record.sourceAgreementStatus === 'executed' && record.providerVerification === 'verified' && record.ownerReviewed === true && UUID.test(record.sourceAgreementVersionId || '') && /^[a-f0-9]{64}$/i.test(record.sourceAgreementHash || '');
  }

  const scope = { studyId: 'uuid', partnerId: 'uuid', recordId: 'uuid' };
  function operation(request, result, authority) { return { request, result, authority }; }
  const OPERATIONS = {
    workspaceBootstrap: operation({}, { owner: 'boolean', partners: 'PartnerSummary[]', studies: 'StudySummary[]', capabilities: 'string[]', readiness: 'Readiness' }, 'verified session'),
    partnerSave: operation({ partnerId: 'uuid?', expectedRevision: 'integer|null', individualCode: 'string? owner only', profile: 'PartnerData' }, { partner: 'Partner' }, 'owner or self; self identity is session-derived'),
    partnerGet: operation({ partnerId: 'uuid' }, { partner: 'Partner', workspaces: 'WorkspaceSummary[]' }, 'owner or self'),
    workspaceList: operation({ studyId: 'uuid?', partnerId: 'uuid?', kind: 'RecordKind?', status: 'RecordStatus?', query: 'string?', cursor: 'string?' }, { workspaces: 'WorkspaceSummary[]', nextCursor: 'string|null' }, 'owner overview or own authorized folders'),
    recordGet: operation({ ...scope, versionId: 'uuid?' }, { record: 'Record', version: 'RecordVersion', reviews: 'Review[]? owner or author only', comments: 'FindingComment[]? exact authorized version', approvals: 'AgreementApproval[]? actual agreement party only', signing: 'SigningSession? actual agreement party only', access: 'EffectiveRecordAccess' }, 'owner, author or explicit authorized version viewer'),
    recordSave: operation({ ...scope, recordId: 'uuid? new records omit', kind: 'RecordKind', data: 'TypedRecordData', expectedRevision: 'integer|null' }, { record: 'Record', version: 'RecordVersion' }, 'author or owner counterproposal on unexecuted records; new immutable draft invalidates approvals; owner-only templates/results/budgets/obligations/decisions'),
    recordSubmit: operation({ ...scope, versionId: 'uuid', expectedRevision: 'integer' }, { record: 'Record', version: 'RecordVersion' }, 'author; obligations owner only'),
    recordReview: operation({ ...scope, versionId: 'uuid', expectedRevision: 'integer', decision: 'target RecordStatus', note: 'string?', approvedTerms: 'ApprovedTerms? contribution only', cancellationAgreementVersionId: 'uuid? obligation cancellation only', viewerPartnerIds: 'uuid[]? analysis_result publication or approved contribution only', downloadPartnerIds: 'uuid[]? subset of explicit viewers' }, { record: 'Record', review: 'Review' }, 'owner'),
    recordVersions: operation({ ...scope }, { versions: 'RecordVersionSummary[]' }, 'owner or author; publication viewers see released version only'),
    findingPublish: operation({ ...scope, versionId: 'uuid', expectedRevision: 'integer', viewerPartnerIds: 'uuid[]', downloadPartnerIds: 'uuid[]' }, { record: 'Record', publication: 'Publication' }, 'owner; exact approved version; privacy and consent review'),
    findingWithdraw: operation({ ...scope, versionId: 'uuid', expectedRevision: 'integer', reason: 'string' }, { record: 'Record' }, 'owner'),
    findingComment: operation({ ...scope, versionId: 'uuid', text: 'string' }, { comment: 'FindingComment' }, 'authorized published viewer with comment_on_findings'),
    partnerInviteCreate: operation({ studyId: 'uuid', partnerId: 'uuid', expiresAt: 'ISO timestamp?', preset: 'AccessPreset', permissions: 'string[]?' }, { invitation: 'PartnerInvitation', delivery: 'DeliveryState' }, 'owner'),
    partnerInviteGet: operation({ invite: 'opaque token' }, { invitation: 'PartnerInvitationPreview' }, 'verified invited individual only'),
    partnerInviteAccept: operation({ invite: 'opaque token' }, { partner: 'Partner', workspace: 'WorkspaceSummary' }, 'verified invited individual only'),
    partnerInviteRevoke: operation({ studyId: 'uuid', partnerId: 'uuid', invitationId: 'uuid', expectedRevision: 'integer' }, { invitation: 'PartnerInvitation' }, 'owner'),
    agreementApprove: operation({ ...scope, versionId: 'uuid', expectedRevision: 'integer', documentHash: 'sha256', ipExplanationVersionId: 'uuid', ipReadAcknowledged: 'true' }, { record: 'Record', approval: 'AgreementApproval', approvals: 'AgreementApproval[]' }, 'actual owner or actual partner; same version/hash'),
    agreementAmend: operation({ ...scope, versionId: 'uuid', expectedRevision: 'integer', data: 'AgreementData', reason: 'string' }, { record: 'Record', version: 'RecordVersion' }, 'actual owner or actual partner; new agreement record referencing executed source'),
    signingStart: operation({ ...scope, versionId: 'uuid', expectedRevision: 'integer', documentHash: 'sha256', consent: 'true' }, { signing: 'SigningSession' }, 'owner; both exact-version approvals and operational provider'),
    signingView: operation({ ...scope, signingId: 'uuid' }, { signing: 'SigningSession' }, 'actual owner or actual agreement partner'),
    signingRefresh: operation({ ...scope, signingId: 'uuid', expectedRevision: 'integer' }, { record: 'Record', signing: 'SigningSession' }, 'actual owner or actual agreement partner; server verifies provider state'),
    workspaceDocumentPut: operation({ studyId: 'uuid', partnerId: 'uuid', recordId: 'uuid?', filename: 'string', mediaType: 'allowlisted MIME', contentBase64: 'bounded base64' }, { document: 'PrivateDocumentMetadata' }, 'owner or actual folder author; private server encrypted storage'),
    workspaceDocumentGet: operation({ studyId: 'uuid', partnerId: 'uuid', documentId: 'uuid', download: 'boolean?' }, { document: 'PrivateDocumentMetadata', contentBase64: 'base64' }, 'current folder/record/version authorization; separate release/download rights'),
    workspaceExport: operation({ ...scope, versionId: 'uuid', format: 'text|json|html|docx' }, { filename: 'string', mediaType: 'MIME', contentBase64: 'base64', versionId: 'uuid', documentHash: 'sha256' }, 'current exact-version read AND applicable export/download rights; PDF via authorized HTML and native browser print'),
    workspaceImpact: operation({ ...scope, fromVersionId: 'uuid', toVersionId: 'uuid', includeAI: 'boolean?' }, { changes: 'FieldChange[]', approvalsInvalidated: 'boolean', binding: 'false', ai: 'ImpactAIState' }, 'owner or actual record author'),
    workspaceAnalysis: operation({ studyId: 'uuid', partnerId: 'uuid', requestRecordId: 'uuid', sourceSnapshotId: 'uuid? omit to create consent-bound snapshot', operation: 'AnalysisOperation' }, { operation: 'AnalysisOperation', sourceSnapshotId: 'uuid', summary: 'ApprovedAnalysisProjection', provenance: 'AnalysisProvenance', record: 'Record draft analysis_result', version: 'RecordVersion' }, 'owner only; approved request and fixed allowlisted parameters; requestId required')
  };
  return freeze({ VERSIONS, GUIDED_AGREEMENT, PERMISSIONS, PERMISSION_ALIASES, ACCESS_PRESETS, ROLE_PRESETS, CLIENT_ACTIONS, READ_ACTIONS, INTERNAL_ACTIONS, CONTRIBUTION_CATEGORIES, RECORD_KINDS, RECORD_STATUSES, RECORD_SCHEMAS, RECORD_TRANSITIONS, AGREEMENT_SECTIONS, ANALYSIS_OPERATIONS, PARTNER_FIELDS, APPROVED_TERMS_FIELDS, OPERATIONS, safeError, validateRecord, validatePartner, validateApprovedTerms, missingFields, canTransition, compareRecords, renderAgreement, isBindingObligation, permissionLabel });
});
