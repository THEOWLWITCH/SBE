(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_RESEARCH = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSIONS = Object.freeze({ application: '1.2.0', research: '1.0.0', schema: 1, metrics: '1.0.0' });
  const PERMISSIONS = Object.freeze({
    view_study: 'צפייה במחקר', edit_study: 'עריכת המחקר', manage_questionnaires: 'ניהול שאלונים',
    view_aggregate_results: 'צפייה בתוצאות מצטברות', view_pseudonymized_data: 'צפייה בנתונים עם מזהי מחקר',
    view_identifiable_data: 'צפייה בפרטים מזהים', view_document_content: 'צפייה בתוכן מסמכים',
    export_data: 'ייצוא נתונים', manage_participants: 'ניהול משתתפים', contact_participants: 'יצירת קשר עם משתתפים',
    manage_researchers: 'ניהול הרשאות צוות המחקר', manage_consent: 'ניהול טופסי הסכמה', view_audit_log: 'צפייה ביומן הפעולות',
    view_approved_findings: 'צפייה בממצאים מאושרים', download_approved_findings: 'הורדת ממצאים מאושרים',
    propose_analysis: 'הצעת ניתוח', view_analysis_results: 'צפייה בתוצאות ניתוח מאושרות', comment_on_findings: 'הוספת תגובה לממצא',
    view_approved_pseudonymized_data: 'צפייה בנתונים מאושרים עם מזהי מחקר', export_approved_dataset: 'ייצוא מערך נתונים מאושר',
    view_study_progress: 'צפייה בהתקדמות המחקר', view_approved_contributions: 'צפייה בתרומות מאושרות'
  });
  const STUDY_STATUSES = Object.freeze({ draft: 'טיוטה', pending_approval: 'ממתין לאישור', active: 'פעיל', paused: 'מושהה', completed: 'הסתיים', archived: 'בארכיון' });
  const ROLES = Object.freeze({ pi: 'חוקר.ת ראשי.ת', researcher: 'חוקר.ת', assistant: 'עוזר.ת מחקר או אנליסט.ית' });
  const ROLE_PRESETS = Object.freeze({
    pi: Object.freeze(['view_study', 'manage_questionnaires', 'view_aggregate_results', 'view_pseudonymized_data']),
    researcher: Object.freeze(['view_study', 'view_approved_findings']),
    assistant: Object.freeze(['view_study', 'view_aggregate_results'])
  });
  const CONSTRUCTS = Object.freeze([
    ['PLSE', 'מסוגלות עצמית להובלת מוכנות'], ['WIFP', 'נכונות להשקיע במוכנות עתידית'],
    ['social_mechanisms', 'מודעות למנגנונים חברתיים קיימים'], ['responsibility', 'אחריות מקצועית נתפסת'],
    ['initiative', 'יוזמה פרואקטיבית'], ['empathy', 'אמפתיה והבנת צורכי הקהל'],
    ['communication_confidence', 'ביטחון בתקשורת'], ['relationships', 'איכות הקשר הנתפסת'],
    ['shared_agency', 'מיומנויות משותפות ויכולת פעולה משותפת'], ['preparedness_actions', 'פעולות מוכנות בפועל'],
    ['unexpected_changes', 'שינויים שהתגלו בשאלות פתוחות']
  ].map(([id, title]) => Object.freeze({ id, title, status: 'under-development' })));
  const ITEM_TYPES = Object.freeze({ likert: 'סולם תשובות', number: 'מספר', text: 'תשובה פתוחה', choice: 'בחירה אחת', multiple: 'בחירה מרובה', date: 'תאריך' });
  const DATA_CATEGORIES = Object.freeze({ surveys: 'תשובות לשאלונים', usage: 'נתוני שימוש', historical: 'דוגמאות קודמות', generated: 'דוגמאות שנוצרו בכלי', identities: 'פרטים מזהים', contacts: 'פרטי קשר' });
  const CONTACT_KINDS = Object.freeze({ followup: 'שאלוני המשך', feedback: 'משוב אישי', update: 'עדכוני מחקר' });
  const CLIENT_ACTIONS = Object.freeze([
    'bootstrap', 'studyCreate', 'studyGet', 'studySave', 'studyStatus',
    'memberList', 'memberSet', 'memberRemove', 'versionList', 'versionSave', 'versionPublish',
    'participantList', 'contactGet', 'resultsGet', 'exportData', 'auditList', 'mailList', 'mailResolve', 'contactQueue', 'retentionRun',
    'inviteCreate', 'inviteInfo', 'enroll', 'verifyEmail', 'myStudies', 'participationGet', 'reconsent', 'preferencesSet',
    'emailChange', 'withdraw', 'eraseMyData', 'surveySubmit', 'sampleSubmit', 'sampleGet'
  ]);
  const INTERNAL_ACTIONS = Object.freeze(['recordUsage', 'mailClaim', 'mailComplete', 'followupSchedule']);
  function hasPermission(context, permission) {
    return Object.prototype.hasOwnProperty.call(PERMISSIONS, permission) && !!context &&
      (context.owner === true || (Array.isArray(context.permissions) && context.permissions.includes(permission)));
  }
  return Object.freeze({ VERSIONS, PERMISSIONS, STUDY_STATUSES, ROLES, ROLE_PRESETS, CONSTRUCTS, ITEM_TYPES, DATA_CATEGORIES, CONTACT_KINDS, CLIENT_ACTIONS, INTERNAL_ACTIONS, hasPermission });
});
