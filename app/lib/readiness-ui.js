// מערך המוכנות: המסך (03/11/2026). התוכן מ-readiness-model.js (SBE_PREP), השמירה בשרת (harness/lib/readiness.mjs, פעולות rdy*).
// אב־הטיפוס: המערך שלנו · התוכנית · מפגש 1 · מפגש 2 · מפגש 3 (תרחיש "אזעקות ופינוי", הקלטה בטלפון ותחקיר),
// ובצד: קצוות פתוחים, טבלת הפעולות ורישום השינויים. docs/readiness-program/00-screen-plan.md.
(function () {
  'use strict';
  // המרחב הארגוני: הגרסה לקהילה, לרשות ולארגון (SBE_PREP.forSpace('org'); בלי "מחנך/ת" ו"מורה")
  const ORGSP = !!(window.SBE_ORGW && window.SBE_ORGW.isOrg());
  const P = window.SBE_PREP && (ORGSP ? window.SBE_PREP.forSpace('org') : window.SBE_PREP);
  const app = document.getElementById('app');
  if (!P || !app) return;
  const DEMO = new URLSearchParams(location.search).get('demolab') === '1';
  const ss = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const SERVER = (typeof window.sbeAIOrigin === 'function' && window.sbeAIOrigin()) || 'https://sbe-server.onrender.com';
  const TOKEN = ss('sbe.session.token');
  const UK = (b) => (window.sbeUserKey && TOKEN ? window.sbeUserKey(b) : b);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(UK(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(UK(k), JSON.stringify(v)); } catch (e) {} }
  };
  const S = { lang: LS.get('sbe.prep.lang', 'he') === 'ar' ? 'ar' : 'he', by: LS.get('sbe.prep.by', ''), doc: null, list: null, view: 'home', tab: {}, sheet: 'tasks', menu: false, exId: '', busy: false };
  // מנהלת המערכת רואה את כל המערכים; לבית ספר יש מערך אחד (04/11/2026)
  const SYS = ss('sbe.session.homeUrl') === 'admin.html?role=sys';
  let L = P.content(S.lang);

  // טקסטים קבועים שנוספו במסך (העיקריים ב-P.UI). ערבית ספרותית פשוטה.
  const X = {
    he: { login: 'כדי לפתוח את מערך המוכנות, אפשר להיכנס עם קוד שיש בו את הכלי.', ours: 'המערכים שלנו', none: 'עוד אין מערך מוכנות.', updated: 'עודכן',
      sessions: 'המפגשים', later: 'בשלב הבא', escalate: 'קצוות שעולים למנהל/ת מצב החירום', partners: 'שותפים: עם מי מתאמים בחירום?', expect: 'מה אנחנו מצפים לקבל', provide: 'מה אנחנו מספקים',
      ifGap: 'פער ממשק: חסר צד אחד', partner: 'שותף/ה', step: 'שלב', product: 'התוצר', questions: 'שאלות לצוות', ourText: 'מה כתבנו', ask: 'חוליות חלשות וחלופות', working: 'עובדים על זה…',
      gaps: 'פערים', alts: 'חלופות שאולי לא עלו', nextSteps: 'צעדי המשך', toEnds: 'לקצוות הפתוחים', addGap: 'לרשימת הפערים', before: 'לפני המפגש', during: 'במפגש', our: 'שלנו',
      teamsT: 'טבלת הצוותים', addTeam: '➕ צוות שלא ברשימה', cancelT: 'ביטול', editT: 'עריכה', closeT: 'סגירה', keptT: 'נשמר (עבד, ממשיכים כך)', gapT: 'פער', gapsClosed: 'פערים נסגרו: הפעולה שלהם נבדקה בתרגיל', noAction: 'עוד אין פעולה', linkedAct: 'הפעולה', gapsInfo: 'פער נסגר כשהפעולה שנוצרה ממנו נבדקה בתרגיל או ביום החוסן, או בהעברה להושלמו.', lastEx: 'התרגיל האחרון', draftReplace: 'טיוטה חדשה תחליף את הטבלה, כולל מה שהצוות ערך בה. להמשיך?', saveFirst: 'הסיכום לא נשלח, כי השמירה לא הצליחה. אפשר לנסות שוב בעוד רגע.', mailSkipped: 'לא נשלח', safeLine: 'מי שהתרחיש קרוב מדי אליו/ה יכול/ה לבחור תפקיד של רשם/ת או צופה, ולצאת לרגע בכל שלב.', howAnswer: 'איך עונים', parentsMsgT: 'ההודעה להורים', parentsMsgCues: 'כותבים את ההודעה כמו שתישלח: מה קרה, בעובדות · איפה הילדים ומה עושים · מה מבקשים מההורים · מתי העדכון הבא.', parentsMsgPh: 'למשל: הורים יקרים, לפני כרבע שעה...', heOnly: 'הרשימה מתיק הרציפות כתובה בעברית.', toJourney: 'למסע אל החוסן החברתי', unsaved: 'אין חיבור כרגע. השינויים נשמרו במסך וייכנסו כשהחיבור יחזור.', trNotLoaded: 'התמליל של ההקלטה עוד לא נכנס לדיון, והוא יימחק כשהמפגש מסומן כהושלם. להמשיך?', notSummed: 'המפגש עבר ועוד לא סוכם', nextSet: 'המפגש הבא נקבע ל־', ownerFilled: 'אחראי/ת הושלם/ה לפי ראש הצוות או מנהל/ת מצב החירום', undoT: '↩ ביטול', undoneT: 'השינוי בוטל', cancelWhy: 'למה הפעולה בוטלה? (רשות, נשמר לתיעוד)', ownerPerson: 'אחראי/ת: שם של אדם מהצוות', noPeople: 'עוד אין שמות בטבלת הצוותים, ולכן האחראי/ת הוא/היא מנהל/ת מצב החירום. כדי שיופיעו שמות, אפשר למלא אותם:', delQ: 'למחוק את המשימה?', addTeamBtn: 'הוספת הצוות', teamName: 'שם הצוות', teamNamePh: 'למשל: צוות הסעות', teamDuty: 'מה הצוות עושה', teamDutyPh: 'למשל: יציאה מסודרת של ההסעות וספירה בהגעה', teamNameAsk: 'כדי להוסיף צוות, אפשר לכתוב את שמו.', teamExists: 'צוות בשם הזה כבר ברשימה.', teamOurs: 'צוות של בית הספר', teamDel: 'הסרת הצוות', teamDelQ: 'להסיר את הצוות מהרשימה? המשימות שכבר נכתבו נשארות.', addMember: '➕ חבר/ה בצוות', checklist: 'רשימת בדיקה', yes: 'קיים', part: 'חלקי', no: 'חסר', reportOf: 'הדיווח של הצוות', timer3: 'שעון של 3 דקות',
      version: 'אורך התרגיל', v20: '20 דקות (ישיבת צוות)', v60: 'שעה', startEx: 'התחלת התרגיל', exercises: 'התרגילים', cont: 'המשך', finish: 'סיום התרחיש', opening: 'פתיחה',
      closing: 'סגירה', copy: 'העתקה', copied: 'הועתק', openRec: 'פתיחת קישור לטלפון', recOn: 'ההקלטה פתוחה', marks: 'רגעי החלטה', segs: 'קטעים בתמליל', loadTr: 'טעינת התמליל',
      editTr: 'עריכת התמליל (לפני שהוא משמש לדוח)', saveTr: 'שמירת התמליל', worked: 'מה עבד', timeline: 'ציר הזמן', fb: 'משוב מקצועי', src: 'מקור', addRow: '➕ שורה',
      toPlan: 'לעדכון במערך', printCards: '🖨 כרטיסי העדכונים (בלי חשמל)', printReport: '🖨 דוח התחקיר', printSummary: '🖨 סיכום המפגש', printPlan: '🖨 התוכנית והנספחים', printTeams: '🖨 טבלת הצוותים',
      confirmClose: 'לסגור את הקצה? מי שפתח/ה אותו יקבל/תקבל עדכון במפגש הבא.', confirmApprove: 'לאשר את הדוח? התמליל יימחק, והדוח והסימונים נשארים.', deleted: 'נמחק',
      none2: 'אין עדיין.', mailSent: 'נשלחו', reloaded: 'מישהו אחר עדכן את המערך. המסך נטען מחדש.', serverOld: 'השרת עוד לא עודכן לכלי הזה. אחרי עדכון השרת הכלי יעבוד.',
      waking: 'מתחברים לשרת… החיבור הראשון ביום נמשך עד כדקה.', missed: 'פעמים שעבר המועד', moveNext: 'עדכון מועד', when: 'מתי', extra: 'עוד', annexText: 'מה כתוב בנספח',
      callAfter: 'אחרי שההודעה נשלחת', recNo: 'בלי טלפון או בלי הסכמה: מסמנים רגעי החלטה כאן, בכפתור.', ledByDeputy: 'ממלא/ת המקום הוביל/ה', builtByTeam: 'התרחיש נבנה על ידי הצוות',
      decmapT: 'מפת ההחלטות לפי רמות', decmapNotApproved: 'עוד לא אושרה עם הרשות והמפקח/ת', printDecmap: '🖨 מפת ההחלטות', ideasT: 'דיון החלטות', ideasOpen: 'רעיונות מחכים להחלטה',
      discussBy: 'הדיון עד', whyNot: 'הסבר למי שהציע/ה', sendDecisions: '✉️ שליחת ההחלטות לכל המשתתפים', printIdeas: '🖨 ההחלטות',
      s4: 'מפגש 4', s5: 'מפגש 5', routineStep: '🎲 מחולל תרחישים: מוכנות למשברים ולמצבי חירום', intent: 'כוונת בית הספר', success: 'מה נחשב הצלחה', scenario: 'התרחיש',
      ourTeam: 'הצוות שלנו', sayIt: 'מה אומרים לדמות', roleplay: 'משחק תפקידים: דמויות מבחוץ', roleInfo: 'הכלי מגלם את הדמות ומגיב למה שאתם אומרים. אפשר לעבור בין הדמויות.', character: 'הדמות',
      learnWhat: 'מה לומדים במפגש', pickGap: 'הפער שהצוות בחר מהתחקיר', aidDate: 'מתי הצוות עבר עזרה ראשונה פיזית ונפשית', annexToUpdate: 'הנספח שמתעדכן', updatedAfter: 'סימון: עודכן אחרי תחקיר', learnPlan: 'מה לומדים, ואיך', noGaps: 'עוד אין פערים. הם נוספים ממפגש 2 ומהתחקיר של מפגש 3.',
      noPrep: 'התרחיש לא מתפרסם מראש.', compareT: 'השוואה בין מפגש 3 למפגש 5', compareInfo: 'לכל נושא מדוח מפגש 3: מה קרה אז, מה קרה עכשיו, והמצב. מתחילים במה שהשתפר. פער שנסגר נכנס כנוהל למערך; פער שהשתפר, פתוח או חדש מקבל פעולה ונבדק ביום החוסן הבא.',
      needS3: 'ההשוואה נפתחת אחרי שיש דוח תחקיר של מפגש 3.', needS5: 'הטיוטה נבנית אחרי שיש דוח תחקיר של מפגש 5.', compareDraft: 'טיוטת השוואה משני הדוחות', compareApply: 'עדכון המערך לפי ההשוואה', printCompare: '🖨 ההשוואה',
      genT: 'מחולל תרחישים: מוכנות למשברים ולמצבי חירום', genInfo: 'לתרגול בשגרה ובחירום: משבר בשגרה (גשם שמציף, אלימות של הורה, תלמיד/ה שנעדר/ת בטיול) או חירום. אתם בונים את התרחיש, והכלי עוזר: קודם מחליטים מה בודקים, אחר כך בוחרים את הצירים, ורק אז הכלי כותב טיוטה שאפשר לערוך. נהלים מחייבים קופצים בתרחיש, ונוהל שחסר נכנס לקצוות הפתוחים.',
      notPracticed: 'נספח שעוד לא תורגל', genTests: 'מה בודקים', teamOnly: 'רק בבחירה שלכם', noSensitive: 'הכלי לא בוחר משבר רגשי־חברתי', genAxes: 'הצירים', genCheck: 'בדיקה לפני הבנייה (הצעה)',
      adaptNote: 'בכל תרחיש יש לפחות עדכון אחד על מענה מותאם לכל קושי.', genBuild: 'בניית טיוטה', genBad: 'הטיוטה לא עמדה בכללים (שלושה סבבים, בלי הפניה ובלי פגיעה עצמית). אפשר לנסות שוב.', ourScenarios: 'התרחישים שבניתם',
      builtBy: 'נבנה על ידי הצוות', runS5: 'להרצה במפגש 5', runS3: 'להרצה בתרגיל צוות', confirmDel: 'למחוק את התרחיש?',

      meetings: '📅 מפגשים', newMeeting: '➕ תכנון מפגש חדש', fixedSessions: 'חמשת המפגשים', ourMeetings: 'מפגשים שתכננתם', noMeetings: 'עוד אין מפגשים נוספים.',
      mType: 'סוג המפגש', mTitle: 'שם המפגש', mDate: 'תאריך', mTime: 'שעה', mWho: 'מי משתתף/ת', agenda: 'סדר היום', createMeeting: 'יצירת המפגש', delMeeting: 'מחיקת המפגש', confirmDelM: 'למחוק את המפגש?',
      tabUpdate: '1. סבב עדכון', tabMain: '2. המפגש', tabTalk: '3. דיון וסיכום', updateInfo: 'פותחים בסבב עדכון: כל צוות מדווח לפי תבנית הדיווח, ומעדכנים את הסטטוס בטבלת המעקב.', repT: '📝 הדיווחים בסבב', repInfo: 'כותבים תוך כדי, צוות אחר צוות. פער ומה חסר עוברים לקצוות הפתוחים, והצעד הבא למשימות של הצוות. ב"דיון וסיכום" בוחרים מה נכנס לטבלת המעקב.', repGo: 'לדיון וסיכום: מה נכנס לטבלת המעקב ←', nothingNew: 'כל מה שעלה כבר נמצא בטבלת המעקב.',
      notes: 'מה עלה בדיון', notesPh: 'למשל: הוחלט להזמין מפתח נוסף למרחב בקומה השנייה. מוביל/ת צוות הביטחון בודק/ת עם הרשות את האתר החלופי. מחכים לתשובה על ההסעות.',
      extract: '🤖 גזירת משימות, החלטות וקצוות פתוחים', extractInfo: 'הכלי מציע, והצוות בוחר מה נכנס לטבלת המעקב ולאיזה גיליון.', toTrack: 'הוספה לטבלת המעקב', added: 'נוסף לטבלת המעקב', pick: 'להוסיף',
      sheet: 'גיליון', scheduleNext: 'קביעת המפגש הבא', sendSummary: '✉️ שליחת הסיכום לכל המשתתפים', summaryT: 'סיכום המפגש', fromHere: 'מהמפגש הזה',
      track: '📋 טבלת מעקב', trackT: 'טבלת מעקב', moveTo: 'העברה לגיליון', index: '📊 מדד המוכנות', contKit: '🗂 תיק הרציפות', partnersBtn: '🤝 שותפים',
      contInfo: 'מוכנות הכיתה לחירום, צוותי העבודה בכיתה ושרשרת הקשר נמצאים בתיק הרציפות של כל מחנך/ת. כך לא כותבים פעמיים.', contAfter: 'מה המחנכים מוסיפים לתיק הרציפות אחרי התחקיר',
      openMeeting: 'פתיחת המפגש', confirmTested: 'הפעולה נבדקה בתרגיל או ביום החוסן? רק אז היא עוברת להושלמו.', kindT: 'מאיפה', closedAt: 'נסגר',
      contShort: 'מוכנות הכיתה לחירום ושרשרת הקשר', whoAmI: 'מי אני?', toArchive: '📁 העברת הפרוטוקול לתיק הרציפות', archived: 'בארכיון תיק הרציפות', archiveInfo: 'בארכיון נשמרים המשתתפים, הפרוטוקול שהוקלד וההחלטות, המשימות והקצוות מהמפגש. התמליל לא נכנס לארכיון.', toCont: 'לארכיון בתיק הרציפות',
      binder: '🖨 תיקיית הרציפות להדפסה', binderT: 'תיקיית הרציפות', binderManual: 'מה מוסיפים לתיקייה ידנית', bUpdated: 'עודכן', bWhere: 'נשמר ב', bFiles: '📎 קבצים לתיקייה', protoT: 'פרוטוקולים', mandT: 'הנהלים המחייבים', callT: 'קריאה לעזרה: ששת החלקים', reportT2: 'תבנית הדיווח', whoHere: '👥 מי כאן היום', whoInfo: 'מסמנים מי הגיע/ה. הסיכום נשלח רק למי שסומן/ה ויש לו/ה מייל.', addPerson: '➕ משתתף/ת', pName: 'שם', pRole: 'תפקיד', pMail: 'מייל', noEmailYet: 'כדי לשלוח את הסיכום, אפשר לסמן בסבב העדכון מי השתתף/ה, עם מייל.', sendTo: '✉️ שליחת הסיכום למשתתפים', attendT: 'משתתפים', docT: 'תיעוד הדיון', docInfo: 'במפגש מדברים ולא כותבים. אפשר לתעד בדרך אחת או בכמה, והכלי קורא את הכול:', tProto: '✍️ פרוטוקול תוך כדי', tRec: '🎙 הקלטה בטלפון', tFile: '📄 תמליל או טקסט',
      pWho: 'דובר/ת', pWhat: 'עיקרי הדברים', pKind: 'מה זה', kSaid: 'נאמר', kDecision: 'החלטה', kTask: 'משימה', kEnd: 'קצה פתוח', addLine: '➕ שורה',
      protoInfo: 'מישהו/י מהצוות מקליד/ה תוך כדי, בקצרה. שורה שסומנה כהחלטה, משימה או קצה פתוח נכנסת ישר לרשימה, ומה שנאמר הכלי קורא ומציע.',
      recMeetInfo: 'הטלפון מקליט בדפדפן, וכל דקה הקול עובר לתמלול ונזרק. התמליל נמחק כשמסמנים שהמפגש הושלם.', loadToNotes: 'הכנסת התמליל לדיון', trAdded: 'התמליל נוסף לדיון',
      fileInfo: 'תמליל מ-Zoom או מ-Teams, או פרוטוקול שנכתב ב-Word או כטקסט. הקובץ נקרא בדפדפן.', fileRead: 'הקובץ נקרא ונוסף לדיון', fileBad: 'את הקובץ הזה אי אפשר לקרוא. אפשר להדביק את הטקסט.', pasteLbl: 'הטקסט של הדיון (אפשר להדביק כאן)',
      noMaterial: 'עוד אין מה לקרוא: אפשר להקליד פרוטוקול, להכניס תמליל או להעלות קובץ.', partnersT: 'שותפים', indexInd: 'מה הצוות עושה בעצמו', remsT: 'ששת השלבים', exRun: 'הרצת התרגיל', exDebrief: 'התחקיר', timing: 'לוח הזמנים של התרגיל', goTeams: '🖨 טבלת הצוותים וכרטיס הכיס', allOpen: 'פתוחים', ours2: 'כל המערכים (רק לך)',
      min: 'דק׳', byName: 'השם שלי', allTeams: 'כל הצוות', exportNote: 'שמות של תלמידים לא נכנסים לכלי. הפרטים נשמרים בבית הספר.' },
    ar: { login: 'لفتح منظومة الجاهزية، يمكن الدخول برمز يشمل هذه الأداة.', ours: 'منظوماتنا', none: 'لا توجد منظومة جاهزية بعد.', updated: 'آخر تحديث',
      sessions: 'اللقاءات', later: 'في المرحلة القادمة', escalate: 'أطراف تُرفع إلى مدير/ة حالة الطوارئ', partners: 'الشركاء: مع من ننسّق في الطوارئ؟', expect: 'ما نتوقع أن نحصل عليه', provide: 'ما نقدّمه',
      ifGap: 'فجوة في التنسيق: ينقص أحد الطرفين', partner: 'الشريك/ة', step: 'مرحلة', product: 'الناتج', questions: 'أسئلة للطاقم', ourText: 'ما كتبناه', ask: 'حلقات ضعيفة وبدائل', working: 'نعمل على ذلك…',
      gaps: 'فجوات', alts: 'بدائل ربما لم تُطرح', nextSteps: 'خطوات تالية', toEnds: 'إلى الأطراف المفتوحة', addGap: 'إلى قائمة الفجوات', before: 'قبل اللقاء', during: 'في اللقاء', our: 'لنا',
      teamsT: 'جدول الطواقم', addTeam: '➕ طاقم غير موجود في القائمة', cancelT: 'إلغاء', editT: 'تعديل', closeT: 'إغلاق', keptT: 'حُفظ (نجح، نستمر هكذا)', gapT: 'فجوة', gapsClosed: 'أُغلقت فجوات: الإجراء الخاص بها فُحص في تمرين', noAction: 'لا يوجد إجراء بعد', linkedAct: 'الإجراء', gapsInfo: 'تُغلق الفجوة عندما يُفحص الإجراء الناتج عنها في تمرين أو في يوم الصمود، أو بنقلها إلى اكتملت.', lastEx: 'التمرين الأخير', draftReplace: 'مسودة جديدة ستستبدل الجدول، بما في ذلك ما عدّله الطاقم. هل نتابع؟', saveFirst: 'لم يُرسل التلخيص لأن الحفظ لم ينجح. يمكن المحاولة بعد لحظة.', mailSkipped: 'لم يُرسل', safeLine: 'من يشعر/تشعر أن السيناريو قريب جدًا منه/ها يمكنه/ها اختيار دور المسجِّل/ة أو المراقب/ة، والخروج للحظة في أي مرحلة.', howAnswer: 'كيف نجيب', parentsMsgT: 'الرسالة إلى الأهالي', parentsMsgCues: 'نكتب الرسالة كما ستُرسل: ماذا حدث، بالحقائق · أين الأبناء وماذا نفعل · ماذا نطلب من الأهالي · متى التحديث القادم.', parentsMsgPh: 'مثلًا: أهالينا الأعزاء، قبل نحو ربع ساعة...', heOnly: 'القائمة من ملف الاستمرارية مكتوبة بالعبرية.', toJourney: 'إلى الرحلة نحو الصمود الاجتماعي', unsaved: 'لا يوجد اتصال حاليًا. التغييرات محفوظة على الشاشة وستدخل عند عودة الاتصال.', trNotLoaded: 'نص التسجيل لم يدخل إلى النقاش بعد، وسيُحذف عند تعليم اللقاء كمكتمل. هل نتابع؟', notSummed: 'اللقاء مضى ولم يُلخَّص بعد', nextSet: 'اللقاء القادم مُحدَّد في ', ownerFilled: 'أُكمل المسؤول/ة حسب رئيس/ة الطاقم أو مدير/ة حالة الطوارئ', undoT: '↩ تراجع', undoneT: 'أُلغي التغيير', cancelWhy: 'لماذا أُلغي الإجراء؟ (اختياري، يُحفظ للتوثيق)', ownerPerson: 'المسؤول/ة: اسم شخص من الطاقم', noPeople: 'لاختيار مسؤول/ة بالاسم، يمكن تعبئة الأسماء في جدول الطواقم:', delQ: 'حذف المهمة؟', addTeamBtn: 'إضافة الطاقم', teamName: 'اسم الطاقم', teamNamePh: 'مثلًا: طاقم الحافلات', teamDuty: 'ماذا يفعل الطاقم', teamDutyPh: 'مثلًا: خروج منظّم للحافلات والعدّ عند الوصول', teamNameAsk: 'لإضافة طاقم، يمكن كتابة اسمه.', teamExists: 'طاقم بهذا الاسم موجود في القائمة.', teamOurs: 'طاقم المدرسة', teamDel: 'إزالة الطاقم', teamDelQ: 'إزالة الطاقم من القائمة؟ المهام التي كُتبت تبقى.', addMember: '➕ عضو/ة في الطاقم', checklist: 'قائمة فحص', yes: 'موجود', part: 'جزئي', no: 'ناقص', reportOf: 'تقرير الطاقم', timer3: 'ساعة لثلاث دقائق',
      version: 'مدة التمرين', v20: '20 دقيقة (جلسة طاقم)', v60: 'ساعة', startEx: 'بدء التمرين', exercises: 'التمارين', cont: 'متابعة', finish: 'إنهاء السيناريو', opening: 'افتتاح',
      closing: 'إغلاق', copy: 'نسخ', copied: 'تم النسخ', openRec: 'فتح رابط للهاتف', recOn: 'التسجيل مفتوح', marks: 'لحظات قرار', segs: 'مقاطع في النص المكتوب', loadTr: 'تحميل النص المكتوب',
      editTr: 'تحرير النص المكتوب (قبل استخدامه في التقرير)', saveTr: 'حفظ النص المكتوب', worked: 'ما الذي نجح', timeline: 'التسلسل الزمني', fb: 'ملاحظات مهنية', src: 'مصدر', addRow: '➕ سطر',
      toPlan: 'للتحديث في المنظومة', printCards: '🖨 بطاقات التحديثات (بدون كهرباء)', printReport: '🖨 تقرير استخلاص العبر', printSummary: '🖨 تلخيص اللقاء', printPlan: '🖨 الخطة والملاحق', printTeams: '🖨 جدول الطواقم',
      confirmClose: 'هل نغلق هذا الطرف؟ من فتحه سيحصل على تحديث في اللقاء القادم.', confirmApprove: 'هل نصادق على التقرير؟ سيُحذف النص المكتوب، ويبقى التقرير والإشارات.', deleted: 'حُذف',
      none2: 'لا يوجد بعد.', mailSent: 'أُرسلت', reloaded: 'قام شخص آخر بتحديث المنظومة. أُعيد تحميل الشاشة.', serverOld: 'لم يُحدَّث الخادم بعد لهذه الأداة. بعد التحديث ستعمل الأداة.',
      waking: 'نتصل بالخادم… الاتصال الأول في اليوم يستغرق حتى دقيقة.', missed: 'مرات تجاوز الموعد', moveNext: 'تحديث الموعد', when: 'متى', extra: 'المزيد', annexText: 'ما هو مكتوب في الملحق',
      callAfter: 'بعد إرسال الرسالة', recNo: 'بدون هاتف أو بدون موافقة: نشير إلى لحظات القرار هنا، بالزر.', ledByDeputy: 'قاد/ت القائم/ة بالأعمال', builtByTeam: 'بنى الطاقم السيناريو',
      decmapT: 'مفتاح القرارات حسب المستويات', decmapNotApproved: 'لم يُصادَق عليه بعد مع السلطة المحلية والمفتّش/ة', printDecmap: '🖨 مفتاح القرارات', ideasT: 'نقاش القرارات', ideasOpen: 'أفكار تنتظر قرارًا',
      discussBy: 'النقاش حتى', whyNot: 'شرح لمن اقترح/ت', sendDecisions: '✉️ إرسال القرارات لكل المشاركين', printIdeas: '🖨 القرارات',
      s4: 'اللقاء 4', s5: 'اللقاء 5', routineStep: '🎲 مولّد السيناريوهات: الجاهزية للأزمات وحالات الطوارئ', intent: 'نية المدرسة', success: 'ما الذي يُعدّ نجاحًا', scenario: 'السيناريو',
      ourTeam: 'طاقمنا', sayIt: 'ماذا نقول للشخصية', roleplay: 'لعب أدوار: شخصيات من الخارج', roleInfo: 'تؤدّي الأداة دور الشخصية وتتجاوب مع ما تقولونه. يمكن التنقّل بين الشخصيات.', character: 'الشخصية',
      learnWhat: 'ماذا نتعلّم في اللقاء', pickGap: 'الفجوة التي اختارها الطاقم من استخلاص العبر', aidDate: 'متى اجتاز الطاقم الإسعاف الأولي الجسدي والنفسي', annexToUpdate: 'الملحق الذي يُحدَّث', updatedAfter: 'إشارة: حُدِّث بعد استخلاص العبر', learnPlan: 'ماذا نتعلّم، وكيف', noGaps: 'لا توجد فجوات بعد. تُضاف من اللقاء 2 ومن استخلاص العبر في اللقاء 3.',
      noPrep: 'لا يُنشر السيناريو مسبقًا.', compareT: 'مقارنة بين اللقاء 3 واللقاء 5', compareInfo: 'لكل موضوع من تقرير اللقاء 3: ما الذي حدث آنذاك، ما الذي حدث الآن، والوضع. نبدأ بما تحسّن. الفجوة التي أُغلقت تدخل كإجراء في المنظومة؛ والفجوة التي تحسّنت أو بقيت مفتوحة أو جديدة تحصل على إجراء وتُفحص في يوم الصمود القادم.',
      needS3: 'تُفتح المقارنة بعد وجود تقرير استخلاص العبر للقاء 3.', needS5: 'تُبنى المسودة بعد وجود تقرير استخلاص العبر للقاء 5.', compareDraft: 'مسودة مقارنة من التقريرين', compareApply: 'تحديث المنظومة حسب المقارنة', printCompare: '🖨 المقارنة',
      genT: 'مولّد السيناريوهات: الجاهزية للأزمات وحالات الطوارئ', genInfo: 'للتدريب في الروتين وفي الطوارئ: أزمة في الروتين (مطر يُغرق المدرسة، عنف من أحد الأهالي، طالب/ة غاب/ت في رحلة) أو طوارئ. أنتم تبنون السيناريو والأداة تساعد: أولًا تقرّرون ما الذي نفحصه، ثم تختارون المحاور، وبعدها فقط تكتب الأداة مسودة يمكن تحريرها. تظهر الإجراءات المُلزِمة في السيناريو، والإجراء الناقص يدخل إلى الأطراف المفتوحة.',
      notPracticed: 'ملحق لم يُتدرَّب عليه بعد', genTests: 'ما الذي نفحصه', teamOnly: 'فقط باختياركم', noSensitive: 'الأداة لا تختار أزمة عاطفية اجتماعية', genAxes: 'المحاور', genCheck: 'فحص قبل البناء (اقتراح)',
      adaptNote: 'في كل سيناريو تحديث واحد على الأقل حول الاستجابة الملائمة لكل صعوبة.', genBuild: 'بناء مسودة', genBad: 'المسودة لم تستوفِ القواعد (ثلاث جولات، دون إحالة ودون إيذاء ذاتي). يمكن المحاولة من جديد.', ourScenarios: 'السيناريوهات التي بنيتموها',
      builtBy: 'بناه الطاقم', runS5: 'للتشغيل في اللقاء 5', runS3: 'للتشغيل في تمرين طاقم', confirmDel: 'هل نحذف السيناريو؟',

      meetings: '📅 اللقاءات', newMeeting: '➕ تخطيط لقاء جديد', fixedSessions: 'اللقاءات الخمسة', ourMeetings: 'لقاءات خطّطتم لها', noMeetings: 'لا توجد لقاءات إضافية بعد.',
      mType: 'نوع اللقاء', mTitle: 'اسم اللقاء', mDate: 'التاريخ', mTime: 'الساعة', mWho: 'من يشارك', agenda: 'جدول الأعمال', createMeeting: 'إنشاء اللقاء', delMeeting: 'حذف اللقاء', confirmDelM: 'هل نحذف اللقاء؟',
      tabUpdate: '1. جولة تحديث', tabMain: '2. اللقاء', tabTalk: '3. نقاش وتلخيص', updateInfo: 'نبدأ بجولة تحديث: كل طاقم يقدّم تقريرًا حسب نموذج التقرير، ونحدّث الحالة في جدول المتابعة.', repT: '📝 التقارير في الجولة', repInfo: 'نكتب أثناء الجولة، طاقمًا بعد طاقم. الفجوة وما ينقص تنتقل إلى الأطراف المفتوحة، والخطوة التالية إلى مهام الطاقم. في "نقاش وتلخيص" نختار ما يدخل إلى جدول المتابعة.', repGo: 'إلى النقاش والتلخيص: ما يدخل إلى جدول المتابعة ←', nothingNew: 'كل ما طُرح موجود في جدول المتابعة.',
      notes: 'ما الذي طُرح في النقاش', notesPh: 'مثلًا: تقرّر طلب مفتاح إضافي للحيّز المحمي في الطابق الثاني. قائد/ة طاقم الأمن يفحص مع السلطة المحلية الموقع البديل. ننتظر ردًّا بشأن المواصلات.',
      extract: '🤖 استخراج مهام وقرارات وأطراف مفتوحة', extractInfo: 'تقترح الأداة، ويختار الطاقم ما يدخل إلى جدول المتابعة وإلى أي ورقة.', toTrack: 'إضافة إلى جدول المتابعة', added: 'أُضيف إلى جدول المتابعة', pick: 'إضافة',
      sheet: 'ورقة', scheduleNext: 'تحديد اللقاء القادم', sendSummary: '✉️ إرسال التلخيص لكل المشاركين', summaryT: 'تلخيص اللقاء', fromHere: 'من هذا اللقاء',
      track: '📋 جدول المتابعة', trackT: 'جدول المتابعة', moveTo: 'نقل إلى ورقة', index: '📊 مؤشّر الجاهزية', contKit: '🗂 ملف الاستمرارية', partnersBtn: '🤝 الشركاء',
      contInfo: 'جاهزية الصف للطوارئ، وطواقم العمل في الصف وسلسلة الاتصال موجودة في ملف الاستمرارية لكل مربٍّ/ية. هكذا لا نكتب مرتين.', contAfter: 'ما الذي يضيفه المربّون إلى ملف الاستمرارية بعد استخلاص العبر',
      openMeeting: 'فتح اللقاء', confirmTested: 'هل فُحص الإجراء في تمرين أو في يوم الصمود؟ عندها فقط ينتقل إلى اكتملت.', kindT: 'من أين', closedAt: 'أُغلق',
      contShort: 'جاهزية الصف للطوارئ وسلسلة الاتصال', whoAmI: 'من أنا؟', toArchive: '📁 نقل المحضر إلى ملف الاستمرارية', archived: 'في أرشيف ملف الاستمرارية', archiveInfo: 'يُحفظ في الأرشيف المشاركون والمحضر المكتوب والقرارات والمهام والأطراف من اللقاء. النص المفرَّغ لا يدخل الأرشيف.', toCont: 'إلى الأرشيف في ملف الاستمرارية',
      binder: '🖨 ملف الاستمرارية للطباعة', binderT: 'ملف الاستمرارية', binderManual: 'ما يُضاف إلى الملف يدويًا', bUpdated: 'حُدِّث', bWhere: 'محفوظ في', bFiles: '📎 ملفات للملف', protoT: 'المحاضر', mandT: 'الإجراءات المُلزِمة', callT: 'طلب المساعدة: الأجزاء الستة', reportT2: 'نموذج التقرير', whoHere: '👥 من هنا اليوم', whoInfo: 'نعلّم من حضر. يُرسل التلخيص فقط لمن عُلِّم ولديه بريد إلكتروني.', addPerson: '➕ مشارك/ة', pName: 'الاسم', pRole: 'الدور', pMail: 'البريد الإلكتروني', noEmailYet: 'لإرسال التلخيص، يمكن أن نعلّم في جولة التحديث من شارك، مع البريد الإلكتروني.', sendTo: '✉️ إرسال التلخيص للمشاركين', attendT: 'المشاركون', docT: 'توثيق النقاش', docInfo: 'في اللقاء نتحدّث ولا نكتب. يمكن التوثيق بطريقة واحدة أو بعدّة طرق، والأداة تقرأ كل شيء:', tProto: '✍️ محضر أثناء اللقاء', tRec: '🎙 تسجيل بالهاتف', tFile: '📄 نص مكتوب أو ملف',
      pWho: 'المتحدّث/ة', pWhat: 'أهم ما قيل', pKind: 'ما هذا', kSaid: 'قيل', kDecision: 'قرار', kTask: 'مهمة', kEnd: 'طرف مفتوح', addLine: '➕ سطر',
      protoInfo: 'أحد أفراد الطاقم يكتب أثناء اللقاء، باختصار. السطر المعلَّم كقرار أو مهمة أو طرف مفتوح يدخل مباشرة إلى القائمة، وما قيل تقرؤه الأداة وتقترح.',
      recMeetInfo: 'يسجّل الهاتف في المتصفح، وكل دقيقة ينتقل الصوت إلى التفريغ ثم يُحذف. يُحذف النص المكتوب عند تعليم أن اللقاء اكتمل.', loadToNotes: 'إدخال النص المكتوب إلى النقاش', trAdded: 'أُضيف النص المكتوب إلى النقاش',
      fileInfo: 'نص مكتوب من Zoom أو من Teams، أو محضر كُتب في Word أو كنص. يُقرأ الملف في المتصفح.', fileRead: 'قُرئ الملف وأُضيف إلى النقاش', fileBad: 'لا يمكن قراءة هذا الملف. يمكن لصق النص.', pasteLbl: 'نص النقاش (يمكن اللصق هنا)',
      noMaterial: 'لا يوجد ما يُقرأ بعد: يمكن كتابة محضر أو إدخال نص مكتوب أو رفع ملف.', partnersT: 'الشركاء', indexInd: 'ما يفعله الطاقم بنفسه', remsT: 'المراحل الست', exRun: 'تشغيل التمرين', exDebrief: 'استخلاص العبر', timing: 'الجدول الزمني للتمرين', goTeams: '🖨 جدول الطواقم وبطاقة الجيب', allOpen: 'مفتوحة', ours2: 'كل المنظومات (لك فقط)',
      min: 'د', byName: 'اسمي', allTeams: 'كل الطاقم', exportNote: 'أسماء الطلاب لا تدخل الأداة. التفاصيل تُحفظ في المدرسة.' }
  };
  const T = (k) => P.t(S.lang, k);
  const Y0 = (k) => (X[S.lang] && X[S.lang][k]) || X.he[k] || k;
  const Y = (k) => (!ORGSP ? Y0(k) : S.lang === 'ar' ? P.arWords(Y0(k)) : P.words(Y0(k)));

  // ---------- עזרים ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return el;
  }
  // קישור במילה: לחיצה על המילה עוברת (04/11/2026: "אני רוצה מילה, הקישור יהיה בלחיצה עליה")
  const lnk = (text, on, attrs) => h('a', Object.assign({ href: '#', class: 'lnk', onclick: (e) => { e.preventDefault(); e.stopPropagation(); on(e); } }, attrs || {}), text);
  const uid = (p) => (p || 'x') + '-' + Math.random().toString(16).slice(2, 10);
  const nowIso = () => new Date().toISOString();
  const dateIL = (iso) => (window.sbeDateIL ? window.sbeDateIL(String(iso || '').slice(0, 10)) : String(iso || '').slice(0, 10));
  const plus = (days) => (window.sbeIsoPlus ? window.sbeIsoPlus(days) : new Date(Date.now() + days * 864e5).toISOString().slice(0, 10));
  // הצוותים: שבעת הצוותים של המתווה, ועוד צוותים שיש בבית הספר ואינם ברשימה (04/11/2026: "אפשר גמישות ברשימת הצוותים אם בבי"ס יש צוות שאינו ברשימה").
  // צוות נוסף נשמר בטבלת הצוותים (parts.teams) עם custom ומזהה tc-, ומופיע בכל מקום שמופיעה בו רשימת הצוותים.
  function allTeams() {
    const extra = (S.doc && Array.isArray(S.doc.parts.teams) ? S.doc.parts.teams : []).filter((t) => t && t.custom && String(t.name || '').trim());
    return L.TEAMS.concat(extra.map((t) => ({ id: t.id, name: t.name.trim(), duty: t.duty || '', lead: '', custom: true })));
  }
  const teamName = (id) => { const t = allTeams().find((x) => x.id === id); return t ? t.name : id === 'all' ? Y('allTeams') : (id || ''); };
  // אחראי/ת הוא תמיד אדם מהצוות, בשם, ולא צוות (04/11/2026: "אחראי = תמיד יהיה שם של מישהו מהצוות ולא 'צוות'").
  // השמות מטבלת הצוותים; כשנאמר רק צוות, האחראי/ת הוא/היא מוביל/ת הצוות; בלי שם: "בלי אחראי/ת" באדום.
  function people() {
    const out = [];
    for (const tm of (S.doc && Array.isArray(S.doc.parts.teams) ? S.doc.parts.teams : [])) {
      const tn = teamName(tm.id);
      const add = (pp, role) => { const n = pp && String(pp.name || '').trim(); if (n && !out.some((x) => x.name === n)) out.push({ name: n, role }); };
      add(tm.lead, T('lead') + ' · ' + tn); add(tm.deputy, T('deputy') + ' · ' + tn); (tm.members || []).forEach((m) => add(m, tn));
    }
    return out;
  }
  const leadOf = (teamId) => { const tm = (S.doc && Array.isArray(S.doc.parts.teams) ? S.doc.parts.teams : []).find((t) => t && t.id === teamId); return (tm && tm.lead && String(tm.lead.name || '').trim()) || ''; };
  const notPerson = (v) => { const x = String(v || '').trim(); return !x || x === 'all' || x === Y('allTeams') || allTeams().some((t) => t.name === x) || /^(צוות|طاقم)(\s|$)/.test(x) || /^(כולם|الجميع)$/.test(x); };
  function personOwner(v, teamId) {
    const x = String(v || '').trim().replace(/^\[|\]$/g, '');
    for (const tm of (S.doc && Array.isArray(S.doc.parts.teams) ? S.doc.parts.teams : [])) {
      const tn = teamName(tm.id);
      for (const [lab, pp] of [[T('lead') + ' · ' + tn, tm.lead], [T('deputy') + ' · ' + tn, tm.deputy]]) if (x === lab && pp && String(pp.name || '').trim()) return pp.name.trim();
      if (x && (x === tn || x === tm.name)) return leadOf(tm.id);
    }
    if (notPerson(x)) return fallbackOwner(teamId || (allTeams().find((t) => t.name === x) || {}).id);
    return x;
  }
  // אין מצב שאין אחראי/ת (04/11/2026: "אין מצב שאין שם. אם אין שם אז מי שמעל נכתב, ראש הצוות או המנהלת"):
  // ראש הצוות, ואם אין, מנהל/ת מצב החירום (מוביל/ת צוות הניהול, ואחריו/ה ממלא/ת המקום).
  const deputyOf = (teamId) => { const tm = (S.doc && Array.isArray(S.doc.parts.teams) ? S.doc.parts.teams : []).find((t) => t && t.id === teamId); return (tm && tm.deputy && String(tm.deputy.name || '').trim()) || ''; };
  const fallbackOwner = (teamId) => (teamId && teamId !== 'all' && leadOf(teamId)) || leadOf('mgmt') || deputyOf('mgmt') || '';
  const emRole = () => L.TEAMS[0].lead.split(',')[0];
  // משלימים אחראי/ת בכל פריט פתוח שבו כתוב צוות או שאין שם; נשמר פעם אחת
  function fixOwners() {
    const changed = new Set();
    const fix = (k, it, teamId) => { if (!notPerson(it.owner)) return; const v = personOwner(it.owner, teamId); if (v && v !== it.owner) { it.owner = v; changed.add(k); } };
    for (const a of arr('actions')) if (P.sheetOf('actions', a) !== 'done') fix('actions', a, a.team);
    for (const e of arr('ends')) if (e.status !== 'closed') fix('ends', e, (allTeams().find((t) => t.name === String(e.owner || '').trim()) || {}).id);
    for (const it of arr('ideas')) if (!it.done && (it.decision === 'adopt' || it.decision === 'check')) fix('ideas', it, '');
    for (const k of changed) save(k, Y('ownerFilled'));
  }
  const peopleList = () => h('datalist', { id: 'rdyPeople' }, people().map((pp) => h('option', { value: pp.name, label: pp.role })));
  // כשאין עדיין אף שם בטבלת הצוותים: מנהל/ת מצב החירום, עם הזמנה למלא שמות
  const ownerWarn = (v) => (notPerson(v) ? h('span', { class: 'pill', text: emRole() }) : null);
  // הוספת צוות: שם (ותפקיד, רשות). מחזיר את המזהה, או '' אם לא נוסף.
  async function addTeam(name, duty) {
    const nm = String(name || '').trim();
    if (nm.length < 2) { toast(Y('teamNameAsk')); return ''; }
    if (allTeams().some((t) => t.name.trim() === nm)) { toast(Y('teamExists')); return ''; }
    const teams = arr('teams'); S.doc.parts.teams = teams;
    const id = 'tc-' + Math.random().toString(36).slice(2, 8);
    teams.push({ id, custom: true, name: nm, duty: String(duty || '').trim(), lead: { name: '', email: '' }, deputy: { name: '', email: '' }, members: [] });
    await save('teams', 'צוות נוסף: ' + nm);
    return id;
  }
  // שורה קטנה: "➕ צוות שלא ברשימה" שנפתחת לשם ותפקיד
  function addTeamRow(after) {
    if (!S.addTeamOpen) return h('p', { class: 'small' }, lnk(Y('addTeam'), () => { S.addTeamOpen = true; render(); }));
    const nm = piiCheck(h('input', { type: 'text', maxlength: '60', placeholder: Y('teamNamePh'), 'aria-label': Y('teamName') }));
    const duty = h('input', { type: 'text', maxlength: '160', placeholder: Y('teamDutyPh'), 'aria-label': Y('teamDuty') });
    const go2 = async () => { const id = await addTeam(nm.value, duty.value); if (!id) return; S.addTeamOpen = false; if (after) await after(id); render(); };
    nm.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go2(); } });
    setTimeout(() => nm.focus(), 0);
    return h('div', { class: 'addteam' }, field(Y('teamName'), nm), field(Y('teamDuty'), duty, T('opt')),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', text: Y('addTeamBtn'), onclick: go2 }), lnk(Y('cancelT'), () => { S.addTeamOpen = false; render(); })));
  }
  function toast(msg) { const t = h('div', { class: 'toast', role: 'status', text: msg }); document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
  // ביטול פעולה (04/11/2026: "מה עושים אם רוצים לבטל פעולה? לשנות בחירה? לעדכן?"): לפני כל שינוי בטבלת המעקב שומרים צילום של החלקים,
  // ואחרי השינוי מופיע "↩ ביטול" לעשר שניות, שמחזיר את המצב הקודם (וגם נרשם ברישום השינויים).
  const snap = (kinds) => Object.fromEntries(kinds.map((k) => [k, JSON.parse(JSON.stringify(parts()[k] === undefined ? null : parts()[k]))]));
  function undoToast(msg, before) {
    document.querySelectorAll('.toast.undo').forEach((x) => x.remove());
    const t = h('div', { class: 'toast undo sbe-no-theme', role: 'status' }, h('span', { text: msg + ' ' }),
      h('button', { type: 'button', class: 'undo-btn', text: Y('undoT'), onclick: async () => {
        t.remove();
        for (const [k, v] of Object.entries(before)) S.doc.parts[k] = v;
        for (const k of Object.keys(before)) await save(k, Y('undoneT') + ': ' + msg);
        toast(Y('undoneT')); render();
      } }));
    document.body.appendChild(t); setTimeout(() => t.remove(), 10000);
  }
  const openAct = (a) => a.status !== 'tested' && a.status !== 'cancelled';
  function piiCheck(el) { el.addEventListener('blur', () => { if (P.PII_RX.test(el.value)) toast(T('piiWarn')); }); return el; }
  const parts = () => (S.doc ? S.doc.parts : {});
  const arr = (k) => (Array.isArray(parts()[k]) ? parts()[k] : []);
  const obj = (k) => (parts()[k] && typeof parts()[k] === 'object' && !Array.isArray(parts()[k]) ? parts()[k] : {});

  async function api(action, extra = {}, tries = 4) {
    let res;
    for (let i = 0; ; i++) {
      try {
        res = await fetch(SERVER + '/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token: TOKEN, ...extra }) });
        if (res.status < 500 || i >= tries - 1) break;
      } catch (e) { if (i >= tries - 1) return [0, { error: Y('waking') }]; }
      if (!S.doc && !S.list) app.replaceChildren(h('p', { class: 'muted', text: Y('waking') }));
      await new Promise((r) => setTimeout(r, 8000));
    }
    const data = await res.json().catch(() => ({ error: '' }));
    if (/unknown action/i.test(data.error || '')) return [res.status, { error: Y('serverOld') }];
    return [res.status, data];
  }

  // שמירת חלק (04/11/2026, בדיקת המומחים: "טקסט שהוקלד בו זמנית נמחק"):
  // 1. שמירה אחת בכל פעם לכל חלק (תור), כך ששמירה שנייה יוצאת עם הגרסה החדשה ולא מתנגשת בשמירה שלפניה.
  // 2. כשמישהו אחר עדכן (409): ממזגים. מה ששיניתי נשאר, מה שאחרים שינו נכנס (לפי שדה, ולפי מזהה בפריטים), ושומרים שוב.
  // 3. בלי חיבור: החלק נשאר מסומן "לא נשמר עדיין", ונשמר שוב כשהחיבור חוזר.
  const timers = {}, chains = {}, unsaved = new Set();
  let BASE = {};
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function setDoc(doc) { S.doc = doc; BASE = clone(doc ? doc.parts : {}) || {}; }
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const byId = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => isObj(x) && x.id);
  function merge3(b, l, r) {
    if (same(l, b)) return clone(r);
    if (same(r, b) || same(l, r)) return clone(l);
    if (isObj(l) && isObj(r)) {
      const out = {}, bb = isObj(b) ? b : {};
      for (const k of new Set([...Object.keys(l), ...Object.keys(r), ...Object.keys(bb)])) { const v = merge3(bb[k], l[k], r[k]); if (v !== undefined) out[k] = v; }
      return out;
    }
    if (Array.isArray(l) && Array.isArray(r) && (byId(l) || byId(r))) {
      const bm = new Map((Array.isArray(b) ? b : []).filter(isObj).map((x) => [x.id, x])), lm = new Map(l.filter(isObj).map((x) => [x.id, x])), rm = new Map(r.filter(isObj).map((x) => [x.id, x]));
      const ids = [...r.filter(isObj).map((x) => x.id), ...l.filter((x) => isObj(x) && !rm.has(x.id)).map((x) => x.id)];
      const out = [];
      for (const id of ids) { const v = merge3(bm.get(id), lm.get(id), rm.get(id)); if (v !== undefined) out.push(v); }
      return out;
    }
    if (Array.isArray(l) && Array.isArray(r) && l.length === r.length) return l.map((x, i) => merge3(Array.isArray(b) ? b[i] : undefined, x, r[i]));
    return clone(l);
  }
  function unsavedNote() {
    let el = document.getElementById('rdyUnsaved');
    if (!unsaved.size) { if (el) el.remove(); return; }
    if (!el) { el = h('div', { id: 'rdyUnsaved', class: 'toast unsaved sbe-no-theme', role: 'status' }); document.body.appendChild(el); }
    el.textContent = Y('unsaved');
  }
  async function saveNow(part, what, tries) {
    const sent = clone(S.doc.parts[part]);
    const [st, out] = await api('rdySave', { id: S.doc.id, part, value: sent, rev: S.doc.revs[part] || 0, what: what || '', by: S.by });
    if (st === 200) {
      S.doc.revs[part] = out.rev; S.doc.updatedAt = out.updatedAt; BASE[part] = sent;
      if (what) S.doc.log.push({ at: out.updatedAt, by: S.by || '', part, what });
      unsaved.delete(part); unsavedNote(); return true;
    }
    if (st === 409 && out.doc) {
      // מיזוג: כל החלקים (גם כאלה שעוד מחכים לשמירה), ואז שמירה חוזרת של החלק הזה עם הגרסה החדשה
      const local = S.doc.parts, srv = out.doc.parts || {};
      const merged = {};
      for (const k of new Set([...Object.keys(local), ...Object.keys(srv)])) { const v = merge3(BASE[k], local[k], srv[k]); if (v !== undefined) merged[k] = v; }
      BASE = clone(srv) || {};
      S.doc = Object.assign({}, out.doc, { parts: merged });
      if (tries < 3 && !same(merged[part], srv[part])) return saveNow(part, what, tries + 1);
      render(); return true;
    }
    if (st === 0 || st >= 500) { unsaved.add(part); unsavedNote(); return false; }
    toast(out.error || 'לא נשמר'); return false;
  }
  function save(part, what) {
    clearTimeout(timers[part]); delete timers[part];
    const run = (chains[part] || Promise.resolve()).catch(() => {}).then(() => saveNow(part, what, 0));
    chains[part] = run;
    return run;
  }
  const retryUnsaved = () => { for (const p of [...unsaved]) save(p, ''); };
  window.addEventListener('online', retryUnsaved);
  setInterval(() => { if (unsaved.size && navigator.onLine !== false) retryUnsaved(); }, 20000);
  function saveSoon(part, what) { clearTimeout(timers[part]); timers[part] = setTimeout(() => save(part, what), 900); }
  function setPart(part, value, what, soon) { S.doc.parts[part] = value; return soon ? saveSoon(part, what) : save(part, what); }

  function bindText(el, get, set, part, what) {
    el.value = get() || '';
    el.addEventListener('input', () => { set(el.value); saveSoon(part, what); });
    return piiCheck(el);
  }
  const field = (label, el, hint) => h('div', {}, h('label', { class: 'f' }, label, hint ? h('small', {}, ' (' + hint + ')') : null), el);

  function makeTimer(sec) {
    let left = sec, iv = null;
    const out = h('span', { class: 'timer', 'aria-live': 'off' });
    const show = () => { out.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'); };
    const go = h('button', { class: 'btn sm', type: 'button', text: T('start'), onclick: () => {
      if (iv) { clearInterval(iv); iv = null; go.textContent = T('start'); return; }
      go.textContent = T('stop'); iv = setInterval(() => { left = Math.max(0, left - 1); show(); if (!left) { clearInterval(iv); iv = null; go.textContent = T('start'); } }, 1000);
    } });
    const rs = h('button', { class: 'btn ghost sm', type: 'button', text: T('reset'), onclick: () => { left = sec; show(); } });
    show();
    return h('span', { class: 'row noprint' }, h('span', { class: 'muted', text: T('timer') + ':' }), out, go, rs);
  }

  // ---------- ראשי ----------
  function setLang(lang) {
    S.lang = lang; LS.set('sbe.prep.lang', lang); L = P.content(lang);
    document.documentElement.lang = lang;
    document.getElementById('title').textContent = T('tool');
    document.getElementById('subtitle').textContent = T('sub');
    render();
  }

  async function start() {
    if (ORGSP) { document.getElementById('subtitle').textContent = T('sub'); }
    if (DEMO) { app.replaceChildren(h('p', { class: 'muted', text: '…' })); return; }
    if (S.lang === 'ar') { document.documentElement.lang = 'ar'; document.getElementById('title').textContent = T('tool'); document.getElementById('subtitle').textContent = T('sub'); }
    if (!TOKEN) { app.replaceChildren(h('div', { class: 'card', text: Y('login') })); return; }
    const [st, out] = await api('rdyMine');
    if (st !== 200) { app.replaceChildren(h('div', { class: 'warn', text: out.error || '' })); return; }
    S.list = out.items;
    const last = LS.get('sbe.prep.last', '');
    const want = new URLSearchParams(location.search).get('id') || last;
    if (want && S.list.some((x) => x.id === want)) return openDoc(want);
    // בית ספר: מערך אחד, נפתח ישר. רשימה רק למנהלת המערכת.
    if (S.list.length && (!SYS || S.list.length === 1)) return openDoc(S.list[0].id);
    render();
  }
  async function openDoc(id) {
    const [st, out] = await api('rdyGet', { id });
    if (st !== 200) { toast(out.error || ''); setDoc(null); render(); return; }
    setDoc(out.doc); LS.set('sbe.prep.last', id);
    S.view = LS.get('sbe.prep.view.' + id, 'home') || 'home';
    const q = new URLSearchParams(location.search);
    if (/^(home|plan|track|index|gen|s[1-5])$/.test(q.get('view') || '')) S.view = q.get('view');
    if (/^(tasks|decisions|ends|gaps|done)$/.test(q.get('sheet') || '')) S.sheet = q.get('sheet');
    if (S.view.startsWith('mt:') && !arr('meetings').some((m) => 'mt:' + m.id === S.view)) S.view = 'home';
    if (q.get('print') === 'binder') setTimeout(printBinder, 600);
    const ex = arr('exercises'); S.exId = ex.length ? ex[ex.length - 1].id : '';
    render();
  }
  function go(view, sheet) {
    S.view = view; if (sheet) S.sheet = sheet; S.menu = false;
    if (S.doc) LS.set('sbe.prep.view.' + S.doc.id, view);
    render(); window.scrollTo(0, 0);
  }
  // לשוניות בתוך מסך, במקום גלילה ארוכה
  function tabs(key, list, def) {
    const cur = Math.max(0, Math.min(S.tab[key] == null ? (def || 0) : S.tab[key], list.length - 1));
    const base = 'rt-' + String(key).replace(/[^a-z0-9]/gi, '');
    const bar = h('div', { class: 'tabs noprint sbe-no-theme', role: 'tablist' }, list.map(([label], i) => h('button', { type: 'button', role: 'tab', id: base + '-t' + i, 'aria-controls': base + '-p', tabindex: i === cur ? '0' : '-1', 'aria-selected': i === cur ? 'true' : 'false', text: label,
      onclick: () => { S.tab[key] = i; render(); } })));
    tabKeys(bar, (j) => { S.tab[key] = j; render(); });
    return h('div', {}, bar, h('div', { role: 'tabpanel', id: base + '-p', 'aria-labelledby': base + '-t' + cur }, list[cur][1]()));
  }
  const typeName = (k) => ((L.MEET_TYPES.find((t) => t.k === k) || L.MEET_TYPES[L.MEET_TYPES.length - 1]).name);
  const isMeetingView = () => /^s[1-5]$/.test(S.view) || S.view.startsWith('mt:') || S.view === 'new';
  function trackCount() {
    const acts = arr('actions').filter((a) => P.sheetOf('actions', a) === 'tasks').length;
    const ends = arr('ends').filter((e) => P.sheetOf('ends', e) === 'ends').length;
    const ist = P.ideasState(arr('ideas'));
    const late = arr('exercises').some((ex) => P.ideasState(arr('ideas'), ex).late);
    return { open: acts + ends + ist.open, alert: !!P.stats(S.doc).escalate || late };
  }

  // נגישות (בדיקת המומחים, 04/11/2026): אחרי כל לחיצה המסך נבנה מחדש, והמיקוד חוזר לפריט שנלחץ (לשונית, מילה בסרגל),
  // ואם הוא כבר לא קיים: לכותרת המסך. כך מקלדת וקורא מסך לא קופצים לראש הדף.
  function focusKey() {
    const a = document.activeElement;
    if (!a || !app.contains(a) || !/^(A|BUTTON|SELECT|SUMMARY)$/.test(a.tagName)) return null;
    return { tag: a.tagName, role: a.getAttribute('role') || '', text: (a.textContent || '').trim(), al: a.getAttribute('aria-label') || '' };
  }
  function restoreFocus(fk) {
    if (S.focusText) { const t = S.focusText; S.focusText = ''; const el = [...app.querySelectorAll('[role=tab],[role=menuitem]')].find((e) => (e.textContent || '').trim() === t); if (el) { el.focus({ preventScroll: true }); return; } }
    if (!fk) return;
    const el = [...app.querySelectorAll(fk.tag)].find((e) => (e.getAttribute('role') || '') === fk.role && (e.textContent || '').trim() === fk.text && (e.getAttribute('aria-label') || '') === fk.al);
    if (el) { el.focus({ preventScroll: true }); return; }
    const hd = app.querySelector('.navrow ~ * h2, .navrow ~ h2'); if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); }
  }
  // חצים בשורת לשוניות (מימין לשמאל: שמאלה = הבאה)
  function tabKeys(bar, pick) {
    bar.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const tabsEls = [...bar.querySelectorAll('[role=tab]')]; const i = tabsEls.indexOf(document.activeElement); if (i < 0) return;
      const rtl = getComputedStyle(bar).direction === 'rtl';
      let j = e.key === 'Home' ? 0 : e.key === 'End' ? tabsEls.length - 1 : i + ((e.key === 'ArrowLeft') === rtl ? 1 : -1);
      j = (j + tabsEls.length) % tabsEls.length; e.preventDefault(); S.focusText = (tabsEls[j].textContent || '').trim(); pick(j);
    });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.menu) { S.menu = false; S.focusText = ''; render(); const t = app.querySelector('[aria-haspopup]'); if (t) t.focus(); } });
  function render() {
    if (!S.doc) return renderList();
    const fk = focusKey();
    // שורה אחת: שם בית הספר, מי אני, שפה. במילים, לא בכפתורים.
    const me = h('details', { class: 'me' }, h('summary', { text: '👤 ' + (S.by || Y('whoAmI')) }),
      piiCheck(h('input', { type: 'text', value: S.by, 'aria-label': T('by'), placeholder: Y('byName'), oninput: (e) => { S.by = e.target.value.slice(0, 60); LS.set('sbe.prep.by', S.by); } })));
    const head = h('div', { class: 'headrow noprint' }, h('b', { text: parts().profile?.name || '' }), me,
      lnk(T('lang2'), () => setLang(S.lang === 'ar' ? 'he' : 'ar')),
      SYS ? lnk(Y('ours2'), () => { setDoc(null); LS.set('sbe.prep.last', ''); render(); }) : null);
    const cnt = trackCount();
    const navLnk = (view, label, extra) => lnk([label, extra || null].filter(Boolean), () => go(view), { 'aria-current': S.view === view ? 'page' : null });
    // הסרגל: מילים בשורה אחת שנגללת לרוחב בטלפון. כל יעד מופיע בו פעם אחת.
    const nav = h('nav', { class: 'navrow noprint', 'aria-label': T('tool') },
      navLnk('home', T('steps')[0]),
      navLnk('plan', T('steps')[1]),
      lnk(Y('meetings').replace('📅 ', '') + ' ▾', () => { S.menu = !S.menu; render(); }, { 'aria-haspopup': 'true', 'aria-expanded': S.menu ? 'true' : 'false', 'aria-current': isMeetingView() ? 'page' : null }),
      navLnk('track', Y('trackT'), h('span', { class: 'cnt' + (cnt.alert ? ' red' : ''), text: String(cnt.open) })),
      navLnk('index', Y('index').replace('📊 ', '')),
      navLnk('gen', Y('routineStep').replace('🎲 ', '')));
    const v = S.view;
    const body = v === 'plan' ? viewPlan() : /^s[1-5]$/.test(v) ? viewMeeting('s', Number(v[1])) : v.startsWith('mt:') ? viewMeeting('m', v.slice(3)) : v === 'new' ? viewNewMeeting()
      : v === 'gen' ? viewRoutine() : v === 'index' ? viewIndex() : v === 'track' ? viewTrack(false) : v === 'partners' ? viewPartners() : viewHome();
    app.replaceChildren(head, nav, S.menu ? meetingsMenu() : '', body);
    if (S.menu && fk && fk.text.includes('▾')) { const first = app.querySelector('.menu [role=menuitem]'); if (first) first.focus({ preventScroll: true }); } else restoreFocus(fk);
    const more = (el) => el && el.classList.toggle('more', el.scrollWidth > el.clientWidth + 4);
    more(nav); app.querySelectorAll('.tabs').forEach(more);
    const cur = nav.querySelector('[aria-current]'); if (cur && cur.scrollIntoView && nav.scrollWidth > nav.clientWidth) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  // הרשימה הנפתחת של המפגשים: חמשת המפגשים, הפגישות שתוכננו, ותכנון פגישה חדשה
  function meetingsMenu() {
    const sessions = obj('sessions');
    const mts = arr('meetings').slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    const item = (view, label, sub) => h('li', {}, lnk(label, () => go(view), { role: 'menuitem', 'aria-current': S.view === view ? 'page' : null }), sub ? h('small', { class: 'muted', text: '  ' + sub }) : null);
    return h('div', { class: 'menu', role: 'menu', onclick: (e) => e.stopPropagation() },
      h('ul', {}, h('li', {}, lnk(Y('newMeeting'), () => { S.newPre = null; go('new'); }, { class: 'lnk strong', role: 'menuitem' }))),
      h('div', { class: 'mh', text: Y('fixedSessions') }),
      h('ul', {}, L.SESSIONS.map((s) => item('s' + s.n, s.n + '. ' + s.title, sessions[s.n] && sessions[s.n].done ? '✓ ' + dateIL(sessions[s.n].at) : ''))),
      h('div', { class: 'mh', text: Y('ourMeetings') }),
      mts.length ? h('ul', {}, mts.map((m) => item('mt:' + m.id, m.title || typeName(m.type), dateIL(m.date) + (m.done ? ' ✓' : '')))) : h('p', { class: 'muted', text: Y('noMeetings') }));
  }
  document.addEventListener('click', () => { if (S.menu) { S.menu = false; render(); } });

  function renderList() {
    const list = h('div', { class: 'card' }, h('h2', { text: Y('ours') }),
      (S.list || []).length ? h('ul', { class: 'list' }, S.list.map((x) => h('li', {}, h('button', { class: 'btn ghost sm', type: 'button', text: x.name, onclick: () => openDoc(x.id) }),
        ' ', h('span', { class: 'muted', text: Y('updated') + ' ' + dateIL(x.updatedAt) + ' · ' + x.sessionsDone + '/5 · ' + T('ends') + ': ' + x.openEnds })))) : h('p', { class: 'muted', text: Y('none') }));
    const f = { name: h('input', { type: 'text', required: true }), levels: h('input', { type: 'text', placeholder: ORGSP ? P.words('למשל: א׳ עד ו׳') : 'למשל: א׳ עד ו׳' }),
      lang: h('select', { 'data-closed': '' }, ['he', 'ar', 'both'].map((v) => h('option', { value: v, text: T(v) }))),
      size: h('select', { 'data-closed': '' }, h('option', { value: 'big', text: T('big') }), h('option', { value: 'small', text: T('small') })) };
    if (S.lang === 'ar') f.lang.value = 'ar';
    const go2 = h('button', { class: 'btn', type: 'button', text: T('open'), onclick: async () => {
      if (!f.name.value.trim()) { f.name.focus(); toast(T('name') + ': ' + T('main')); return; }
      go2.disabled = true;
      const [st, out] = await api('rdyCreate', { by: S.by, profile: { name: f.name.value.trim(), levels: f.levels.value.trim(), lang: f.lang.value, size: f.size.value } });
      go2.disabled = false;
      if (st === 409 && out.id) { toast(out.error || ''); return openDoc(out.id); }
      if (st !== 201) { toast(out.error || ''); return; }
      setDoc(out.doc); S.view = 'home';
      // הצוותים וההגדרה של מנהל/ת מצב החירום מהמתווה, כנקודת התחלה שהצוות משנה. רשימת המשימות נשארת ריקה: הצוות כותב קודם.
      S.doc.parts.teams = L.TEAMS.map((t) => ({ id: t.id, name: t.name, lead: { name: '', email: '' }, deputy: { name: '', email: '' }, members: [] }));
      await save('teams', 'פתיחת טבלת הצוותים');
      S.doc.parts.em = { does: L.EM.does.slice(), doesnt: L.EM.doesnt.slice() };
      await save('em', '');
      LS.set('sbe.prep.last', S.doc.id);
      render();
    } });
    const form = h('div', { class: 'card' }, h('h2', { text: T('newProgram') }),
      field(T('name'), piiCheck(f.name), T('main')), field(T('levels'), f.levels, T('opt')), h('div', { class: 'row' }, h('div', { class: 'grow' }, field(T('lang'), f.lang)), h('div', { class: 'grow' }, field(T('size'), f.size))),
      h('p', { class: 'muted', text: Y('exportNote') }), go2);
    // בית ספר בלי מערך רואה רק את הפתיחה; מנהלת המערכת רואה גם את הרשימה
    app.replaceChildren(SYS ? list : '', form);
  }

  // ---------- 🏠 מערך המוכנות: מבט אחד ----------
  function nextUp() {
    const sessions = obj('sessions'), today = new Date().toISOString().slice(0, 10);
    const fixed = L.SESSIONS.find((s) => !(sessions[s.n] && sessions[s.n].done));
    const mt = arr('meetings').filter((m) => !m.done && String(m.date || '') >= today).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
    const out = [];
    for (const m of arr('meetings').filter((m) => !m.done && m.date && String(m.date) < today).slice(-3)) out.push({ view: 'mt:' + m.id, label: (m.title || typeName(m.type)) + ' · ' + dateIL(m.date), sub: Y('notSummed') });
    const dated = new Set(arr('meetings').map((m) => m.date));
    const last = arr('meetings').filter((m) => m.next && m.next >= today && !dated.has(m.next)).slice(-1)[0];
    if (last) out.push({ view: 'new', label: Y('nextSet') + ' ' + dateIL(last.next), sub: Y('newMeeting'), pre: { date: last.next, type: last.type, teams: last.teams, from: last.title } });
    if (mt) out.push({ view: 'mt:' + mt.id, label: (mt.title || typeName(mt.type)) + ' · ' + dateIL(mt.date) + (mt.time ? ' ' + mt.time : ''), sub: '' });
    if (fixed) out.push({ view: 's' + fixed.n, label: fixed.n + '. ' + fixed.title, sub: Y('before') + ': ' + fixed.before });
    return out;
  }
  function viewHome() {
    const st = P.stats(S.doc), sessions = obj('sessions'), cnt = trackCount();
    const esc = st.escalate ? h('div', { class: 'warn' }, h('b', { text: Y('escalate') + ': ' + st.escalate + ' ' }), lnk(T('ends'), () => go('track', 'ends'))) : null;
    const dm = obj('decmap');
    const dmWarn = (dm.intent || dm.rows) && P.decmapDue(dm) ? h('div', { class: 'sunny' }, h('b', { text: Y('decmapT') + ': ' }), dm.approvedAuth && dm.approvedSup ? L.APPROVE.due : Y('decmapNotApproved'), ' ',
      lnk(Y('decmapT'), () => { S.tab.plan = 2; go('plan'); })) : null;
    const ist = P.ideasState(arr('ideas'));
    const ideaWarn = ist.open ? h('div', { class: cnt.alert ? 'warn' : 'sunny' }, h('b', { text: Y('ideasT') + ': ' }), ist.open + ' ' + Y('ideasOpen'), ' ',
      lnk(L.SHEETS.decisions, () => go('track', 'decisions'))) : null;
    const nexts = nextUp();
    // מה הלאה: המפגש הבא, במילה שנפתחת. בלי אריחים שחוזרים על הסרגל.
    const nextCard = nexts.length ? h('div', { class: 'card' }, h('h2', { text: T('next1') }), h('ul', { class: 'list' }, nexts.map((x) => h('li', {},
      lnk(x.label, () => { if (x.pre) S.newPre = x.pre; go(x.view); }, { class: 'lnk strong' }), x.sub ? h('div', { class: 'muted small', text: x.sub }) : null)))) : null;
    return h('div', {}, esc, dmWarn, ideaWarn, nextCard, routineCard(), h('p', { class: 'small' }, lnk(Y('binder'), printBinder), !window.sbeCanOpen || window.sbeCanOpen('continuity-kit.html') ? [' · ', h('a', { class: 'lnk', href: 'continuity-kit.html#binder', text: Y('bFiles') })] : null), h('p', { class: 'muted small', text: L.TABLETOP_NOTE }));
  }
  // 📊 מדד המוכנות: שלושת העמודים, ומה הצוות כבר עושה בעצמו
  function viewIndex() {
    const st = P.stats(S.doc), ind = P.independence(S.doc);
    const val = { rel: [String(st.rel.partners), st.rel.withDeputy + ' / ' + st.rel.teams], info: [st.info.actionsDone + ' / ' + st.info.actions, String(st.info.logs)], inst: [st.inst.staffed + ' / ' + st.inst.teams, String(st.inst.exercises)] };
    const rows = [];
    for (const p of L.PILLARS) L.INDEX_HOW[p.k].forEach((how, i) => rows.push(h('tr', {}, i === 0 ? h('th', { rowspan: '2', 'data-h': L.INDEX_COLS[0] }, h('b', { text: p.name }), h('div', { class: 'muted small', text: p.what })) : null,
      h('td', { 'data-h': L.INDEX_COLS[1], text: how }), h('td', { class: 'n', 'data-h': L.INDEX_COLS[2], text: val[p.k][i] }))));
    return h('div', {}, h('div', { class: 'card' }, h('h2', { text: T('pillars') }), h('p', { class: 'muted small', text: L.INDEX_INFO }),
      h('table', { class: 'rt idx' }, h('thead', {}, h('tr', {}, L.INDEX_COLS.map((c) => h('th', { text: c })))), h('tbody', {}, rows)),
      h('h3', { text: Y('indexInd') }),
      h('table', { class: 'rt idx' }, h('tbody', {}, L.INDEPENDENCE.map((x) => h('tr', {}, h('td', { text: x.name }), h('td', { class: 'n', text: String(ind[x.k] || 0) })))))));
  }
  function routineCard() {
    return h('div', { class: 'card' }, h('h2', { text: T('routine') }), h('p', { text: String(L.ROUTINE).replace(/^[^:：]{2,30}[:：]\s*/, '') }),
      h('p', { class: 'links' }, L.ROUTINE_LINKS.filter(([f]) => !window.sbeCanOpen || window.sbeCanOpen(f)).map(([f, label]) => h('a', { class: 'lnk', href: f, text: label }))));
  }
  function viewPartners() {
    const list = arr('partners');
    const rows = list.map((p, i) => {
      const inp = (k) => bindText(h('input', { type: 'text' }), () => p[k], (v) => { p[k] = v; }, 'partners', 'שותפים');
      const gap = (!String(p.expect || '').trim() || !String(p.provide || '').trim()) && String(p.name || '').trim();
      return h('tr', {}, h('td', { 'data-h': Y('partner') }, inp('name')), h('td', { 'data-h': Y('expect') }, inp('expect')), h('td', { 'data-h': Y('provide') }, inp('provide')),
        h('td', {}, gap ? h('span', { class: 'pill red', text: Y('ifGap') }) : null, h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { list.splice(i, 1); setPart('partners', list, 'שותפים'); render(); } })));
    });
    return h('div', { class: 'card' }, h('h2', { text: Y('partners') }),
      h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [Y('partner'), Y('expect'), Y('provide'), ''].map((x) => h('th', { text: x })))), h('tbody', {}, rows)),
      h('button', { class: 'btn ghost sm', type: 'button', text: T('add'), onclick: () => { list.push({ id: uid('pt'), name: '', expect: '', provide: '' }); setPart('partners', list, ''); render(); } }));
  }

  // ---------- ✍️ התוכנית ----------
  // התוכנית והנספחים: נוצרים בפעם הראשונה מכל מסך שצריך אותם (התוכנית, מפגש 4, המחולל)
  function planObj() {
    const plan = obj('plan'); plan.steps = plan.steps || {}; plan.fb = plan.fb || {};
    if (!Array.isArray(plan.annexes) || !plan.annexes.length) plan.annexes = L.ANNEXES.map((a) => ({ id: a.id, name: a.name, team: a.team, maturity: -1, text: '' }));
    S.doc.parts.plan = plan; return plan;
  }
  function viewPlan() {
    const plan = planObj();
    const steps = L.REMS.map((r) => {
      const ta = bindText(h('textarea', { rows: 4 }), () => plan.steps[r.n], (v) => { plan.steps[r.n] = v; }, 'plan', 'התוכנית: ' + r.title);
      const out = h('div', {});
      const fb = plan.fb[r.n]; if (fb) out.appendChild(fbView(fb));
      const ask = h('button', { class: 'btn ghost sm', type: 'button', text: Y('ask'), onclick: async () => {
        if (String(ta.value).trim().length < 30) { toast(T('feedbackAfter')); return; }
        ask.disabled = true; out.replaceChildren(h('p', { class: 'muted', text: Y('working') }));
        try {
          const srcs = (window.SBE_ADVISOR_SOURCES ? window.SBE_ADVISOR_SOURCES.forAdvisor('readiness') : []).map((s) => s.k + ': ' + String(s.gist || '').slice(0, 160)).join('\n');
          const content = 'שלב ' + r.n + ': ' + r.title + '\nמה עושים בשלב: ' + r.do + '\nהשאלות: ' + r.q.join(' ') + '\n\nמה הצוות כתב:\n' + ta.value + '\n\nמקורות אפשריים:\n' + srcs;
          const v = await window.sbeCallAIJson(SERVER, { system: P.planSystem(S.lang), messages: [{ role: 'user', content }], maxTokens: 4000 }, 180000, P.validPlan);
          plan.fb[r.n] = v; await save('plan', ''); out.replaceChildren(fbView(v));
        } catch (e) { out.replaceChildren(h('div', { class: 'warn', text: T('noModel') })); }
        ask.disabled = false;
      } });
      return h('details', { class: 'card', open: !plan.steps[r.n] && r.n === firstEmpty(plan) },
        h('summary', { text: r.n + '. ' + r.title + (plan.steps[r.n] ? ' ✓' : '') }),
        h('p', { text: r.do }), h('p', { class: 'muted', text: Y('product') + ': ' + r.product }),
        h('b', { text: Y('questions') }), h('ul', { class: 'list' }, r.q.map((q) => h('li', { text: q }))),
        field(Y('ourText'), ta), h('div', { class: 'row noprint' }, ask, h('span', { class: 'muted', text: T('feedbackAfter') })), out);
    });
    const annex = h('div', { class: 'card' }, h('h2', { text: T('annexes') }),
      h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('annexes'), T('team'), T('maturity'), Y('annexText')].map((x) => h('th', { text: x })))),
        h('tbody', {}, plan.annexes.map((a) => {
          const base = L.ANNEXES.find((x) => x.id === a.id) || {};
          const sel = h('select', { 'data-closed': '', 'aria-label': T('maturity') }, h('option', { value: '-1', text: '…' }), L.MATURITY.map((m, i) => h('option', { value: String(i), text: m })));
          sel.value = String(a.maturity == null ? -1 : a.maturity);
          sel.addEventListener('change', () => { a.maturity = Number(sel.value); a.updatedAt = nowIso(); a.by = S.by; save('plan', 'נספח ' + a.name + ': ' + (L.MATURITY[a.maturity] || '')); });
          const ta = bindText(h('textarea', { rows: 2, placeholder: base.q || '' }), () => a.text, (v) => { a.text = v; a.updatedAt = nowIso(); a.by = S.by; }, 'plan', 'נספח ' + a.name);
          return h('tr', {}, h('td', { 'data-h': T('annexes') }, h('b', { text: base.name || a.name }), a.id === 'cont' ? h('div', {}, h('a', { href: 'continuity-kit.html', target: '_blank', rel: 'noopener', text: Y('contKit') })) : null), h('td', { 'data-h': T('team'), text: teamName(a.team) }), h('td', { 'data-h': T('maturity') }, sel), h('td', { 'data-h': Y('annexText') }, ta));
        }))));
    const pm = bindText(h('textarea', { rows: 3 }), () => plan.premortem, (v) => { plan.premortem = v; }, 'plan', 'תחקיר מקדים');
    return h('div', {}, tabs('plan', [[Y('remsT'), () => h('div', {}, h('div', { class: 'note', text: L.TABLETOP_NOTE }), steps)], [T('annexes'), () => annex], [Y('decmapT'), viewDecmap],
      [Y('partnersT'), viewPartners], [T('premortem'), () => h('div', { class: 'card' }, h('h2', { text: T('premortem') }), h('p', { text: L.REMS[4].q[1] }), pm)]]),
      h('div', { class: 'row noprint' }, h('button', { class: 'btn ghost', type: 'button', text: Y('printPlan'), onclick: printPlan })));
  }
  const firstEmpty = (plan) => (L.REMS.find((r) => !plan.steps[r.n]) || L.REMS[0]).n;
  function fbView(v) {
    const box = h('div', { class: 'sunny' });
    if ((v.gaps || []).length) box.append(h('b', { text: Y('gaps') }), h('ul', { class: 'list' }, v.gaps.map((g) => h('li', {}, g.text + (g.why ? ' · ' + g.why : '') + ' ',
      h('button', { class: 'btn ghost sm noprint', type: 'button', text: Y('addGap'), onclick: () => addGap(g.text, 'plan') })))));
    if ((v.alternatives || []).length) box.append(h('b', { text: Y('alts') }), h('table', { class: 'rt' }, h('thead', {}, h('tr', {}, [T('alt'), T('allows'), T('gives'), Y('src')].map((x) => h('th', { text: x })))),
      h('tbody', {}, v.alternatives.map((a) => h('tr', {}, h('td', { text: a.text || '' }), h('td', { text: a.allows || '' }), h('td', { text: a.gives || '' }), h('td', { text: srcLabel(a.source) }))))));
    if ((v.next || []).length) box.append(h('b', { text: Y('nextSteps') }), h('ul', { class: 'list' }, v.next.map((x) => h('li', { text: x }))));
    return box;
  }
  function srcLabel(k) {
    const s = k && window.SBE_ADVISOR_SOURCES && window.SBE_ADVISOR_SOURCES.byKey[k];
    return s ? String(s.apa || k).split('. (')[0] + ' (' + (String(s.apa).match(/\((\d{4})/) || [, ''])[1] + ')' : '';
  }
  function addGap(text, src, team) {
    const aid = uid('a');
    const gaps = arr('gaps'); gaps.push({ id: uid('g'), text, src: src || '', team: team || '', at: nowIso(), actionId: aid }); S.doc.parts.gaps = gaps; save('gaps', Y('gapT') + ': ' + String(text).slice(0, 80));
    const acts = arr('actions'); acts.push({ id: aid, text, team: team || '', owner: fallbackOwner(team), due: plus(14), status: 'todo', src: src || '' }); S.doc.parts.actions = acts; save('actions', '');
    toast(Y('addGap') + ' ✓');
  }

  // ---------- 👥 מפגש 1 ----------
  function sessionHead(n) {
    const s = L.SESSIONS[n - 1], done = obj('sessions')[n];
    return h('div', { class: 'mhead' }, h('h2', {}, n + '. ' + s.title, done && done.done ? ' ✓' : ''),
      h('details', { class: 'small' }, h('summary', { text: Y('before') + ' · ' + Y('during') + ' · ' + Y('product') }),
        h('table', { class: 'rt' }, h('tbody', {}, h('tr', {}, h('th', { text: Y('before') }), h('td', { text: s.before })), h('tr', {}, h('th', { text: Y('during') }), h('td', { text: s.during })), h('tr', {}, h('th', { text: Y('product') }), h('td', { text: s.product }))))));
  }
  function viewS1() {
    const tasks = arr('tasks'); S.doc.parts.tasks = tasks;
    const teamSel = (val, on) => { const s = h('select', { 'data-closed': '' }, [...allTeams().map((t) => h('option', { value: t.id, text: t.name })), h('option', { value: 'all', text: Y('allTeams') })]); s.value = val || 'mgmt'; s.addEventListener('change', () => on(s.value)); return s; };
    const whenSel = (val, on) => { const s = h('select', { 'data-closed': '' }, Object.entries(L.WHEN).map(([k, v]) => h('option', { value: k, text: v }))); s.value = val || 'before'; s.addEventListener('change', () => on(s.value)); return s; };
    const own = h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('text'), Y('when'), T('team'), ''].map((x) => h('th', { text: x })))),
      h('tbody', {}, tasks.map((tk, i) => h('tr', {},
        h('td', { 'data-h': T('text') }, bindText(h('input', { type: 'text' }), () => tk.text, (v) => { tk.text = v; }, 'tasks', 'רשימת המשימות')),
        h('td', { 'data-h': Y('when') }, whenSel(tk.when, (v) => { tk.when = v; save('tasks', ''); })),
        h('td', { 'data-h': T('team') }, teamSel(tk.team, (v) => { tk.team = v; save('tasks', ''); })),
        h('td', {}, h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { tasks.splice(i, 1); save('tasks', ''); render(); } }))))));
    const addTask = h('button', { class: 'btn ghost sm', type: 'button', text: T('add'), onclick: () => { tasks.push({ id: uid('t'), text: '', when: 'before', team: 'mgmt', own: true }); save('tasks', ''); render(); } });
    const ownCount = tasks.filter((t) => t.own && String(t.text).trim()).length;
    const ref = h('details', { class: 'card' }, h('summary', { text: T('showRef') }),
      ownCount < 3 ? h('p', { class: 'muted', text: T('ownFirst') }) :
        h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('text'), Y('when'), T('team'), ''].map((x) => h('th', { text: x })))),
          h('tbody', {}, L.TASKS.map((m) => { const has = tasks.some((t) => t.ref === m.id); return h('tr', {}, h('td', { 'data-h': T('text'), text: m.text }), h('td', { 'data-h': Y('when'), text: L.WHEN[m.when] }), h('td', { 'data-h': T('team'), text: teamName(m.team) }),
            h('td', {}, has ? h('span', { class: 'pill green', text: '✓' }) : h('button', { class: 'btn ghost sm', type: 'button', text: T('take'), onclick: () => { tasks.push({ id: uid('t'), ref: m.id, text: m.text, when: m.when, team: m.team }); save('tasks', 'משימה מהמתווה: ' + m.text.slice(0, 60)); render(); } }))); }))));
    return h('div', {}, tabs('s1', [
      [T('mine'), () => h('div', {}, h('div', { class: 'card' }, h('h2', { text: T('mine') }), h('p', { class: 'muted', text: T('ownFirst') }), own, addTask), ref)],
      [Y('teamsT'), viewTeams], [L.TEAMS[0].lead.split(',')[0], viewEM]]),
      h('div', { class: 'row noprint' }, h('button', { class: 'btn ghost', type: 'button', text: Y('printTeams'), onclick: printTeams })));
  }
  function viewTeams() {
    const teams = arr('teams'); S.doc.parts.teams = teams;
    const person = (o, k, label) => h('div', { class: 'row' },
      h('div', { class: 'grow' }, bindText(h('input', { type: 'text', placeholder: label + ' · ' + T('fullName'), 'aria-label': label }), () => o[k] && o[k].name, (v) => { o[k] = o[k] || {}; o[k].name = v; }, 'teams', 'טבלת הצוותים')),
      h('div', { class: 'grow' }, bindText(h('input', { type: 'email', placeholder: T('email'), 'aria-label': label + ' ' + T('email') }), () => o[k] && o[k].email, (v) => { o[k] = o[k] || {}; o[k].email = v; }, 'teams', '')));
    const cards = teams.map((t) => {
      const base = L.TEAMS.find((x) => x.id === t.id) || {};
      const n = 1 + (t.deputy && t.deputy.name ? 1 : 0) + (t.members || []).filter((m) => m.name).length;
      const warns = [];
      if (!(t.deputy && t.deputy.name)) warns.push(T('noDeputy'));
      if (n > 8) warns.push(T('tooMany'));
      if (t.id !== 'educators' && n < 3) warns.push(T('tooFew'));
      t.members = t.members || [];
      return h('div', { class: 'teamcard' }, h('b', { text: base.name || t.name }), t.custom ? h('span', { class: 'pill', text: Y('teamOurs') }) : null, h('div', { class: 'muted', text: base.duty || t.duty || '' }),
        base.lead ? h('div', { class: 'muted', text: T('lead') + ': ' + base.lead }) : null,
        person(t, 'lead', T('lead')), person(t, 'deputy', T('deputy')),
        h('div', { class: 'muted', text: T('members') }),
        t.members.map((m, i) => h('div', { class: 'row' }, h('div', { class: 'grow' }, person(t.members, i, T('fullName'))),
          h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { t.members.splice(i, 1); save('teams', ''); render(); } }))),
        h('button', { class: 'btn ghost sm', type: 'button', text: Y('addMember'), onclick: () => { t.members.push({ name: '', email: '' }); save('teams', ''); render(); } }),
        warns.length ? h('div', { class: 'row' }, warns.map((w) => h('span', { class: 'pill red', text: w }))) : null,
        t.custom ? h('p', { class: 'small' }, lnk(Y('teamDel'), () => { if (!confirm(Y('teamDelQ'))) return; S.doc.parts.teams = teams.filter((x) => x !== t); save('teams', 'הסרת צוות: ' + t.name); render(); })) : null);
    });
    return h('div', { class: 'card' }, h('h2', { text: Y('teamsT') }), h('ul', { class: 'list muted' }, L.TEAM_NOTES.map((x) => h('li', { text: x }))), cards, addTeamRow());
  }
  function viewEM() {
    const em = obj('em'); em.does = em.does || L.EM.does.slice(); em.doesnt = em.doesnt || L.EM.doesnt.slice(); S.doc.parts.em = em;
    const list = (key) => h('div', { class: 'grow' }, h('h3', { text: key === 'does' ? T('emDoes') : T('emDoesnt') }),
      em[key].map((x, i) => h('div', { class: 'row' }, h('div', { class: 'grow' }, bindText(h('input', { type: 'text' }), () => em[key][i], (v) => { em[key][i] = v; }, 'em', 'מנהל/ת מצב החירום')),
        h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { em[key].splice(i, 1); save('em', ''); render(); } }))),
      h('button', { class: 'btn ghost sm', type: 'button', text: T('add'), onclick: () => { em[key].push(''); render(); } }));
    return h('div', { class: 'card' }, h('h2', { text: L.TEAMS[0].lead.split(',')[0] }), h('div', { class: 'row', style: 'align-items:flex-start' }, list('does'), list('doesnt')));
  }

  // ---------- 🗺 מפגש 2 ----------
  function viewS2() {
    const mp = obj('mapping'); S.doc.parts.mapping = mp;
    const cards = allTeams().map((t) => {
      const m = mp[t.id] = mp[t.id] || { checks: {}, report: [] };
      const checks = L.MAPPING[t.id] || [];
      const rows = checks.map((c, i) => {
        const sel = h('select', { 'data-closed': '', 'aria-label': c }, h('option', { value: '', text: '…' }), ['yes', 'part', 'no'].map((k) => h('option', { value: k, text: Y(k) })));
        sel.value = m.checks[i] || '';
        sel.addEventListener('change', () => { m.checks[i] = sel.value; save('mapping', 'מיפוי: ' + t.name); render(); });
        return h('tr', {}, h('td', { 'data-h': Y('checklist'), text: c }), h('td', { 'data-h': T('status') }, sel),
          h('td', {}, (m.checks[i] === 'no' || m.checks[i] === 'part') ? h('button', { class: 'btn ghost sm', type: 'button', text: Y('addGap'), onclick: () => addGap(c, 'מפגש 2', t.id) }) : null));
      });
      const rep = L.REPORT.map(([k, hint], i) => field(k, bindText(h('input', { type: 'text', placeholder: hint }), () => m.report[i], (v) => { m.report[i] = v; }, 'mapping', 'דיווח: ' + t.name)));
      return h('details', { class: 'card' }, h('summary', { text: t.name }),
        h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [Y('checklist'), T('status'), ''].map((x) => h('th', { text: x })))), h('tbody', {}, rows)),
        h('h3', { text: Y('reportOf') }), makeTimer(180), rep, t.id === 'educators' ? contBox() : null);
    });
    return h('div', {}, h('div', { class: 'note' }, h('b', { text: T('report') + ': ' }), L.REPORT.map((r) => r[0]).join(' · ')), cards);
  }

  // ---------- 🎬 תרגילים: מפגש 3, מפגש 5 ותרחיש שהצוות בנה ----------
  // תרחיש: sirens (מפגש 3), disconnect (מפגש 5), או gen: תרחיש מהמחולל (עותק נשמר בתרגיל, ex.scn).
  function scnOf(ex) {
    if (!ex) return L.SIRENS;
    if (ex.scenario === 'disconnect') return L.DISCONNECT;
    if (ex.scenario === 'gen' && ex.scn) return ex.scn;
    return L.SIRENS;
  }
  const exList = (n) => arr('exercises').filter((x) => (x.session || 3) === n);
  S.exIds = S.exIds || {};
  const curEx = (n) => { const list = exList(n); return list.find((x) => x.id === S.exIds[n]) || list[list.length - 1] || null; };
  const procOf = (key) => L.MANDATORY.find((m) => m.key === key) || null;

  function exerciseTop(n, defaultScn) {
    const gens = arr('scenarios');
    const pickS = h('select', { 'data-closed': '' }, h('option', { value: defaultScn, text: (defaultScn === 'disconnect' ? L.DISCONNECT : L.SIRENS).title }),
      gens.map((g) => h('option', { value: 'gen:' + g.id, text: '🎲 ' + (g.scn.title || '') })));
    if (S.pickScn && S.pickScn[n]) pickS.value = S.pickScn[n];
    // לפני שמתחילים: התצוגה לפי התרחיש שנבחר ברשימה (בדיקת המומחים: במפגש 5 הוצג תרחיש אחר)
    pickS.onchange = () => { S.pickScn = S.pickScn || {}; S.pickScn[n] = pickS.value; render(); };
    const picked = () => { const v = pickS.value; const g = v.startsWith('gen:') ? gens.find((x) => 'gen:' + x.id === v) : null; return g ? g.scn : (v === 'disconnect' ? L.DISCONNECT : L.SIRENS); };
    const pickV = h('select', { 'data-closed': '' }, h('option', { value: '20', text: Y('v20') }), h('option', { value: '60', text: Y('v60') }));
    const startBtn = h('button', { class: 'btn', type: 'button', text: Y('startEx'), onclick: async () => {
      const list = arr('exercises');
      const v = pickS.value, gen = v.startsWith('gen:') ? gens.find((g) => 'gen:' + g.id === v) : null;
      const scn = gen ? gen.scn : (v === 'disconnect' ? L.DISCONNECT : L.SIRENS);
      const e = { id: uid('ex'), session: n, scenario: gen ? 'gen' : v, scn: gen ? gen.scn : null, title: scn.title, version: Number(pickV.value), startedAt: nowIso(), round: 1,
        rounds: [{}, {}, {}], marks: [], debrief: {}, ledByTeam: true, builtByTeam: !!gen, ledByDeputy: n === 5 || !!scn.emAbsent };
      list.push(e); S.doc.parts.exercises = list; S.exIds[n] = e.id; await save('exercises', 'התחלת תרגיל: ' + e.title); render();
    } });
    const past = exList(n);
    const pastRow = past.length ? h('div', { class: 'row' }, h('span', { class: 'muted', text: Y('exercises') + ':' }), past.map((x) => h('button', { class: 'btn ghost sm', type: 'button', 'aria-pressed': curEx(n) && x.id === curEx(n).id ? 'true' : 'false',
      text: dateIL(x.startedAt) + ' · ' + x.title, onclick: () => { S.exIds[n] = x.id; render(); } }))) : null;
    const scn = curEx(n) ? scnOf(curEx(n)) : picked();
    return h('div', { class: 'card' }, h('h2', { text: scn.title }), h('p', { text: scn.intro }),
      (obj('decmap').intent || scn.intent) ? h('p', {}, h('b', { text: Y('intent') + ': ' }), obj('decmap').intent || scn.intent) : null,
      (scn.success || (scn.card && scn.card.success) || []).length ? h('div', {}, h('b', { text: Y('success') }), h('ul', { class: 'list' }, (scn.success || scn.card.success).map((x) => h('li', { text: x })))) : null,
      h('p', { class: 'note small', text: Y('safeLine') }),
      h('div', { class: 'row noprint' }, field(Y('scenario'), pickS), field(Y('version'), pickV), startBtn), pastRow);
  }

  function viewS3() {
    const ex = curEx(3);
    const top = h('div', {}, h('div', { class: 'note', text: L.TABLETOP_NOTE }), exerciseTop(3, 'sirens'),
      h('details', { class: 'card' }, h('summary', { text: Y('timing') }), h('table', { class: 'rt' }, h('thead', {}, h('tr', {}, [Y('step'), '20', '60'].map((x) => h('th', { text: x })))), h('tbody', {}, L.SIRENS.timing.map((r) => h('tr', {}, r.map((c) => h('td', { text: String(c) }))))))));
    if (!ex) return top;
    return h('div', {}, top, exTabs(3, ex));
  }

  // תרגיל: הרצה, הקלטה ותחקיר בלשוניות (ובמפגש 5 גם ההשוואה), במקום גלילה
  function exTabs(n, ex) {
    const list = [[Y('exRun'), () => viewRun(ex)], [T('rec'), () => viewRec(ex)], [Y('exDebrief'), () => viewDebrief(ex)]];
    if (n === 5) list.push([Y('compareT'), viewCompare]);
    return tabs('ex' + n, list);
  }
  // תיק הרציפות: מוכנות הכיתה לחירום כבר כתובה שם, כדי לא לכתוב פעמיים
  function contBox(text) {
    const CK = window.SBE_CONT && (ORGSP && window.SBE_CONT.forSpace ? window.SBE_CONT.forSpace('org') : window.SBE_CONT);
    const list = !text && CK && Array.isArray(CK.DEFAULT_READINESS) ? CK.DEFAULT_READINESS : [];
    return h('div', { class: 'note' }, h('b', { text: Y('contKit') }), h('p', { text: text || Y('contInfo') }), list.length && S.lang === 'ar' ? h('p', { class: 'muted small', text: Y('heOnly') }) : null,
      list.length ? h('ul', { class: 'list' }, list.map((x) => h('li', { text: x }))) : null,
      h('a', { class: 'btn ghost sm', href: 'continuity-kit.html', target: '_blank', rel: 'noopener', text: Y('contKit') }));
  }
  function viewRec(ex) {
    const box = h('div', { class: 'card noprint' }, h('h2', { text: T('rec') }), h('p', { text: T('recInfo') }));
    const consent = h('input', { type: 'checkbox', id: 'rdyConsent' });
    const out = h('div', {});
    const open = h('button', { class: 'btn', type: 'button', text: Y('openRec'), onclick: async () => {
      if (!consent.checked) { consent.focus(); toast(T('consent')); return; }
      open.disabled = true;
      const [st, r] = await api('rdyRecStart', { id: S.doc.id, exId: ex.id, consent: true });
      open.disabled = false;
      if (st !== 200) { toast(r.error || ''); return; }
      ex.rec = { on: true, consentAt: nowIso() };
      const link = new URL('readiness-rec.html?rk=' + r.rk, location.href).href;
      const qr = h('div', { class: 'qr' });
      out.replaceChildren(h('p', { class: 'muted', text: T('recLink') }), h('div', { class: 'row' }, h('input', { type: 'text', value: link, readonly: true, class: 'grow' }),
        h('button', { class: 'btn ghost sm', type: 'button', text: Y('copy'), onclick: () => { navigator.clipboard && navigator.clipboard.writeText(link); toast(Y('copied')); } })), qr);
      if (window.QRCode) { try { new window.QRCode(qr, { text: link, width: 168, height: 168, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) {} }
    } });
    box.append(h('label', { class: 'row', for: 'rdyConsent' }, consent, ' ', T('consent')), open, out, h('p', { class: 'muted', text: Y('recNo') }));
    if (ex.rec && ex.rec.on) box.append(h('p', {}, h('span', { class: 'pill green', text: Y('recOn') })));
    return box;
  }

  function procCards(R, ex) {
    const out = [];
    for (const key of R.procedures || []) {
      const m = procOf(key); if (!m) continue;
      out.push(h('div', { class: 'note' }, h('b', { text: L.PROC_KIND.binding + ': ' + m.topic }), h('div', { text: m.rule }),
        h('div', { class: 'muted' }, m.url ? h('a', { href: m.url, target: '_blank', rel: 'noopener', text: m.source }) : m.source, ' · ' + L.VERIFY)));
    }
    const annexes = (obj('plan').annexes || []).filter((a) => a && a.text && (R.annexes || []).includes(a.id));
    for (const a of annexes) out.push(h('div', { class: 'sunny' }, h('b', { text: L.PROC_KIND.school + ': ' + a.name }), h('div', { text: a.text })));
    for (const miss of R.missing || []) {
      out.push(h('div', { class: 'warn' }, h('b', { text: L.PROC_KIND.missing }), h('div', { text: miss }), h('div', { class: 'muted', text: L.MISSING_ASK }),
        h('button', { class: 'btn ghost sm noprint', type: 'button', text: Y('toEnds'), onclick: () => addEnd(L.PROC_KIND.missing + ': ' + miss, 'mgmt', T('round') + ' ' + R.n + ' · ' + (ex.title || '')) })));
    }
    return out;
  }

  function viewRun(ex) {
    const scn = scnOf(ex);
    const r = Math.min(3, Math.max(1, ex.round || 1));
    const R = scn.rounds[r - 1];
    const st = ex.rounds[r - 1] = ex.rounds[r - 1] || {};
    const tabs = h('div', { class: 'row noprint' }, scn.rounds.map((x, i) => h('button', { class: 'btn ghost sm', type: 'button', 'aria-pressed': i + 1 === r ? 'true' : 'false', text: T('round') + ' ' + (i + 1) + (x.time ? ' · ' + x.time : ''), onclick: () => { ex.round = i + 1; save('exercises', ''); render(); } })));
    const mark = h('button', { class: 'btn ghost sm', type: 'button', text: T('markManual'), onclick: () => { ex.marks.push({ t: Date.now() - Date.parse(ex.startedAt), round: r, note: '' }); save('exercises', ''); toast('⭐'); } });
    const updates = [h('div', { class: 'update all' }, h('b', { text: T('toAll') }), h('div', { text: R.all })),
      ...allTeams().filter((t) => R.teams[t.id]).map((t) => h('div', { class: 'update' }, h('b', { text: t.name }), h('div', { text: R.teams[t.id] })))];
    const mail = h('button', { class: 'btn ghost sm', type: 'button', text: T('sendMail'), onclick: async () => {
      mail.disabled = true;
      const items = allTeams().map((t) => ({ teamId: t.id, text: R.all + (R.teams[t.id] ? '\n\n' + R.teams[t.id] : '') }));
      const [s, o] = await api('rdyMail', { id: S.doc.id, subject: T('round') + ' ' + r + (R.time ? ' · ' + R.time : '') + ' · ' + R.title, items });
      mail.disabled = false;
      toast(s === 200 ? (o.available ? Y('mailSent') + ': ' + o.sent : T('mailOff')) : (o.error || ''));
    } });
    const decision = bindText(h('textarea', { rows: 2 }), () => st.decision, (v) => { st.decision = v; }, 'exercises', '');
    const planQ = bindText(h('input', { type: 'text' }), () => st.plan, (v) => { st.plan = v; }, 'exercises', '');
    const noPlan = h('button', { class: 'btn ghost sm', type: 'button', text: T('noPlan'), onclick: () => { st.noPlan = true; addGap(R.decision + ': ' + L.SIRENS.planQuestion, T('round') + ' ' + r); save('exercises', ''); } });
    const altsBox = h('div', {});
    const drawAlts = (alts) => altsBox.replaceChildren(h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('alt'), T('allows'), T('gives')].map((x) => h('th', { text: x })))),
      h('tbody', {}, alts.map((a) => h('tr', {}, a.slice(0, 3).map((c, i) => h('td', { 'data-h': [T('alt'), T('allows'), T('gives')][i], text: c })))))));
    if (st.altsShown) drawAlts(R.alts || st.alts || []);
    const showAlts = h('button', { class: 'btn ghost sm', type: 'button', text: T('showAlts'), onclick: async () => {
      if (!String(st.decision || '').trim()) { decision.focus(); toast(T('decision')); return; }
      if (R.alts) { st.altsShown = true; save('exercises', ''); drawAlts(R.alts); return; }
      showAlts.disabled = true; altsBox.replaceChildren(h('p', { class: 'muted', text: Y('working') }));
      try {
        const content = 'התרחיש: ' + scn.title + '\nמה קורה: ' + R.all + '\nנקודת ההחלטה: ' + R.decision + '\nההחלטה של הצוות: ' + st.decision + '\nנהלים מחייבים שקפצו: ' + (R.procedures || []).map((k) => (procOf(k) || {}).topic).join(', ');
        const v = await window.sbeCallAIJson(SERVER, { system: P.altSystem(S.lang), messages: [{ role: 'user', content }], maxTokens: 2000, fast: true }, 120000, P.validAlts);
        st.alts = v.alts.slice(0, 3).map((a) => a.slice(0, 3).map((x) => String(x).slice(0, 300))); st.altsShown = true; await save('exercises', ''); drawAlts(st.alts);
      } catch (e) { altsBox.replaceChildren(h('div', { class: 'warn', text: T('noModel') })); }
      showAlts.disabled = false;
    } });
    const extra = [];
    if (R.callHelp) {
      ex.callHelpParts = ex.callHelpParts || [];
      extra.push(h('div', { class: 'card' }, h('h3', { text: T('callHelp') }),
        L.SIRENS.callHelp.map((label, i) => field((i + 1) + '. ' + label, bindText(h('input', { type: 'text' }), () => ex.callHelpParts[i], (v) => { ex.callHelpParts[i] = v; ex.callHelp = ex.callHelpParts.filter(Boolean).join(' · '); }, 'exercises', ''))),
        h('b', { text: Y('callAfter') }), L.SIRENS.callHelpAfter.map((q, i) => field(q, bindText(h('input', { type: 'text' }), () => (ex.callHelpAfter || [])[i], (v) => { ex.callHelpAfter = ex.callHelpAfter || []; ex.callHelpAfter[i] = v; }, 'exercises', '')))));
    }
    const HT = scn.hardTalk;
    if (R.hardTalk && HT && HT.q) {
      const ans = bindText(h('textarea', { rows: 3 }), () => ex.hardTalk, (v) => { ex.hardTalk = v; }, 'exercises', '');
      const after = h('div', {});
      const talkHow = (L.S4.find((x) => x.k === 'talk') || {}).how;
      const reveal = () => after.replaceChildren(talkHow ? h('div', { class: 'note' }, h('b', { text: Y('howAnswer') + ': ' }), talkHow) : null, h('ul', { class: 'list' }, (HT.feedback || []).map((q) => h('li', { text: q }))), h('p', { class: 'muted' }, (HT.card || '') + ' ', h('a', { href: 'yesh-ma-laasot.html?back=home', target: '_blank', rel: 'noopener', text: S.lang === 'ar' ? 'يوجد ما نفعله' : 'יש מה לעשות' })));
      if (String(ex.hardTalk || '').trim()) reveal();
      ans.addEventListener('change', () => { if (String(ans.value).trim()) reveal(); });
      extra.push(h('div', { class: 'card' }, h('h3', { text: T('hardTalk') }), h('p', { class: 'big', style: 'font-size:1.15rem', text: HT.q }), h('p', { class: 'muted', text: HT.how || '' }), field(T('answer'), ans), after));
    }
    if (R.teams && R.teams.parents) {
      extra.push(h('div', { class: 'card' }, h('h3', { text: Y('parentsMsgT') }), h('p', { class: 'muted small', text: Y('parentsMsgCues') }),
        field(Y('parentsMsgT'), bindText(h('textarea', { rows: 4, placeholder: Y('parentsMsgPh') }), () => st.parentsMsg, (v) => { st.parentsMsg = v; }, 'exercises', ''))));
    }
    const rd = h('div', { class: 'card' }, h('h3', { text: T('roundDebrief') }), makeTimer(150),
      field(L.ROUND_DEBRIEF[0], bindText(h('textarea', { rows: 2 }), () => st.worked, (v) => { st.worked = v; }, 'exercises', '')),
      r > 1 ? field(L.ROUND_DEBRIEF[1], bindText(h('textarea', { rows: 2 }), () => st.improved, (v) => { st.improved = v; }, 'exercises', '')) : null);
    const nav = h('div', { class: 'row noprint' },
      r < 3 ? h('button', { class: 'btn', type: 'button', text: Y('cont') + ': ' + T('round') + ' ' + (r + 1), onclick: () => { ex.round = r + 1; save('exercises', ''); render(); window.scrollTo(0, 0); } })
        : h('button', { class: 'btn', type: 'button', text: Y('finish'), onclick: () => { ex.finishedAt = ex.finishedAt || nowIso(); save('exercises', 'סיום התרחיש: ' + ex.title); render(); } }),
      h('button', { class: 'btn ghost', type: 'button', text: Y('printCards'), onclick: () => printCards(ex) }));
    const deputy = (ex.session === 5 || scn.emAbsent) ? h('label', { class: 'row sunny' }, h('input', { type: 'checkbox', checked: !!ex.ledByDeputy, onchange: (e) => { ex.ledByDeputy = e.target.checked; save('exercises', e.target.checked ? L.EM_ABSENT : ''); } }), ' ', L.EM_ABSENT) : null;
    return h('div', {}, h('div', { class: 'card' }, h('h2', { text: T('round') + ' ' + r + (R.time ? ' · ' + R.time : '') + ' · ' + R.title }),
      deputy, r === 1 ? h('div', { class: 'note' }, h('b', { text: Y('opening') + ': ' }), scn.opening || L.SIRENS.opening) : null,
      h('div', { class: 'row' }, tabs, mark), updates, h('div', { class: 'row noprint' }, mail), procCards(R, ex),
      h('h3', { text: R.decision }), field(T('decision'), decision), field(T('planQ'), planQ), noPlan, h('div', { class: 'row noprint' }, showAlts), altsBox,
      extra, rd, r === 3 && ex.finishedAt ? h('div', { class: 'note' }, h('b', { text: Y('closing') + ': ' }), scn.closing || '') : null, nav),
      (scn.characters || []).length ? viewRole(ex, scn, R) : null);
  }

  // משחק התפקידים: המודל מגלם דמות מבחוץ ומגיב למה שהצוות אומר (03, "סוגי תרגול"; 04, "דמויות מבחוץ")
  function viewRole(ex, scn, R) {
    ex.role = ex.role || {};
    const pick = h('select', { 'data-closed': '' }, scn.characters.map((c) => h('option', { value: c.id, text: c.name })));
    pick.value = S.roleCh && scn.characters.some((c) => c.id === S.roleCh) ? S.roleCh : scn.characters[0].id;
    const log = h('div', {});
    const draw = () => {
      const ch = scn.characters.find((c) => c.id === pick.value);
      const msgs = ex.role[ch.id] || [];
      log.replaceChildren(h('p', { class: 'muted', text: ch.brief }), ...msgs.map((m) => h('div', { class: m.who === 'char' ? 'update' : 'update all' }, h('b', { text: m.who === 'char' ? ch.name : Y('ourTeam') }), h('div', { text: m.text }))));
    };
    pick.addEventListener('change', () => { S.roleCh = pick.value; draw(); });
    const input = piiCheck(h('textarea', { rows: 2, 'aria-label': Y('sayIt') }));
    const send = h('button', { class: 'btn', type: 'button', text: Y('sayIt'), onclick: async () => {
      const text = String(input.value || '').trim(); if (!text) return;
      const ch = scn.characters.find((c) => c.id === pick.value);
      const msgs = ex.role[ch.id] = ex.role[ch.id] || [];
      msgs.push({ who: 'team', text: text.slice(0, 1000) }); input.value = ''; draw();
      send.disabled = true;
      try {
        const messages = msgs.slice(-12).map((m) => ({ role: m.who === 'char' ? 'assistant' : 'user', content: m.text }));
        const reply = await window.sbeCallAI(SERVER, { system: P.roleSystem(ch, scn, R, S.lang), messages, maxTokens: 400, fast: true }, 90000);
        msgs.push({ who: 'char', text: String(reply || '').trim().slice(0, 1000) });
        save('exercises', '');
      } catch (e) { toast(T('noModel')); }
      send.disabled = false; draw();
    } });
    draw();
    return h('div', { class: 'card' }, h('h2', { text: Y('roleplay') }), h('p', { class: 'muted', text: Y('roleInfo') }), field(Y('character'), pick), log, field(Y('sayIt'), input), h('div', { class: 'row noprint' }, send));
  }

  function viewDebrief(ex) {
    if (!ex.finishedAt) return h('div', {});
    ex.debrief = ex.debrief || {};
    const steps = L.DEBRIEF.map((d, i) => h('details', { class: 'card', open: i === 0 }, h('summary', { text: (i + 1) + '. ' + d.title + ' · ' + d.min + ' ' + Y('min') }),
      h('p', { text: d.text }), makeTimer(d.min * 60),
      bindText(h('textarea', { rows: 3 }), () => ex.debrief[d.k], (v) => { ex.debrief[d.k] = v; }, 'exercises', '')));
    const draftBox = h('div', {});
    if (ex.draft) draftBox.appendChild(draftView(ex));
    const draftBtn = h('button', { class: 'btn', type: 'button', text: T('draft'), onclick: async () => {
      if (ex.draft && !confirm(Y('draftReplace'))) return;
      draftBtn.disabled = true; draftBox.replaceChildren(h('p', { class: 'muted', text: Y('working') }));
      let tr = null;
      const [s, o] = await api('rdyTranscriptGet', { id: S.doc.id, exId: ex.id }); if (s === 200) tr = o.transcript;
      if (tr && ex.marks.length) tr.marks = (tr.marks || []).concat(ex.marks);
      else if (!tr) tr = { segments: [], marks: ex.marks };
      try {
        const srcs = window.SBE_ADVISOR_SOURCES ? window.SBE_ADVISOR_SOURCES.forAdvisor('readiness') : [];
        const v = await window.sbeCallAIJson(SERVER, { system: P.debriefSystem(S.lang), messages: [{ role: 'user', content: anon(P.debriefInput(ex, tr, srcs, (obj('decmap').intent ? 'כוונת בית הספר: ' + obj('decmap').intent + '\n' : '') + decmapRows().map((r) => r.filter(Boolean).join(' · ')).join('\n')) )}], maxTokens: 12000, customerReview: true }, 300000, P.validDebrief);
        ex.draft = v;
        ex.report = ex.report || {};
        ex.report.rows = (v.gaps || []).map((g) => ({ topic: g.topic || '', planned: g.planned || '', happened: g.happened || '', how: g.how || '', keep: g.keep === 'keep' ? 'keep' : 'improve', action: g.action || '', owner: g.team ? teamName(g.team) : '', due: plus(14), team: g.team || '' }));
        for (const t of P.detectEnds((tr.segments || []).map((x) => x.text).join(' '))) (v.ends = v.ends || []).push({ text: t });
        await save('exercises', 'טיוטת תחקיר');
        draftBox.replaceChildren(draftView(ex));
      } catch (e) { draftBox.replaceChildren(h('div', { class: 'warn', text: T('noModel') })); }
      draftBtn.disabled = false;
    } });
    const trBox = h('div', {});
    const trBtn = h('button', { class: 'btn ghost sm', type: 'button', text: Y('loadTr'), onclick: async () => {
      const [s, o] = await api('rdyTranscriptGet', { id: S.doc.id, exId: ex.id });
      if (s !== 200) { toast(o.error || ''); return; }
      const segs = o.transcript.segments || [];
      const areas = segs.map((g) => { const ta = h('textarea', { rows: 2 }); ta.value = g.text; ta.addEventListener('input', () => { g.text = ta.value; }); return field(T('round') + ' ' + g.round, piiCheck(ta)); });
      trBox.replaceChildren(h('p', { class: 'muted', text: Y('segs') + ': ' + segs.length + ' · ' + Y('marks') + ': ' + (o.transcript.marks || []).length }), ...areas,
        segs.length ? h('button', { class: 'btn ghost sm', type: 'button', text: Y('saveTr'), onclick: async () => { const [s2, o2] = await api('rdyTranscriptSave', { id: S.doc.id, exId: ex.id, segments: segs }); toast(s2 === 200 ? T('saved') : (o2.error || '')); } }) : '');
    } });
    return h('div', {}, h('div', { class: 'card' }, h('h2', { text: T('debrief') }), h('p', { class: 'muted', text: L.SIRENS.timing.map((x) => x[0] + ' ' + x[1] + '/' + x[2]).join(' · ') })), steps,
      h('div', { class: 'card noprint' }, h('h3', { text: T('transcript') }), h('p', { class: 'muted', text: Y('editTr') }), trBtn, trBox),
      h('div', { class: 'card' }, h('h2', { text: T('reportT') }), ex.report && ex.report.approvedAt ? h('p', {}, h('span', { class: 'pill green', text: T('approved') + ' · ' + dateIL(ex.report.approvedAt) })) : h('div', { class: 'row noprint' }, draftBtn), draftBox));
  }
  function draftView(ex) {
    const v = ex.draft || {}, rep = ex.report = ex.report || { rows: [] };
    const box = h('div', {});
    if ((v.timeline || []).length) box.append(h('h3', { text: Y('timeline') }), h('ul', { class: 'list' }, v.timeline.map((x) => h('li', { text: (x.t ? x.t + ' · ' : '') + (x.what || '') }))));
    if ((v.worked || []).length) box.append(h('h3', { text: Y('worked') }), h('ul', { class: 'list' }, v.worked.map((x) => h('li', { text: x }))));
    const cols = L.REPORT_COLS;
    const keys = ['topic', 'planned', 'happened', 'how', 'keep', 'action', 'owner', 'due'];
    box.append(h('h3', { text: T('reportT') }), h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, cols.map((c) => h('th', { text: c })), h('th', { class: 'noprint' }))),
      h('tbody', {}, rep.rows.map((row, i) => h('tr', {}, keys.map((k, j) => {
        if (k === 'keep') { const s = h('select', { 'data-closed': '' }, Object.entries(L.KEEP).map(([a, b]) => h('option', { value: a, text: b }))); s.value = row.keep || 'improve'; s.onchange = () => { row.keep = s.value; save('exercises', ''); }; return h('td', { 'data-h': cols[j] }, s); }
        if (k === 'due') { const d = h('input', { type: 'date', value: row.due || '' }); d.onchange = () => { row.due = d.value; save('exercises', ''); }; return h('td', { 'data-h': cols[j] }, d); }
        return h('td', { 'data-h': cols[j] }, bindText(h('textarea', { rows: 3, class: 'cell' }), () => row[k], (val) => { row[k] = val; }, 'exercises', ''));
      }), h('td', { class: 'noprint' }, h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { rep.rows.splice(i, 1); save('exercises', ''); render(); } })))))),
    h('button', { class: 'btn ghost sm noprint', type: 'button', text: Y('addRow'), onclick: () => { rep.rows.push({ keep: 'improve', due: plus(14) }); save('exercises', ''); render(); } }));
    if ((v.ends || []).length) box.append(h('h3', { text: T('ends') }), h('ul', { class: 'list' }, v.ends.map((e) => h('li', {}, e.text + ' ', h('button', { class: 'btn ghost sm noprint', type: 'button', text: Y('toEnds'), onclick: () => { addEnd(e.text, e.team, 'תחקיר מפגש ' + (ex.session || 3)); } })))));
    if ((v.ideas || []).length) box.append(h('h3', { text: T('ideas') }), h('ul', { class: 'list' }, v.ideas.map((x) => h('li', { text: x.text + (x.ifThen ? ' · ' + x.ifThen : '') }))));
    if ((v.feedback || []).length) box.append(h('h3', { text: Y('fb') }), h('ul', { class: 'list' }, v.feedback.map((x) => h('li', {}, x.text, x.source ? h('span', { class: 'muted', text: ' · ' + srcLabel(x.source) }) : null))));
    const approve = h('button', { class: 'btn noprint', type: 'button', text: T('approve'), onclick: async () => {
      if (!confirm(Y('confirmApprove'))) return;
      rep.approvedAt = nowIso();
      const src = 'תחקיר מפגש ' + (ex.session || 3);
      const acts = arr('actions'), gaps = arr('gaps'), ideas = arr('ideas'), ends = arr('ends');
      for (const row of rep.rows) {
        let aid = '';
        if (row.keep === 'improve' && row.action) { aid = uid('a'); acts.push({ id: aid, text: row.action, team: row.team || '', owner: personOwner(row.owner, row.team), due: row.due || plus(14), status: 'todo', src, srcId: ex.id }); }
        if (row.keep === 'improve' && row.topic) gaps.push({ id: uid('g'), text: row.topic + (row.happened ? ': ' + row.happened : ''), team: row.team || '', src, at: nowIso(), actionId: aid });
        if (row.keep === 'keep' && row.topic) S.doc.log.push({ at: nowIso(), by: S.by || '', part: 'exercises', what: Y('keptT') + ': ' + row.topic });
      }
      // קצוות פתוחים מהטיוטה נכנסים לטבלת המעקב (בלי כפילויות)
      const have = new Set(ends.map((e) => String(e.text || '').trim()));
      for (const e of v.ends || []) { const t = String(e.text || '').trim(); if (t && !have.has(t)) { have.add(t); ends.push({ id: uid('e'), text: t, owner: personOwner(e.owner, e.team), openedAt: nowIso(), next: plus(3), status: 'open', missed: 0, src, srcId: ex.id, by: S.by }); } }
      S.doc.parts.ends = ends;
      for (const x of v.ideas || []) ideas.push({ id: uid('i'), text: x.text, ifThen: x.ifThen || '', at: nowIso(), decision: '', exId: ex.id, src: src });
      S.doc.parts.actions = acts; S.doc.parts.gaps = gaps; S.doc.parts.ideas = ideas;
      const n = ex.session || 3, sess = obj('sessions'); if (!(sess[n] && sess[n].done)) { sess[n] = { done: true, at: nowIso() }; S.doc.parts.sessions = sess; await save('sessions', 'מפגש ' + n + ' הושלם'); }
      await save('exercises', 'אישור דוח התחקיר'); await save('actions', ''); await save('gaps', ''); await save('ideas', ''); await save('ends', '');
      await api('rdyTranscriptDelete', { id: S.doc.id, exId: ex.id });
      render();
    } });
    box.append(h('div', { class: 'row noprint' }, rep.approvedAt ? null : approve, h('button', { class: 'btn ghost', type: 'button', text: Y('printReport'), onclick: () => printReport(ex) }), h('button', { class: 'btn ghost', type: 'button', text: Y('printSummary'), onclick: () => printSummary(ex.session || 3) })));
    return box;
  }

  // ---------- 📚 מפגש 4: למידה והיערכות ----------
  function viewS4() {
    const learn = obj('learning'); S.doc.parts.learning = learn;
    const gaps = arr('gaps');
    const plan = planObj();
    const res = h('div', { class: 'card' }, h('h2', { text: Y('learnWhat') }), h('div', { class: 'grid3' }, L.S4.map((x) => h('div', { class: 'tile' }, h('b', { text: x.title }), h('p', { text: x.how }),
      x.k === 'call' ? h('ol', { class: 'list' }, L.SIRENS.callHelp.map((c) => h('li', { text: c }))) : null,
      h('div', { class: 'row' }, (x.links || []).map(([f, label]) => h('a', { class: 'btn ghost sm', href: f, target: '_blank', rel: 'noopener', text: label })))))));
    const cards = allTeams().map((t) => {
      const m = learn[t.id] = learn[t.id] || {};
      const sel = h('select', { 'data-closed': '', 'aria-label': Y('pickGap') }, h('option', { value: '', text: '…' }), gaps.map((g) => h('option', { value: g.id, text: String(g.text).slice(0, 90) })));
      sel.value = m.gap || '';
      sel.addEventListener('change', () => { m.gap = sel.value; save('learning', 'מפגש 4: ' + t.name + ' בחר/ה פער'); });
      const aid = h('input', { type: 'date', value: m.aid || '', 'aria-label': Y('aidDate') });
      aid.onchange = () => { m.aid = aid.value; save('learning', 'עזרה ראשונה: ' + t.name); };
      const annexSel = h('select', { 'data-closed': '' }, h('option', { value: '', text: '…' }), plan.annexes.map((a) => h('option', { value: a.id, text: a.name })));
      annexSel.value = m.annex || (L.ANNEXES.find((a) => a.team === t.id) || {}).id || '';
      const annexBox = h('div', {});
      const drawAnnex = () => {
        const a = plan.annexes.find((x) => x.id === annexSel.value);
        if (!a) { annexBox.replaceChildren(); return; }
        const ta = bindText(h('textarea', { rows: 3 }), () => a.text, (v) => { a.text = v; a.updatedAt = nowIso(); a.by = S.by; }, 'plan', 'נספח ' + a.name);
        annexBox.replaceChildren(h('p', { class: 'muted', text: T('maturity') + ': ' + (L.MATURITY[a.maturity] || '…') }), ta,
          h('button', { class: 'btn ghost sm', type: 'button', text: Y('updatedAfter'), onclick: () => { a.maturity = 3; a.updatedAt = nowIso(); a.by = S.by; save('plan', 'נספח ' + a.name + ': ' + L.MATURITY[3]); toast(L.MATURITY[3] + ' ✓'); render(); } }));
      };
      annexSel.addEventListener('change', () => { m.annex = annexSel.value; save('learning', ''); drawAnnex(); });
      drawAnnex();
      return h('details', { class: 'card' }, h('summary', { text: t.name + (m.gap ? ' ✓' : '') }),
        field(Y('pickGap'), sel), field(Y('learnPlan'), bindText(h('textarea', { rows: 2 }), () => m.plan, (v) => { m.plan = v; }, 'learning', '')),
        field(Y('aidDate'), aid), field(Y('annexToUpdate'), annexSel), annexBox);
    });
    return h('div', {}, res, gaps.length ? null : h('p', { class: 'muted', text: Y('noGaps') }), cards);
  }

  // ---------- 🎯 מפגש 5: תרחיש בלי הכנה, והשוואה למפגש 3 ----------
  function viewS5() {
    const ex = curEx(5);
    const top = h('div', {}, h('div', { class: 'sunny', text: L.EM_ABSENT + '. ' + Y('noPrep') }), h('div', { class: 'note', text: L.TABLETOP_NOTE }), exerciseTop(5, 'disconnect'));
    return h('div', {}, top, ex ? exTabs(5, ex) : viewCompare(), h('div', { class: 'note' }, L.COMMUNITY + ' ', h('a', { class: 'lnk', href: 'journey.html', text: Y('toJourney') })));
  }
  function viewCompare() {
    const r3 = exList(3).filter((x) => x.report && x.report.rows && x.report.rows.length).pop();
    const r5 = exList(5).filter((x) => x.report && x.report.rows && x.report.rows.length).pop();
    const cmp = obj('compare'); cmp.rows = cmp.rows || []; S.doc.parts.compare = cmp;
    const box = h('div', { class: 'card' }, h('h2', { text: Y('compareT') }), h('p', { class: 'muted', text: Y('compareInfo') }));
    if (!r3) { box.append(h('p', { class: 'muted', text: Y('needS3') })); return box; }
    if (!cmp.rows.length) cmp.rows = r3.report.rows.map((x) => ({ topic: x.topic || '', s3: x.happened || '', s5: '', state: '', todo: '' }));
    const draft = h('button', { class: 'btn ghost', type: 'button', text: Y('compareDraft'), onclick: async () => {
      if (!r5) { toast(Y('needS5')); return; }
      draft.disabled = true;
      try {
        const rows = (rep) => rep.report.rows.map((x) => '- ' + [x.topic, x.happened, x.how, L.KEEP[x.keep] || ''].filter(Boolean).join(' · ')).join('\n');
        const v = await window.sbeCallAIJson(SERVER, { system: P.compareSystem(S.lang), messages: [{ role: 'user', content: 'דוח מפגש 3:\n' + rows(r3) + '\n\nדוח מפגש 5:\n' + rows(r5) }], maxTokens: 6000, customerReview: true }, 240000, P.validCompare);
        cmp.rows = v.rows.map((x) => ({ topic: String(x.topic || ''), s3: String(x.s3 || ''), s5: String(x.s5 || ''), state: ['closed', 'better', 'open', 'fresh'].includes(x.state) ? x.state : '', todo: String(x.todo || '') }));
        await save('compare', 'טיוטת השוואה בין מפגש 3 למפגש 5'); render();
      } catch (e) { toast(T('noModel')); }
      draft.disabled = false;
    } });
    const keys = ['topic', 's3', 's5', 'state', 'todo'];
    const order = { better: 0, closed: 1, open: 2, fresh: 3, '': 4 };
    const rows = cmp.rows.slice().sort((a, b) => order[a.state || ''] - order[b.state || '']);
    const table = h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, L.COMPARE_COLS.map((c) => h('th', { text: c })))),
      h('tbody', {}, rows.map((row) => h('tr', {}, keys.map((k, j) => {
        if (k === 'state') { const s = h('select', { 'data-closed': '' }, h('option', { value: '', text: '…' }), Object.entries(L.COMPARE).map(([a, b]) => h('option', { value: a, text: b }))); s.value = row.state || ''; s.onchange = () => { row.state = s.value; save('compare', ''); }; return h('td', { 'data-h': L.COMPARE_COLS[j] }, s); }
        return h('td', { 'data-h': L.COMPARE_COLS[j] }, bindText(h('textarea', { rows: 2, class: 'cell' }), () => row[k], (v) => { row[k] = v; }, 'compare', ''));
      })))));
    const apply = h('button', { class: 'btn', type: 'button', text: Y('compareApply'), onclick: async () => {
      const acts = arr('actions'); let n = 0;
      for (const row of cmp.rows) {
        if (!row.state || row.applied) continue;
        const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
        const match = acts.find((a) => openAct(a) && (norm(a.text) === norm(row.todo) || (row.topic && norm(a.text).includes(norm(row.topic)))));
        if (row.state === 'closed') { S.doc.log.push({ at: nowIso(), by: S.by, what: 'נסגר ונכנס למערך: ' + row.topic }); if (match) { match.status = 'tested'; match.doneAt = nowIso(); } }
        else if (match) { match.text = row.todo || match.text; match.due = plus(30); }
        else { acts.push({ id: uid('a'), text: row.todo || row.topic, team: '', owner: '', due: plus(30), status: 'todo', src: Y('compareT') }); n++; }
        row.applied = true;
      }
      S.doc.parts.actions = acts; await save('compare', 'ההשוואה עודכנה במערך'); await save('actions', ''); toast(T('actions') + ': +' + n); render();
    } });
    box.append(h('div', { class: 'row noprint' }, draft), table, h('div', { class: 'row noprint' }, h('button', { class: 'btn ghost sm', type: 'button', text: Y('addRow'), onclick: () => { cmp.rows.push({ topic: '', s3: '', s5: '', state: 'fresh', todo: '' }); save('compare', ''); render(); } }), apply,
      h('button', { class: 'btn ghost', type: 'button', text: Y('printCompare'), onclick: () => doPrint(Y('compareT'), Y('compareT'), [h('h2', { text: Y('compareT') }), tbl(L.COMPARE_COLS, rows.map((r) => [r.topic, r.s3, r.s5, L.COMPARE[r.state] || '', r.todo]))]) })));
    return box;
  }

  // ---------- 🔁 בשגרה: מחולל תרחישי משבר וחירום ----------
  // הצוות מגדיר מה בודקים ובוחר את הצירים (Moktan2026); הערכים נשמרים בעברית (P), והתצוגה בשפת המסך (L).
  function viewRoutine() {
    const g = S.gen = S.gen || LS.get('sbe.prep.gen', { open: {}, sel: {} });
    const keep = () => LS.set('sbe.prep.gen', g);
    const sel = g.sel;
    const box = h('div', { class: 'card' }, h('h2', { text: Y('genT') }), h('p', { class: 'muted', text: Y('genInfo') }));
    // 1. מה בודקים: הצעות מתוך המערך
    const tests = h('textarea', { rows: 3 }); tests.value = sel.tests || '';
    tests.addEventListener('input', () => { sel.tests = tests.value; keep(); });
    const sug = [].concat(arr('gaps').slice(-5).map((x) => x.text), arr('ends').filter((e) => e.status !== 'closed').slice(-3).map((e) => e.text),
      (obj('plan').annexes || []).filter((a) => a.text && (a.maturity == null || a.maturity < 2)).map((a) => Y('notPracticed') + ': ' + a.name)).filter(Boolean);
    box.append(h('h3', { text: '1. ' + Y('genTests') }), sug.length ? h('div', { class: 'row' }, sug.map((s) => h('button', { class: 'btn ghost sm', type: 'button', text: String(s).slice(0, 70), onclick: () => { tests.value = (tests.value ? tests.value + '; ' : '') + s; sel.tests = tests.value; keep(); } }))) : null, piiCheck(tests));
    // 2. שנים עשר הצירים
    const base = P.content('he');
    const optsOf = (ax) => ax.k === 'crisis' ? base.CRISIS.map((c) => c.name) : ax.k === 'what' ? ((base.CRISIS.find((c) => c.name === sel.crisis) || {}).what || []) : base.AXES.find((a) => a.k === ax.k).opts;
    const labelsOf = (ax) => ax.k === 'crisis' ? L.CRISIS.map((c) => c.name + (c.sensitive ? ' · ' + Y('teamOnly') : '')) : ax.k === 'what' ? ((L.CRISIS[base.CRISIS.findIndex((c) => c.name === sel.crisis)] || {}).what || []) : ax.opts;
    const axes = L.AXES.map((ax) => {
      const opts = optsOf(ax), labels = labelsOf(ax);
      // כל ציר מקופל, ובשורה רואים מה נבחר; פתוח רק הציר שעובדים עליו (בהתחלה: סוג המשבר). פחות גלילה בטלפון.
      const chosen = [].concat(sel[ax.k] || []).filter(Boolean).map((v) => { const i = opts.indexOf(v); return i >= 0 ? (labels[i] || v) : v; }).join(', ');
      S.axOpen = S.axOpen || 'crisis';
      const wrap = h('details', { class: 'teamcard axis', open: S.axOpen === ax.k }, h('summary', {}, h('b', { text: ax.n + '. ' + ax.label }), chosen ? h('span', { class: 'muted', text: ': ' + chosen }) : (g.open[ax.k] ? h('span', { class: 'muted', text: ': ' + L.SURPRISE }) : null)), h('div', { class: 'muted', text: ax.q }));
      wrap.addEventListener('toggle', () => { if (wrap.open) { S.axOpen = ax.k; wrap.parentNode && wrap.parentNode.querySelectorAll('details.axis[open]').forEach((d) => { if (d !== wrap) d.open = false; }); } });
      if (ax.multi) {
        const cur = new Set([].concat(sel[ax.k] || []));
        wrap.append(h('div', { class: 'row' }, opts.map((o, i) => h('label', { class: 'pill' }, h('input', { type: 'checkbox', checked: cur.has(o), onchange: (e) => { if (e.target.checked) cur.add(o); else cur.delete(o); sel[ax.k] = [...cur]; keep(); } }), ' ', labels[i] || o))));
      } else {
        const s = h('select', { 'data-closed': '', 'aria-label': ax.label }, h('option', { value: '', text: '…' }), opts.map((o, i) => h('option', { value: o, text: labels[i] || o })), h('option', { value: '__new', text: L.NEW_OPT }));
        const custom = h('input', { type: 'text', placeholder: L.NEW_OPT.replace('➕ ', '') });
        const isCustom = sel[ax.k] && !opts.includes(sel[ax.k]);
        s.value = isCustom ? '__new' : (sel[ax.k] || ''); custom.value = isCustom ? sel[ax.k] : ''; custom.hidden = !isCustom;
        s.addEventListener('change', () => { custom.hidden = s.value !== '__new'; sel[ax.k] = s.value === '__new' ? custom.value : s.value; if (ax.k === 'crisis') sel.what = ''; keep(); if (ax.k === 'crisis') render(); });
        custom.addEventListener('input', () => { sel[ax.k] = custom.value; keep(); });
        wrap.append(s, piiCheck(custom));
      }
      const sensitiveAxis = ax.k === 'crisis' || ax.k === 'what';
      wrap.append(h('label', { class: 'row muted' }, h('input', { type: 'checkbox', checked: !!g.open[ax.k], onchange: (e) => { g.open[ax.k] = e.target.checked; keep(); } }), ' ', L.SURPRISE + (sensitiveAxis ? ' · ' + Y('noSensitive') : '')));
      return wrap;
    });
    box.append(h('h3', { text: '2. ' + Y('genAxes') }), h('div', { class: 'grid3' }, axes));
    // 3. בדיקת שלמות: שלושת העמודים וששת התחומים (הצעה)
    const chk = P.checkSelection(sel);
    box.append(h('h3', { text: '3. ' + Y('genCheck') }),
      h('ul', { class: 'list' }, L.PILLARS.map((p) => h('li', {}, (chk.pillars[p.k] ? '✓ ' : '◯ ') + p.name + ': ', h('span', { class: 'muted', text: L.PILLAR_CHECK[p.k] })))),
      h('div', { class: 'row' }, chk.domains.map((d, i) => h('span', { class: 'pill' + (d.hit ? ' green' : ''), text: (d.hit ? '✓ ' : '') + L.DOMAINS[i].name }))),
      h('p', { class: 'muted', text: Y('adaptNote') }));
    // 4. בנייה
    const out = h('div', {});
    const build = h('button', { class: 'btn', type: 'button', text: Y('genBuild'), onclick: async () => {
      if (!String(sel.tests || '').trim()) { tests.focus(); toast(Y('genTests') + ': ' + T('main')); return; }
      const final = Object.assign({}, sel);
      // "הפתיעו אותנו": הכלי בוחר רק בצירים שהצוות השאיר פתוחים, ולעולם לא משבר רגשי־חברתי
      for (const ax of base.AXES) {
        if (!g.open[ax.k] || (final[ax.k] && [].concat(final[ax.k]).length)) continue;
        let opts = ax.k === 'crisis' ? base.CRISIS.filter((c) => !c.sensitive).map((c) => c.name) : ax.k === 'what' ? ((base.CRISIS.find((c) => c.name === final.crisis && !c.sensitive) || {}).what || []) : ax.opts;
        if (!opts || !opts.length) continue;
        const one = opts[Math.floor(Math.random() * opts.length)];
        final[ax.k] = ax.multi ? [one] : one;
      }
      if (!final.what && final.crisis) { const c = base.CRISIS.find((x) => x.name === final.crisis && !x.sensitive); if (c && g.open.what) final.what = c.what[0]; }
      build.disabled = true; out.replaceChildren(h('p', { class: 'muted', text: Y('working') }));
      try {
        const o = await window.sbeCallAIJson(SERVER, { system: P.generatorSystem(S.lang), messages: [{ role: 'user', content: P.generatorInput(final, S.doc) }], maxTokens: 9000, customerReview: true }, 300000, P.validScenario);
        const scn = P.normalizeScenario(o);
        const list = arr('scenarios'); const item = { id: uid('sc'), createdAt: nowIso(), by: S.by, sel: final, scn };
        list.push(item); S.doc.parts.scenarios = list; await save('scenarios', 'תרחיש חדש: ' + scn.title);
        S.genOpen = item.id; render();
      } catch (e) { out.replaceChildren(h('div', { class: 'warn', text: e && e.code === 'incomplete' ? Y('genBad') : T('noModel') })); }
      build.disabled = false;
    } });
    box.append(h('h3', { text: '4. ' + Y('genBuild') }), h('div', { class: 'row noprint' }, build), out);
    return h('div', {}, box, viewScenarios(), routineCard());
  }
  function viewScenarios() {
    const list = arr('scenarios');
    if (!list.length) return null;
    return h('div', { class: 'card' }, h('h2', { text: Y('ourScenarios') }), list.slice().reverse().map((it) => {
      const scn = it.scn;
      const open = S.genOpen === it.id;
      const edit = (getter, setter) => bindText(h('textarea', { rows: 2 }), getter, setter, 'scenarios', '');
      const body = open ? h('div', {},
        h('p', { class: 'muted', text: Y('builtBy') + (it.by ? ' · ' + it.by : '') + ' · ' + dateIL(it.createdAt) }),
        field(Y('genTests'), h('div', { text: (scn.card && scn.card.tests) || it.sel.tests || '' })),
        field(Y('intent'), edit(() => scn.intent, (v) => { scn.intent = v; })), field(Y('opening'), edit(() => scn.intro, (v) => { scn.intro = v; })),
        scn.rounds.map((R, i) => h('details', { class: 'teamcard' }, h('summary', { text: T('round') + ' ' + (i + 1) + ' · ' + R.time + ' · ' + R.title }),
          field(T('toAll'), edit(() => R.all, (v) => { R.all = v; })),
          allTeams().filter((t) => R.teams[t.id] != null).map((t) => field(t.name, edit(() => R.teams[t.id], (v) => { R.teams[t.id] = v; }))),
          field(T('decision'), edit(() => R.decision, (v) => { R.decision = v; })),
          (R.procedures || []).length ? h('p', { class: 'muted', text: L.PROC_KIND.binding + ': ' + R.procedures.map((k) => (procOf(k) || {}).topic).join(', ') }) : null,
          (R.missing || []).length ? h('p', { class: 'muted', text: L.PROC_KIND.missing + ': ' + R.missing.join(' · ') }) : null)),
        (scn.characters || []).length ? h('p', { class: 'muted', text: Y('roleplay') + ': ' + scn.characters.map((c) => c.name).join(', ') }) : null,
        h('div', { class: 'row noprint' },
          h('button', { class: 'btn', type: 'button', text: Y('runS5'), onclick: () => { S.pickScn = { 5: 'gen:' + it.id }; S.tab['mt:s5'] = 1; go('s5'); } }),
          h('button', { class: 'btn ghost', type: 'button', text: Y('runS3'), onclick: () => { S.pickScn = { 3: 'gen:' + it.id }; S.tab['mt:s3'] = 1; go('s3'); } }),
          h('button', { class: 'btn ghost', type: 'button', text: Y('printCards'), onclick: () => printCards({ scenario: 'gen', scn, title: scn.title }) }),
          h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { if (!confirm(Y('confirmDel'))) return; const l = arr('scenarios').filter((x) => x.id !== it.id); S.doc.parts.scenarios = l; save('scenarios', 'מחיקת תרחיש: ' + scn.title); render(); } }))) : null;
      return h('div', { class: 'teamcard' }, h('button', { class: 'btn ghost sm', type: 'button', 'aria-expanded': open ? 'true' : 'false', text: '🎲 ' + scn.title, onclick: () => { S.genOpen = open ? '' : it.id; render(); } }), body);
    }));
  }

  // ---------- מפת ההחלטות לפי רמות (בתוכנית) ----------
  function viewDecmap() {
    const dm = obj('decmap'); dm.rows = dm.rows || {}; S.doc.parts.decmap = dm;
    const intent = bindText(h('input', { type: 'text', placeholder: L.INTENT_EX }), () => dm.intent, (v) => { dm.intent = v; }, 'decmap', 'כוונת בית הספר');
    const rows = L.DEC_ROWS.map((r) => {
      const v = dm.rows[r.k] = dm.rows[r.k] || {};
      let who;
      if (r.fixed) {
        const m = procOf(r.proc), lv = L.DEC_LEVELS.find((l) => l.k === r.level);
        who = h('div', {}, h('b', { text: lv ? lv.name : '' }), h('div', { class: 'muted', text: L.FIXED_NOTE + (m ? ': ' + m.topic : '') }));
      } else {
        who = h('select', { 'data-closed': '', 'aria-label': L.DEC_COLS[1] + ': ' + r.text }, L.DEC_LEVELS.map((l) => h('option', { value: l.k, text: l.name })));
        who.value = v.level || r.level;
        who.addEventListener('change', () => { v.level = who.value; save('decmap', 'מפת ההחלטות: ' + r.text); });
      }
      const inp = (k) => bindText(h('textarea', { rows: 2, class: 'cell' }), () => v[k], (x) => { v[k] = x; }, 'decmap', 'מפת ההחלטות');
      return h('tr', {}, h('td', { 'data-h': L.DEC_COLS[0] }, h('b', { text: r.text })), h('td', { 'data-h': L.DEC_COLS[1] }, who),
        h('td', { 'data-h': L.DEC_COLS[2] }, inp('trigger')), h('td', { 'data-h': L.DEC_COLS[3] }, r.k === 'exitShelter' ? h('span', { class: 'muted', text: (procOf('disconnect') || {}).rule || '' }) : inp('nolink')), h('td', { 'data-h': L.DEC_COLS[4] }, inp('redline')));
    });
    const a = h('input', { type: 'date', value: dm.approvedAuth || '' }); a.onchange = () => { dm.approvedAuth = a.value; save('decmap', L.APPROVE.auth); render(); };
    const b = h('input', { type: 'date', value: dm.approvedSup || '' }); b.onchange = () => { dm.approvedSup = b.value; save('decmap', L.APPROVE.sup); render(); };
    const last = dm.approvedAuth && dm.approvedSup ? (dm.approvedAuth < dm.approvedSup ? dm.approvedAuth : dm.approvedSup) : '';
    const next = last ? new Date(Date.parse(last) + 365 * 864e5).toISOString().slice(0, 10) : '';
    return h('div', { class: 'card' }, h('h2', { text: Y('decmapT') }), h('p', { class: 'muted', text: L.DEC_INFO }),
      field(L.INTENT_Q, intent),
      h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, L.DEC_COLS.map((c) => h('th', { text: c })))), h('tbody', {}, rows)),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, field(L.APPROVE.auth, a)), h('div', { class: 'grow' }, field(L.APPROVE.sup, b)),
        h('div', { class: 'grow' }, next ? h('p', {}, h('b', { text: L.APPROVE.next + ': ' }), dateIL(next)) : null, P.decmapDue(dm) && last ? h('span', { class: 'pill red', text: L.APPROVE.due }) : null)),
      h('div', { class: 'row noprint' }, h('button', { class: 'btn ghost', type: 'button', text: Y('printDecmap'), onclick: printDecmap })));
  }
  function decmapRows() {
    const dm = obj('decmap'); const rows = dm.rows || {};
    return L.DEC_ROWS.map((r) => { const v = rows[r.k] || {}; const lv = L.DEC_LEVELS.find((l) => l.k === (r.fixed ? r.level : v.level || r.level));
      return [r.text, (lv ? lv.name : '') + (r.fixed ? ' (' + L.FIXED_NOTE + ')' : ''), v.trigger || '', r.k === 'exitShelter' ? (procOf('disconnect') || {}).rule || '' : v.nolink || '', v.redline || '']; });
  }
  function printDecmap() {
    const dm = obj('decmap');
    doPrint(Y('decmapT'), Y('decmapT'), [dm.intent ? h('p', {}, h('b', { text: Y('intent') + ': ' }), dm.intent) : null, h('h2', { text: Y('decmapT') }), tbl(L.DEC_COLS, decmapRows()),
      h('p', { text: L.APPROVE.auth + ': ' + (dateIL(dm.approvedAuth) || '____') + ' · ' + L.APPROVE.sup + ': ' + (dateIL(dm.approvedSup) || '____') }), h('p', { class: 'muted', text: L.DEC_INFO })]);
  }

  // ---------- 📅 מפגשים: חמשת המפגשים ופגישות שהצוות מתכנן ----------
  // כל מפגש: 1. סבב עדכון (טבלת המעקב) · 2. המפגש · 3. דיון וסיכום (הכלי גוזר משימות, החלטות וקצוות פתוחים)
  function meetRec(kind, key) {
    if (kind === 's') {
      const ss2 = obj('sessions'); S.doc.parts.sessions = ss2;
      const r = ss2[key] = ss2[key] || {};
      return { r, part: 'sessions', n: key, title: key + '. ' + L.SESSIONS[key - 1].title };
    }
    const list = arr('meetings'); S.doc.parts.meetings = list;
    const m = list.find((x) => x.id === key);
    return m ? { r: m, part: 'meetings', m, title: m.title || typeName(m.type) } : null;
  }
  const recIdOf = (R) => (R.m ? R.m.id : 'sess-' + R.n);
  // פריט שייך למפגש לפי המזהה שלו (srcId), ולא לפי השם: לכמה מפגשים יש אותו שם ("זמן מוכנות שבועי"). פריטים ישנים: לפי השם.
  const fromMeeting = (R) => (x) => (x.srcId ? x.srcId === recIdOf(R) : x.src === R.title);
  // המפגש הבא: תאריך המפגש ועוד הקצב של סוג המפגש
  const CADENCE = { weekly: 7, resday: 28, decide: 7, drill: 28, annual: 365, onboard: 7, other: 7 };
  function nextDefault(R) {
    if (R.r.next) return R.r.next;
    const base = R.m && R.m.date && R.m.date >= new Date().toISOString().slice(0, 10) ? new Date(R.m.date + 'T12:00:00') : new Date();
    base.setDate(base.getDate() + (CADENCE[R.m && R.m.type] || 7));
    return base.toISOString().slice(0, 10);
  }
  // צ'ק־אין: מי השתתף/ה במפגש (מתוך הצוותים של המערך, ועוד אורחים עם שם, תפקיד ומייל). הסיכום נשלח רק אליהם.
  function attendees(R) {
    const r = R.r; r.attendees = Array.isArray(r.attendees) ? r.attendees : [];
    for (const t of arr('teams')) {
      const tn = teamName(t.id);
      const ppl = [[t.lead, T('lead') + ' · ' + tn], [t.deputy, T('deputy') + ' · ' + tn]].concat((t.members || []).map((x) => [x, tn]));
      for (const [pp, role] of ppl) {
        const nm = pp && String(pp.name || '').trim(); if (!nm) continue;
        const cur = r.attendees.find((a) => !a.guest && a.name === nm);
        if (cur) { cur.role = role; cur.email = pp.email || ''; } else r.attendees.push({ name: nm, role, email: pp.email || '', here: false });
      }
    }
    return r.attendees;
  }
  function viewAttend(R) {
    const list = attendees(R), r = R.r;
    const here = list.filter((a) => a.here).length;
    const rows = list.map((a, i) => h('div', { class: 'att' }, h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: !!a.here, onchange: (e) => { a.here = e.target.checked; saveSoon(R.part, ''); render(); } }),
      a.guest ? null : h('span', {}, h('b', { text: a.name }), ' ', h('span', { class: 'muted small', text: a.role }))),
      a.guest ? h('span', { class: 'row grow' },
        bindText(h('input', { type: 'text', placeholder: Y('pName'), 'aria-label': Y('pName'), class: 'grow' }), () => a.name, (v) => { a.name = v; }, R.part, ''),
        bindText(h('input', { type: 'text', placeholder: Y('pRole'), 'aria-label': Y('pRole'), list: 'rdyRoles', class: 'grow' }), () => a.role, (v) => { a.role = v; }, R.part, ''),
        bindText(h('input', { type: 'email', placeholder: Y('pMail'), 'aria-label': Y('pMail'), class: 'grow' }), () => a.email, (v) => { a.email = v; }, R.part, ''),
        lnk('✕', () => { list.splice(i, 1); save(R.part, ''); render(); }, { 'aria-label': T('del') })) : null));
    S.att = S.att || {}; const k = recIdOf(R);
    const box = h('details', { class: 'card', open: S.att[k] == null ? !here : S.att[k] }, h('summary', { text: Y('whoHere') + ' (' + here + ')' }),
      h('p', { class: 'muted small', text: Y('whoInfo') }), rows,
      lnk(Y('addPerson'), () => { list.push({ name: '', role: '', email: '', here: true, guest: true }); save(R.part, ''); render(); }),
      h('datalist', { id: 'rdyRoles' }, allTeams().flatMap((t) => [t.name, T('lead') + ' · ' + t.name, T('deputy') + ' · ' + t.name]).map((v) => h('option', { value: v }))));
    box.addEventListener('toggle', () => { S.att[k] = box.open; });
    return box;
  }
  function viewMeeting(kind, key) {
    const R = meetRec(kind, key);
    if (!R) { S.view = 'home'; return viewHome(); }
    const main = kind === 's' ? [null, viewS1, viewS2, viewS3, viewS4, viewS5][key] : () => viewCustom(R.m);
    const head = kind === 's' ? sessionHead(key) : h('div', { class: 'mhead' }, h('h2', {}, R.title, R.m.done ? ' ✓' : ''),
      h('span', { class: 'muted small', text: dateIL(R.m.date) + (R.m.time ? ' · ' + R.m.time : '') + (R.m.title && R.m.title !== typeName(R.m.type) ? ' · ' + typeName(R.m.type) : '') }));
    const open = trackCount().open;
    return h('div', {}, head, tabs('mt:' + kind + key, [[Y('tabUpdate'), () => h('div', {}, viewAttend(R), viewUpdateRound(R))], [Y('tabMain'), main], [Y('tabTalk'), () => viewTalk(R)]], open && !(kind === 's' && key === 1) ? 0 : 1));
  }
  // סבב העדכון (04/11/2026: "צריך לעשות משהו עם הדברים שנאמרים בסבב העדכון"): כל צוות מדווח לפי תבנית הדיווח, וכותבים תוך כדי.
  // מה שנכתב לא נשאר בצד: פער ו"מה חסר לנו, וממי" הופכים לקצוות פתוחים, "הצעד הבא" למשימה של הצוות (ב"דיון וסיכום", לבחירה),
  // והדיווחים נכנסים לסיכום, לפרוטוקול שבארכיון ולמודל שגוזר מהדיון.
  // לאן כל חלק בדיווח הולך: פער ומה חסר לקצוות הפתוחים, הצעד הבא למשימות
  const REPORT_TO = { 3: 'ends', 4: 'ends', 5: 'tasks' };
  function reportTeams(R) {
    const ids = R.m && Array.isArray(R.m.teams) && R.m.teams.length ? R.m.teams : allTeams().map((t) => t.id);
    return allTeams().filter((t) => ids.includes(t.id));
  }
  const reportFilled = (rp) => !!rp && L.REPORT.some((_, i) => String(rp['r' + i] || '').trim());
  function viewUpdateRound(R) {
    const r = R.r; r.reports = r.reports && typeof r.reports === 'object' && !Array.isArray(r.reports) ? r.reports : {};
    S.rep = S.rep || {};
    const cards = reportTeams(R).map((t) => {
      const rp = r.reports[t.id] = r.reports[t.id] || {};
      const fields = L.REPORT.map((q, i) => {
        const ta = bindText(piiCheck(h('textarea', { rows: 1, class: 'cell wide', 'aria-label': q[0], placeholder: q[1] || '' })), () => rp['r' + i], (v) => { rp['r' + i] = v; }, R.part, '');
        return h('label', { class: 'rq' + (i >= 3 ? ' rq-act' : '') }, h('span', { text: q[0] + (REPORT_TO[i] ? ' → ' + L.SHEETS[REPORT_TO[i]] : '') }), ta);
      });
      const d = h('details', { class: 'rep' + (reportFilled(rp) ? ' ok' : '') }, h('summary', {}, (reportFilled(rp) ? '☑ ' : '☐ ') + t.name), h('div', { class: 'rqs' }, fields));
      if (S.rep[R.part + t.id]) d.open = true;
      d.addEventListener('toggle', () => { S.rep[R.part + t.id] = d.open; });
      return d;
    });
    const done = reportTeams(R).filter((t) => reportFilled(r.reports[t.id])).length;
    return h('div', {}, h('div', { class: 'note' }, h('b', { text: Y('updateInfo') }), h('div', { class: 'muted', text: T('report') + ': ' + L.REPORT.map((x) => x[0]).join(' · ') }), makeTimer(120)),
      h('div', { class: 'card' }, h('h3', { text: Y('repT') + ' (' + done + '/' + cards.length + ')' }), h('p', { class: 'muted small', text: Y('repInfo') }), cards,
        addTeamRow(async (id) => { if (R.m && Array.isArray(R.m.teams) && R.m.teams.length) { R.m.teams.push(id); await save('meetings', ''); } S.rep[R.part + id] = true; }),
        h('p', { class: 'small' }, lnk(Y('repGo'), () => { S.tab['mt:' + (R.m ? 'm' + R.m.id : 's' + R.n)] = 2; render(); window.scrollTo(0, 0); }, { class: 'lnk strong' }))),
      viewTrack(true));
  }
  function reportItems(R) {
    const r = R.r, out = [];
    for (const t of reportTeams(R)) {
      const rp = (r.reports || {})[t.id]; if (!rp) continue;
      for (const [i, sheet] of Object.entries(REPORT_TO)) {
        const v = String(rp['r' + i] || '').trim(); if (!v) continue;
        out.push({ sheet, pick: true, text: (i === '4' ? L.REPORT[4][0] + ': ' : i === '3' ? L.REPORT[3][0] + ': ' : '') + v, owner: fallbackOwner(t.id), team: t.id, due: sheet === 'tasks' ? nextDefault(R) : '' });
      }
    }
    return out;
  }
  function reportSaid(R) {
    return reportTeams(R).map((t) => { const rp = (R.r.reports || {})[t.id]; return reportFilled(rp) ? t.name + ': ' + L.REPORT.map((q, i) => (String(rp['r' + i] || '').trim() ? q[0] + ': ' + rp['r' + i].trim() : '')).filter(Boolean).join(' · ') : ''; }).filter(Boolean);
  }
  // תכנון פגישה חדשה: סוג לפי הטקסים, תאריך, משתתפים, וסדר היום שמתמלא לפי הסוג
  function viewNewMeeting() {
    const pre = S.newPre || {};
    const type = h('select', { 'data-closed': '', 'aria-label': Y('mType') }, L.MEET_TYPES.map((t) => h('option', { value: t.k, text: t.name })));
    type.value = pre.type || 'weekly';
    const tp = () => L.MEET_TYPES.find((t) => t.k === type.value) || L.MEET_TYPES[0];
    const when = h('p', { class: 'muted' });
    const title = piiCheck(h('input', { type: 'text', value: pre.title || '' }));
    const date = h('input', { type: 'date', value: pre.date || plus(7) });
    const time = h('input', { type: 'text', placeholder: 'למשל: 13:30', style: 'max-width:140px' });
    const agenda = piiCheck(h('textarea', { rows: 5 }));
    let touched = false;
    const fill = () => { when.textContent = Y('when') + ': ' + tp().when; if (!touched) agenda.value = tp().agenda.map((x, i) => (i + 1) + '. ' + x).join('\n'); title.placeholder = tp().name; };
    agenda.addEventListener('input', () => { touched = true; });
    type.addEventListener('change', fill); fill();
    const teams = new Set(pre.teams || allTeams().map((t) => t.id));
    const who = h('div', { class: 'row' }, allTeams().map((t) => h('label', { class: 'pill' }, h('input', { type: 'checkbox', checked: teams.has(t.id), onchange: (e) => { if (e.target.checked) teams.add(t.id); else teams.delete(t.id); } }), ' ', t.name)));
    const create = h('button', { class: 'btn', type: 'button', text: Y('createMeeting'), onclick: async () => {
      const list = arr('meetings'); S.doc.parts.meetings = list;
      const m = { id: uid('mt'), type: type.value, title: title.value.trim() && title.value.trim() !== tp().name ? title.value.trim() : '', date: date.value, time: time.value.trim(), teams: [...teams], agenda: agenda.value, notes: '', createdAt: nowIso(), by: S.by, from: pre.from || '' };
      list.push(m); create.disabled = true;
      await save('meetings', Y('newMeeting').replace('➕ ', '') + ': ' + (m.title || typeName(m.type)) + ' · ' + dateIL(m.date));
      S.newPre = null; S.tab['mt:m' + m.id] = 1; go('mt:' + m.id);
    } });
    return h('div', { class: 'card' }, h('h2', { text: Y('newMeeting').replace('➕ ', '') }),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, field(Y('mType'), type)), h('div', { class: 'grow' }, field(Y('mTitle'), title, T('opt')))), when,
      h('div', { class: 'row' }, h('div', { class: 'grow' }, field(Y('mDate'), date)), h('div', {}, field(Y('mTime'), time, T('opt')))),
      field(Y('mWho'), who), field(Y('agenda'), agenda), create);
  }
  // פגישה שתוכננה: סדר היום, ומעבר מהיר למה שהסוג שלה צריך
  function viewCustom(m) {
    const agenda = bindText(h('textarea', { rows: 6 }), () => m.agenda, (v) => { m.agenda = v; }, 'meetings', '');
    const date = h('input', { type: 'date', value: m.date || '' }); date.onchange = () => { m.date = date.value; save('meetings', ''); };
    const goBtn = (label, fn) => lnk(label, fn);
    const quick = {
      weekly: [goBtn(L.SHEETS.ends, () => go('track', 'ends'))], resday: [goBtn(L.SHEETS.tasks, () => go('track', 'tasks')), goBtn(L.SHEETS.ends, () => go('track', 'ends'))],
      decide: [goBtn(L.SHEETS.decisions, () => go('track', 'decisions')), goBtn(Y('sendDecisions'), () => go('track', 'decisions'))],
      drill: [goBtn(Y('runS3'), () => { S.tab['mt:s3'] = 1; go('s3'); })],
      annual: [goBtn(Y('decmapT'), () => { S.tab.plan = 2; go('plan'); }), goBtn(T('annexes'), () => { S.tab.plan = 1; go('plan'); })],
      onboard: [goBtn(Y('goTeams'), printTeams), goBtn(Y('teamsT'), () => { S.tab.s1 = 1; go('s1'); })], other: []
    }[m.type] || [];
    return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, field(Y('mDate'), date)), h('div', { class: 'grow muted', text: Y('mWho') + ': ' + (m.teams || []).map(teamName).join(', ') })),
      field(Y('agenda'), agenda), quick.length ? h('p', { class: 'links noprint' }, quick) : null,
      h('p', { class: 'noprint small' }, lnk(Y('delMeeting'), () => {
        if (!confirm(Y('confirmDelM'))) return; const l = arr('meetings').filter((x) => x.id !== m.id); S.doc.parts.meetings = l; save('meetings', 'מחיקת מפגש: ' + m.title); go('home'); })));
  }
  // שמות אנשי הצוות מוחלפים בתפקיד לפני שליחה למודל
  function anon(text) {
    let out = String(text || '');
    for (const tm of arr('teams')) {
      const role = teamName(tm.id);
      const ppl = [[tm.lead, T('lead') + ' · ' + role], [tm.deputy, T('deputy') + ' · ' + role]].concat((tm.members || []).map((x) => [x, role]));
      for (const [pp, label] of ppl) { const nm = pp && String(pp.name || '').trim(); if (nm && nm.length > 1) out = out.split(nm).join('[' + label + ']'); }
    }
    return out;
  }
  // 3. דיון וסיכום: מה עלה בדיון ← הכלי גוזר משימות, החלטות וקצוות ← הצוות בוחר ← טבלת המעקב; ובסוף: המפגש הבא, שליחה והדפסה
  function viewTalk(R) {
    const r = R.r;
    r.proto = Array.isArray(r.proto) ? r.proto : [];
    const recId = R.m ? R.m.id : 'sess-' + R.n;
    // 1. פרוטוקול תוך כדי: דובר/ת · עיקרי הדברים · מה זה (נאמר, החלטה, משימה, קצה פתוח)
    const KINDS = { said: Y('kSaid'), decision: Y('kDecision'), task: Y('kTask'), end: Y('kEnd') };
    const protoView = () => {
      const tb = h('tbody', {});
      const addRow = (focus) => { r.proto.push({ who: '', what: '', kind: 'said' }); saveSoon(R.part, ''); render(); if (focus) setTimeout(() => { const all = app.querySelectorAll('.proto textarea'); if (all.length) all[all.length - 1].focus(); }, 0); };
      r.proto.forEach((row, i) => {
        const kind = h('select', { 'data-closed': '', 'aria-label': Y('pKind') }, Object.entries(KINDS).map(([k, v]) => h('option', { value: k, text: v }))); kind.value = row.kind || 'said';
        kind.onchange = () => { row.kind = kind.value; save(R.part, ''); render(); };
        const what = bindText(h('textarea', { rows: 2, class: 'cell wide' }), () => row.what, (v) => { row.what = v; }, R.part, '');
        what.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && i === r.proto.length - 1) { e.preventDefault(); addRow(true); } });
        what.placeholder = Y('pWhat'); what.setAttribute('aria-label', Y('pWhat'));
        tb.append(h('tr', {}, h('td', { 'data-h': Y('pWho') }, bindText(h('input', { type: 'text', list: 'rdyPeople', placeholder: Y('pWho'), 'aria-label': Y('pWho') }), () => row.who, (v) => { row.who = v; }, R.part, '')),
          h('td', { 'data-h': Y('pKind') }, kind), h('td', { 'data-h': Y('pWhat'), class: 'what' }, what,
            row.kind === 'task' || row.kind === 'end' ? h('div', { class: 'row protoown' },
              bindText(h('input', { type: 'text', list: 'rdyPeople', placeholder: T('owner'), 'aria-label': T('owner') }), () => row.owner, (v) => { row.owner = v; }, R.part, ''),
              (() => { const d = h('input', { type: 'date', value: row.due || '', 'aria-label': row.kind === 'task' ? T('due') : T('endNext') }); d.onchange = () => { row.due = d.value; save(R.part, ''); }; return d; })()) : null),
          h('td', { class: 'noprint' }, lnk('✕', () => { r.proto.splice(i, 1); save(R.part, ''); render(); }, { 'aria-label': T('del') }))));
      });
      return h('div', { class: 'proto' }, h('p', { class: 'muted small', text: Y('protoInfo') }),
        r.proto.length ? h('table', { class: 'rt stack protot' }, h('thead', {}, h('tr', {}, [Y('pWho'), Y('pKind'), Y('pWhat'), ''].map((c) => h('th', { text: c })))), tb) : null,
        lnk(Y('addLine'), () => addRow(true)));
    };
    // 2. הקלטה בטלפון (אותה הקלטה כמו בתרגיל), והתמליל נכנס לטקסט של הדיון
    const notes = bindText(h('textarea', { rows: 4, placeholder: Y('notesPh') }), () => r.notes, (v) => { r.notes = v; }, R.part, '');
    const addToNotes = (text) => { r.notes = (r.notes ? r.notes + '\n\n' : '') + text; notes.value = r.notes; save(R.part, ''); };
    const recView = () => {
      const box = viewRec({ id: recId, rec: r.rec });
      box.querySelector('p').textContent = Y('recMeetInfo');
      box.append(h('p', {}, lnk(Y('loadToNotes'), async () => {
        const [st, o] = await api('rdyTranscriptGet', { id: S.doc.id, exId: recId });
        const segs = st === 200 && o.transcript ? o.transcript.segments || [] : [];
        if (!segs.length) { toast(Y('none2')); return; }
        addToNotes(segs.map((x) => x.text).join(' ')); r.recInNotes = true; save(R.part, ''); toast(Y('trAdded'));
      })));
      return box;
    };
    // 3. קובץ: תמליל (Zoom, Teams: vtt, srt, txt) או פרוטוקול (Word, טקסט). נקרא בדפדפן בלבד.
    const fileView = () => {
      const inp = h('input', { type: 'file', accept: '.txt,.vtt,.srt,.md,.docx', 'aria-label': Y('tFile') });
      inp.onchange = async () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        try {
          let text = '';
          if (/\.docx$/i.test(f.name)) {
            if (!window.mammoth) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
            text = (await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value;
          } else text = await f.text();
          text = text.replace(/^WEBVTT.*$/m, '').replace(/^\d+\s*$/gm, '').replace(/^[\d:.,]+\s*-->\s*[\d:.,]+.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
          if (!text) throw new Error('empty');
          addToNotes(text.slice(0, 60000)); toast(Y('fileRead'));
        } catch (e) { toast(Y('fileBad')); }
      };
      return h('div', {}, h('p', { class: 'muted small', text: Y('fileInfo') }), inp, field(Y('pasteLbl'), notes));
    };
    const out = h('div', {});
    const ex = h('button', { class: 'btn', type: 'button', text: Y('extract'), onclick: async () => {
      const typed = r.proto.filter((x) => String(x.what || '').trim());
      const direct = reportItems(R).concat(typed.filter((x) => x.kind && x.kind !== 'said').map((x) => ({ sheet: x.kind === 'task' ? 'tasks' : x.kind === 'end' ? 'ends' : 'decisions', pick: true, text: x.what.trim(), owner: personOwner(x.owner || x.who), due: x.due || '' })));
      const said = reportSaid(R).concat(typed.filter((x) => !x.kind || x.kind === 'said').map((x) => (x.who ? x.who + ': ' : '') + x.what.trim())).join('\n');
      const material = [said, String(r.notes || '').trim()].filter(Boolean).join('\n\n');
      if (!direct.length && material.length < 20) { toast(Y('noMaterial')); return; }
      ex.disabled = true; out.replaceChildren(h('p', { class: 'muted', text: Y('working') }));
      let fromAI = [];
      try {
        if (material.length >= 20) {
          const content = 'המפגש: ' + R.title + (R.m && R.m.agenda ? '\nסדר היום:\n' + anon(R.m.agenda) : '') + '\n\nמה עלה בדיון:\n' + anon(material);
          const v = await window.sbeCallAIJson(SERVER, { system: P.meetingSystem(S.lang), messages: [{ role: 'user', content }], maxTokens: 4000, fast: true }, 180000, P.validMeeting);
          const n = P.normalizeMeeting(v);
          fromAI = [].concat(n.tasks.map((x) => Object.assign({ sheet: 'tasks', pick: true }, x, { owner: personOwner(x.owner, x.team) })), n.decisions.map((x) => Object.assign({ sheet: 'decisions', pick: true }, x, { owner: personOwner(x.owner || x.by) })), n.ends.map((x) => Object.assign({ sheet: 'ends', pick: true }, x, { owner: personOwner(x.owner, x.team) })));
        }
      } catch (e) { if (!direct.length) { out.replaceChildren(h('div', { class: 'warn', text: T('noModel') })); ex.disabled = false; return; } toast(T('noModel')); }
      // מה שכבר בטבלת המעקב לא מוצע שוב (גם כשגוזרים פעם נוספת)
      const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
      const have = new Set(['actions', 'ends', 'ideas'].flatMap((k) => arr(k).map((x) => norm(x.text))));
      const seen = new Set();
      r.found = direct.concat(fromAI).filter((x) => { const k = norm(x.text); if (!k || have.has(k) || seen.has(k)) return false; seen.add(k); return true; });
      if (!r.found.length) toast(Y('nothingNew'));
      await save(R.part, ''); render();
    } });
    const found = (r.found || []).filter((x) => !x.added);
    if (found.length) {
      const sheetSel = (x) => { const sl = h('select', { 'data-closed': '', 'aria-label': Y('sheet') }, ['tasks', 'decisions', 'ends'].map((k) => h('option', { value: k, text: L.SHEETS[k] }))); sl.value = x.sheet; sl.onchange = () => { x.sheet = sl.value; saveSoon(R.part, ''); }; return sl; };
      const rows = found.map((x) => h('tr', {},
        h('td', { 'data-h': Y('pick') }, h('input', { type: 'checkbox', checked: x.pick !== false, 'aria-label': Y('pick'), onchange: (e) => { x.pick = e.target.checked; saveSoon(R.part, ''); } })),
        h('td', { 'data-h': Y('sheet') }, sheetSel(x)),
        h('td', { 'data-h': T('text'), class: 'own' }, bindText(h('textarea', { rows: 2, class: 'cell wide', 'aria-label': T('text') }), () => x.text, (v) => { x.text = v; }, R.part, '')),
        h('td', { 'data-h': T('owner'), class: 'own' }, bindText(h('input', { type: 'text', list: 'rdyPeople', placeholder: T('owner'), 'aria-label': T('owner') }), () => x.owner || '', (v) => { x.owner = v; }, R.part, ''), x.sheet !== 'decisions' ? ownerWarn(x.owner) : null,
          (() => { if (!x.due) x.due = x.sheet === 'ends' ? plus(3) : nextDefault(R); const d = h('input', { type: 'date', value: x.due, 'aria-label': x.sheet === 'ends' ? T('endNext') : T('due') }); d.onchange = () => { x.due = d.value; saveSoon(R.part, ''); }; return h('label', { class: 'fdue' }, h('span', { class: 'muted small', text: (x.sheet === 'ends' ? T('endNext') : T('due')) + ' ' }), d); })())));
      const add = h('button', { class: 'btn', type: 'button', text: Y('toTrack'), onclick: async () => {
        const before = snap(['actions', 'ends', 'ideas', R.part]);
        const acts = arr('actions'), ends = arr('ends'), ideas = arr('ideas'); let n = 0;
        for (const x of found) {
          if (x.pick === false) continue;
          const base = { id: uid(x.sheet[0]), text: x.text, src: R.title, srcId: recIdOf(R) };
          x.owner = personOwner(x.owner, x.team);
          if (x.sheet === 'tasks') acts.push(Object.assign(base, { team: x.team || '', owner: x.owner || '', due: x.due || nextDefault(R), status: 'todo' }));
          else if (x.sheet === 'ends') ends.push(Object.assign(base, { owner: x.owner || '', openedAt: nowIso(), next: x.due || plus(3), status: 'open', missed: 0, by: S.by }));
          else {
            // החלטה שהתקבלה במפגש: נוצרת גם משימה לביצוע, עם אחראי/ת ומועד, כמו "מאמצים" בדיון ההחלטות
            const a = { id: uid('a'), text: x.text, team: x.team || '', owner: x.owner || '', due: x.due || plus(14), status: 'todo', src: R.title, srcId: recIdOf(R) };
            acts.push(a);
            ideas.push(Object.assign(base, { by: x.by || '', at: nowIso(), decision: 'adopt', decidedAt: nowIso(), owner: x.owner || '', due: a.due, actionId: a.id, fromMeeting: true }));
          }
          x.added = true; n++;
        }
        S.doc.parts.actions = acts; S.doc.parts.ends = ends; S.doc.parts.ideas = ideas;
        await save('actions', ''); await save('ends', ''); await save('ideas', ''); await save(R.part, R.title + ': ' + Y('added') + ' (' + n + ')');
        render(); undoToast(Y('added') + ': ' + n, before);
      } });
      out.append(h('p', { class: 'muted', text: Y('extractInfo') }),
        h('table', { class: 'rt stack found' }, h('thead', {}, h('tr', {}, ['', Y('sheet'), T('text'), T('owner')].map((c) => h('th', { text: c })))), h('tbody', {}, rows)), add);
    }
    // הסיכום: המפגש הבא, שליחה לכולם והדפסה
    const next = h('input', { type: 'date', value: nextDefault(R) }); next.onchange = () => { r.next = next.value; save(R.part, ''); };
    const sched = h('button', { class: 'btn ghost sm', type: 'button', text: Y('scheduleNext'), onclick: () => { r.next = next.value; save(R.part, ''); S.newPre = { date: next.value, type: R.m ? R.m.type : 'weekly', teams: R.m ? R.m.teams : null, from: R.title }; go('new'); } });
    const to = attendees(R).filter((a) => a.here && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a.email || '').trim())).map((a) => a.email.trim());
    const send = h('button', { class: 'btn ghost', type: 'button', text: Y('sendTo') + ' (' + to.length + ')', onclick: async () => {
      if (!to.length) { toast(Y('noEmailYet')); S.tab['mt:' + (R.m ? 'm' + R.m.id : 's' + R.n)] = 0; render(); window.scrollTo(0, 0); return; }
      send.disabled = true;
      if (!(await save(R.part, ''))) { send.disabled = false; toast(Y('saveFirst')); return; }
      const [s2, o] = await api('rdyMail', { id: S.doc.id, meetingId: recIdOf(R), subject: Y('summaryT') + ': ' + R.title, items: [{ to, text: summaryText(R, null) }] });
      send.disabled = false;
      toast(s2 === 200 ? (o.available ? Y('mailSent') + ': ' + o.sent : T('mailOff')) : (o.error || ''));
    } });
    // סימון "הושלם": התמליל נמחק (אחרי אישור, אם עוד לא נכנס לדיון), והפרוטוקול בתיק הרציפות מתעדכן לבד
    const doneBox = h('label', { class: 'row noprint' }, h('input', { type: 'checkbox', checked: !!r.done, onchange: async (e) => {
      if (e.target.checked && r.rec && !r.recInNotes && !confirm(Y('trNotLoaded'))) { e.target.checked = false; return; }
      r.done = e.target.checked; r.at = nowIso();
      if (r.done) { api('rdyTranscriptDelete', { id: S.doc.id, exId: recId }); r.archive = archiveSnap(R); }
      await save(R.part, R.title + (r.done ? ': הושלם · ' + Y('archived') : '')); render();
    } }), ' ', T('sessionDone'));
    return h('div', {},
      h('div', { class: 'card' }, h('h2', { text: Y('docT') }), h('p', { class: 'muted small', text: Y('docInfo') }),
        tabs('doc:' + recId, [[Y('tProto'), protoView], [Y('tRec'), recView], [Y('tFile'), fileView]]),
        r.notes && S.tab['doc:' + recId] !== 2 ? h('p', { class: 'muted small', text: '📄 ' + String(r.notes).length + ' · ' + Y('pasteLbl') }) : null,
        h('div', { class: 'row noprint' }, ex), out, peopleList()),
      R.n === 3 || R.n === 5 ? contBox(Y('contAfter')) : null,
      h('div', { class: 'card' }, h('h2', { text: Y('summaryT') }),
        h('div', { class: 'row' }, h('div', {}, field(T('next1'), next)), sched),
        h('div', { class: 'row noprint' }, send, h('button', { class: 'btn ghost', type: 'button', text: Y('printSummary'), onclick: () => printMeeting(R) })),
        h('p', { class: 'noprint small' }, lnk(Y('toArchive'), async () => { r.archive = archiveSnap(R); await save(R.part, R.title + ': ' + Y('archived')); toast(Y('archived') + ' ✓'); render(); }),
          r.archive ? h('span', { class: 'muted' }, ' · ✓ ' + Y('archived') + ' ' + dateIL(r.archive.at) + ' · ', h('a', { class: 'lnk', href: 'continuity-kit.html#archive', text: Y('toCont') })) : null,
          h('span', { class: 'muted', text: ' ' }), h('span', { class: 'muted small', title: Y('archiveInfo'), text: 'ⓘ' })), doneBox));
  }
  // ארכיון הפרוטוקולים בתיק הרציפות (04/11/2026): צילום של המפגש, בלי התמליל
  function archiveSnap(R) {
    const mine = fromMeeting(R);
    return { at: nowIso(), by: S.by || '', title: R.title, date: R.m ? R.m.date || '' : String(R.r.at || nowIso()).slice(0, 10), type: R.m ? typeName(R.m.type) : '',
      attendees: attendees(R).filter((a) => a.here && a.name).map((a) => ({ name: a.name, role: a.role || '' })),
      proto: (R.r.proto || []).filter((x) => String(x.what || '').trim()).map((x) => ({ who: x.who || '', kind: x.kind || 'said', what: x.what })),
      // פרוטוקול מקובץ או טקסט שהודבק נכנס לארכיון; תמליל של הקלטה לא (הוא נמחק כשהמפגש הושלם)
      notes: !R.r.recInNotes ? String(R.r.notes || '').trim().slice(0, 20000) : '',
      reports: reportTeams(R).filter((t) => reportFilled((R.r.reports || {})[t.id])).map((t) => [t.name].concat(L.REPORT.map((_, i) => String(R.r.reports[t.id]['r' + i] || '').trim()))),
      decisions: arr('ideas').filter(mine).map((x) => x.text), tasks: arr('actions').filter(mine).map((x) => [x.text, x.owner || '', x.due || '']),
      ends: arr('ends').filter(mine).map((x) => [x.text, x.owner || '']), next: R.r.next || '' };
  }
  // מה נכנס לסיכום: ההחלטות והקצוות מהמפגש הזה, הפעולות הפתוחות (לצוות, אם נבחר) והמפגש הבא
  function summaryText(R, teamId) {
    const mine = fromMeeting(R);
    const dec = arr('ideas').filter(mine).map((x) => '• ' + x.text);
    const acts = arr('actions').filter((a) => openAct(a) && (!teamId || !a.team || a.team === teamId || a.team === 'all')).map((a) => '• ' + a.text + (a.owner ? ' · ' + a.owner : '') + (a.due ? ' · ' + dateIL(a.due) : '') + ' · ' + (L.STATUS[a.status] || ''));
    const ends = arr('ends').filter((e) => e.status !== 'closed').map((e) => '• ' + e.text + (e.owner ? ' · ' + e.owner : ''));
    const reps = reportSaid(R).map((x) => '• ' + x);
    return [R.title, reps.length ? Y('repT') + ':\n' + reps.join('\n') : '', dec.length ? L.SHEETS.decisions + ':\n' + dec.join('\n') : '', acts.length ? L.SHEETS.tasks + ':\n' + acts.join('\n') : '', ends.length ? L.SHEETS.ends + ':\n' + ends.join('\n') : '',
      R.r.next ? T('next1') + ': ' + dateIL(R.r.next) : ''].filter(Boolean).join('\n\n');
  }

  // ---------- 📋 טבלת מעקב: גיליון לכל סוג, ופריט עובר מגיליון לגיליון לפי סימון ----------
  const KIND_OF = { tasks: 'actions', ends: 'ends', decisions: 'ideas', gaps: 'gaps' };
  // פער נסגר כשהפעולה שנוצרה ממנו נבדקה בתרגיל (או בסגירה ידנית)
  function syncGaps() {
    const acts = arr('actions'); let changed = false;
    for (const g of arr('gaps')) { if (g.closed || !g.actionId) continue; const a = acts.find((x) => x.id === g.actionId); if (a && a.status === 'tested') { g.closed = true; g.closedAt = nowIso(); changed = true; } }
    if (changed) save('gaps', Y('gapsClosed'));
  }
  function viewGaps() {
    const gaps = arr('gaps'), acts = arr('actions');
    const open = gaps.filter((g) => !g.closed);
    const actOf = (g) => acts.find((a) => a.id === g.actionId);
    const st = (g) => { const a = actOf(g); return a ? L.SHEETS.tasks + ': ' + (L.STATUS[a.status] || '') + (a.owner ? ' · ' + a.owner : '') : Y('noAction'); };
    const list = MOB() ? h('ul', { class: 'mlist' }, open.map((g) => mrow(g.id, g.text, [g.src ? h('span', { text: g.src }) : null, h('span', { class: actOf(g) ? '' : 'late', text: st(g) })], [moveSel('gaps', g)],
      [field(T('text'), bindText(h('textarea', { rows: 2 }), () => g.text, (v) => { g.text = v; }, 'gaps', ''))])))
      : h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('text'), Y('kindT'), Y('linkedAct'), ''].map((c) => h('th', { text: c })))),
        h('tbody', {}, open.map((g) => h('tr', {}, h('td', { 'data-h': T('text') }, bindText(h('textarea', { rows: 2, class: 'cell wide', 'aria-label': T('text') }), () => g.text, (v) => { g.text = v; }, 'gaps', '')),
          h('td', { 'data-h': Y('kindT'), text: g.src || dateIL(g.at) }), h('td', { 'data-h': Y('linkedAct'), text: st(g) }), h('td', { class: 'noprint' }, moveSel('gaps', g))))));
    return h('div', { class: 'card' }, h('h2', { text: L.SHEETS.gaps }), h('p', { class: 'muted small', text: Y('gapsInfo') }), open.length ? list : h('p', { class: 'muted', text: Y('none2') }));
  }
  function viewTrack(compact) {
    S.doc.parts.actions = arr('actions'); S.doc.parts.ends = arr('ends'); S.doc.parts.ideas = arr('ideas');
    fixOwners();
    S.doc.parts.gaps = arr('gaps'); syncGaps();
    const count = (sh) => ['actions', 'ends', 'ideas', 'gaps'].reduce((n, k) => n + arr(k).filter((x) => P.sheetOf(k, x) === sh).length, 0);
    const keys = ['tasks', 'decisions', 'ends', 'gaps', 'done'].concat(compact ? [] : ['log']);
    const cur = keys.includes(S.sheet) ? S.sheet : 'tasks';
    const bar = h('div', { class: 'tabs noprint sbe-no-theme', role: 'tablist', 'aria-label': Y('trackT') }, keys.map((k) => h('button', { type: 'button', role: 'tab', 'aria-selected': k === cur ? 'true' : 'false',
      tabindex: k === cur ? '0' : '-1', onclick: () => { S.sheet = k; render(); } }, k === 'log' ? T('log') : L.SHEETS[k], k === 'log' ? null : h('span', { class: 'pill', text: String(count(k)) }))));
    tabKeys(bar, (j) => { S.sheet = keys[j]; render(); });
    setTimeout(() => { const sel = bar.querySelector('[aria-selected="true"]'); if (sel && bar.scrollWidth > bar.clientWidth) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, 0);
    const body = cur === 'decisions' ? viewIdeas() : cur === 'gaps' ? viewGaps() : cur === 'ends' ? viewEnds() : cur === 'done' ? viewDone() : cur === 'log' ? viewLog() : viewActions();
    return h('div', {}, bar, people().length ? null : h('p', { class: 'muted small' }, Y('noPeople') + ' ', lnk(Y('teamsT'), () => { S.tab.s1 = 1; go('s1'); })), h('div', { role: 'tabpanel', 'aria-label': cur === 'log' ? T('log') : L.SHEETS[cur] }, body), peopleList());
  }
  function moveSel(kind, it) {
    const here = P.sheetOf(kind, it);
    const sl = h('select', { 'data-closed': '', 'aria-label': Y('moveTo') }, h('option', { value: '', text: Y('moveTo') + '…' }),
      Object.keys(L.SHEETS).filter((k) => k !== here).map((k) => h('option', { value: k, text: L.SHEETS[k] })));
    sl.onchange = () => { const to = sl.value; sl.value = ''; if (to) moveItem(kind, it, to); };
    return sl;
  }
  async function moveItem(kind, it, to) {
    const before = snap(['actions', 'ends', 'ideas', 'gaps']);
    const from = arr(kind); S.doc.parts[kind] = from;
    if (to === 'done') {
      if (kind === 'actions') { if (!confirm(Y('confirmTested'))) return; it.status = 'tested'; }
      else if (kind === 'ends') { if (!confirm(Y('confirmClose'))) return; it.status = 'closed'; it.closedAt = nowIso(); }
      else if (kind === 'gaps') { if (!confirm(Y('confirmClose'))) return; it.closed = true; it.closedAt = nowIso(); }
      else it.done = true;
      it.doneAt = nowIso();
      await save(kind, L.SHEETS.done + ': ' + String(it.text || '').slice(0, 60)); render(); undoToast(L.SHEETS.done, before); return;
    }
    const target = KIND_OF[to];
    if (target === kind) { // חזרה מהושלמו
      if (kind === 'actions') it.status = it.status === 'cancelled' ? 'todo' : 'done'; else if (kind === 'ends') it.status = 'open'; else if (kind === 'gaps') it.closed = false; else it.done = false;
      await save(kind, Y('moveTo') + ': ' + L.SHEETS[to] + ': ' + String(it.text || '').slice(0, 60)); render(); undoToast(Y('moveTo') + ': ' + L.SHEETS[to], before); return;
    }
    const base = { id: uid(target[0]), text: it.text || '', src: it.src || '', srcId: it.srcId || '' }, owner = it.owner || '';
    const item = target === 'actions' ? Object.assign(base, { team: it.team || '', owner, due: it.due || String(it.next || '').slice(0, 10) || plus(14), status: 'todo' })
      : target === 'ends' ? Object.assign(base, { owner, openedAt: nowIso(), next: plus(3), status: 'open', missed: 0, by: S.by })
        : Object.assign(base, { by: it.by || S.by, at: nowIso(), decision: '', owner, due: it.due || '' });
    const i = from.indexOf(it); if (i >= 0) from.splice(i, 1);
    const dst = arr(target); dst.push(item); S.doc.parts[target] = dst;
    await save(kind, Y('moveTo') + ': ' + L.SHEETS[to] + ': ' + String(item.text).slice(0, 60)); await save(target, ''); render();
    undoToast(Y('moveTo') + ': ' + L.SHEETS[to], before);
  }
  function viewDone() {
    const rows = [];
    for (const k of ['actions', 'ends', 'ideas', 'gaps']) for (const it of arr(k)) if (P.sheetOf(k, it) === 'done') rows.push([k, it]);
    const label = { actions: L.SHEETS.tasks, ends: L.SHEETS.ends, ideas: L.SHEETS.decisions, gaps: L.SHEETS.gaps };
    return h('div', { class: 'card' }, h('h2', { text: L.SHEETS.done }),
      rows.length ? h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('text'), Y('kindT'), T('owner'), Y('closedAt'), ''].map((c) => h('th', { text: c })))),
        h('tbody', {}, rows.map(([k, it]) => h('tr', {}, h('td', { 'data-h': T('text'), text: it.text || '' }), h('td', { 'data-h': Y('kindT'), text: (it.status === 'cancelled' ? L.STATUS.cancelled + (it.cancelWhy ? ': ' + it.cancelWhy : '') : label[k]) + (it.src ? ' · ' + it.src : '') }),
          h('td', { 'data-h': T('owner'), text: it.owner || '' }), h('td', { 'data-h': Y('closedAt'), text: dateIL(it.doneAt || it.closedAt || '') }), h('td', { class: 'noprint' }, moveSel(k, it)))))) : h('p', { class: 'muted', text: Y('none2') }));
  }

  // ---------- דיון החלטות (גיליון ההחלטות בטבלת המעקב) ----------
  function viewIdeas() {
    const ideas = arr('ideas'); S.doc.parts.ideas = ideas;
    const exs = arr('exercises').filter((x) => x.report && x.report.approvedAt);
    const heads = exs.map((ex) => { const st = P.ideasState(ideas, ex); return st.total ? h('div', { class: st.late ? 'warn' : 'note' }, h('b', { text: ex.title + ' · ' + dateIL(ex.report.approvedAt) + ': ' }),
      Y('discussBy') + ' ' + dateIL(st.by) + ' · ' + st.open + ' ' + Y('ideasOpen') + (st.late ? ' · ' + T('late') : '')) : null; });
    const markCycle = () => {
      let changed = false;
      for (const ex of exs) { const st = P.ideasState(ideas, ex); if (st.total && !st.open && !ex.ideasDecidedAt) { ex.ideasDecidedAt = nowIso(); changed = true; } }
      if (changed) save('exercises', 'דיון ההחלטות הושלם');
    };
    const rows = ideas.filter((it) => !it.done).map((it) => {
      const i = ideas.indexOf(it);
      const dec = h('select', { 'data-closed': '' }, h('option', { value: '', text: '…' }), Object.entries(L.IDEA_DEC).map(([k, v]) => h('option', { value: k, text: v })));
      dec.value = it.decision || '';
      dec.onchange = async () => {
        it.decision = dec.value; it.decidedAt = nowIso();
        if (it.decision === 'adopt' && !it.actionId) {
          const acts = arr('actions'); const a = { id: uid('a'), text: it.text + (it.ifThen ? ' · ' + it.ifThen : ''), team: '', owner: it.owner || '', due: it.due || plus(14), status: 'todo', src: Y('ideasT') };
          acts.push(a); S.doc.parts.actions = acts; it.actionId = a.id; await save('actions', '');
        }
        if (it.decision === 'check' && !it.due) it.due = plus(14);
        await save('ideas', 'דיון החלטות: ' + (L.IDEA_DEC[it.decision] || '') + ': ' + String(it.text).slice(0, 60));
        markCycle(); render();
      };
      const due = h('input', { type: 'date', value: it.due || '' }); due.onchange = () => { it.due = due.value; save('ideas', ''); };
      const needWhy = it.decision === 'reject' && !String(it.answer || '').trim();
      return h('tr', {},
        h('td', { 'data-h': L.IDEA_COLS[0] }, bindText(h('textarea', { rows: 2, class: 'cell' }), () => it.text + (it.ifThen && !it.edited ? ' · ' + it.ifThen : ''), (v) => { it.text = v; it.edited = true; }, 'ideas', '')),
        h('td', { 'data-h': L.IDEA_COLS[1] }, bindText(h('input', { type: 'text' }), () => it.by, (v) => { it.by = v; }, 'ideas', '')),
        h('td', { 'data-h': L.IDEA_COLS[2] }, dec),
        h('td', { 'data-h': L.IDEA_COLS[3] }, bindText(h('textarea', { rows: 2, class: 'cell', placeholder: it.decision === 'reject' ? Y('whyNot') : '' }), () => it.answer, (v) => { it.answer = v; }, 'ideas', ''), needWhy ? h('span', { class: 'pill red', text: Y('whyNot') }) : null),
        h('td', { 'data-h': L.IDEA_COLS[4] }, bindText(h('input', { type: 'text', list: 'rdyPeople' }), () => it.owner, (v) => { it.owner = v; }, 'ideas', ''), it.decision === 'adopt' || it.decision === 'check' ? ownerWarn(it.owner) : null),
        h('td', { 'data-h': L.IDEA_COLS[5] }, due),
        h('td', { class: 'noprint' }, moveSel('ideas', it), ' ', lnk(T('del'), () => { const before = snap(['ideas']); ideas.splice(i, 1); save('ideas', T('del') + ': ' + String(it.text || '').slice(0, 60)); render(); undoToast(T('del'), before); }, { class: 'lnk muted small' })));
    });
    const sendAll = h('button', { class: 'btn ghost', type: 'button', text: Y('sendDecisions'), onclick: async () => {
      const decided = ideas.filter((x) => x.decision);
      if (!decided.length) { toast(Y('none2')); return; }
      const text = decided.map((x) => '• ' + x.text + ': ' + L.IDEA_DEC[x.decision] + (x.answer ? ' (' + x.answer + ')' : '') + (x.owner ? ' · ' + T('owner') + ': ' + x.owner : '') + (x.due ? ' · ' + dateIL(x.due) : '')).join('\n');
      sendAll.disabled = true;
      const [s2, o] = await api('rdyMail', { id: S.doc.id, subject: Y('ideasT'), items: allTeams().map((t) => ({ teamId: t.id, text })) });
      sendAll.disabled = false;
      toast(s2 === 200 ? (o.available ? Y('mailSent') + ': ' + o.sent : T('mailOff')) : (o.error || ''));
    } });
    return h('div', { class: 'card' }, h('h2', { text: Y('ideasT') }), h('p', { class: 'muted', text: L.IDEA_INFO }), heads,
      rows.length ? h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, L.IDEA_COLS.map((c) => h('th', { text: c })), h('th', { class: 'noprint' }))), h('tbody', {}, rows)) : h('p', { class: 'muted', text: Y('none2') }),
      h('div', { class: 'row noprint' }, h('button', { class: 'btn ghost sm', type: 'button', text: T('add'), onclick: () => { ideas.push({ id: uid('i'), text: '', at: nowIso(), decision: '', by: S.by }); save('ideas', ''); render(); } }), sendAll,
        h('button', { class: 'btn ghost', type: 'button', text: Y('printIdeas'), onclick: () => doPrint(Y('ideasT'), Y('ideasT'), [h('h2', { text: Y('ideasT') }), tbl(L.IDEA_COLS, ideas.map((x) => [x.text, x.by || '', L.IDEA_DEC[x.decision] || '', x.answer || '', x.owner || '', dateIL(x.due)]))]) })));
  }

  // ---------- צד: קצוות פתוחים, פעולות, רישום ----------
  function addEnd(text, team, src) {
    const ends = arr('ends');
    ends.push({ id: uid('e'), text: String(text || ''), owner: fallbackOwner(team), openedAt: nowIso(), next: plus(1), status: 'open', missed: 0, src: src || '', by: S.by });
    S.doc.parts.ends = ends; save('ends', 'קצה פתוח: ' + String(text).slice(0, 80)); toast(Y('toEnds') + ' ✓');
  }
  // טבלת המעקב בטלפון (04/11/2026, אחרי צילום המסך): שורה קצרה לכל פריט, מה · מי · עד מתי, ושינוי מצב במקום.
  // העריכה המלאה נפתחת רק בפריט שבוחרים ("עריכה"), כדי שלא תהיה גלילה ארוכה של טפסים.
  const MOB = () => !!(window.matchMedia && window.matchMedia('screen and (max-width:640px)').matches);
  function mrow(id, title, meta, quick, form) {
    const open = S.edit === id;
    return h('li', { class: 'mrow' + (open ? ' open' : '') },
      h('div', { class: 'mtext', text: String(title || '').trim() || '…' }),
      h('div', { class: 'mmeta' }, meta.filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x]))),
      h('div', { class: 'mq' }, quick, lnk(open ? Y('closeT') : Y('editT'), () => { S.edit = open ? '' : id; render(); })),
      open ? h('div', { class: 'mform' }, form) : null);
  }
  const lateDate = (iso) => !!iso && String(iso).slice(0, 10) < new Date().toISOString().slice(0, 10);
  function viewEnds() {
    const ends = arr('ends'); S.doc.parts.ends = ends;
    const open = ends.filter((e) => e.status !== 'closed');
    const row = (e) => {
      const state = P.endState(e);
      const next = h('input', { type: 'date', value: String(e.next || '').slice(0, 10) });
      next.onchange = () => { if (state === 'late' || state === 'escalate') e.missed = (e.missed || 0) + 1; e.next = next.value; save('ends', ''); render(); };
      const st = h('select', { 'data-closed': '' }, Object.entries(L.END_STATUS).map(([k, v]) => h('option', { value: k, text: v }))); st.value = e.status || 'open';
      st.onchange = () => { const before = snap(['ends']); if (st.value === 'closed' && !confirm(Y('confirmClose'))) { st.value = e.status; return; } if (st.value === 'closed') { e.closedAt = nowIso(); e.closedLate = state === 'late' || state === 'escalate'; } e.status = st.value; save('ends', (st.value === 'closed' ? 'קצה נסגר: ' : L.END_STATUS[st.value] + ': ') + String(e.text).slice(0, 80)); render(); undoToast(L.END_STATUS[st.value], before); };
      return h('tr', {},
        h('td', { 'data-h': T('text') }, bindText(h('textarea', { rows: 2, class: 'cell wide' }), () => e.text, (v) => { e.text = v; }, 'ends', '')),
        h('td', { 'data-h': T('endOpened'), text: e.src || dateIL(e.openedAt) }),
        h('td', { 'data-h': T('owner') }, bindText(h('input', { type: 'text', list: 'rdyPeople' }), () => e.owner, (v) => { e.owner = v; }, 'ends', '')),
        h('td', { 'data-h': T('endNext') }, next),
        h('td', { 'data-h': T('endState') }, st, moveSel('ends', e),  state === 'noOwner' ? h('span', { class: 'pill red', text: T('noOwner') }) : state === 'escalate' ? h('span', { class: 'pill red', text: Y('escalate') }) : state === 'late' ? h('span', { class: 'pill red', text: T('late') }) : null));
    };
    const mob = (e) => {
      const state = P.endState(e);
      const next = h('input', { type: 'date', value: String(e.next || '').slice(0, 10), 'aria-label': T('endNext') });
      next.onchange = () => { if (state === 'late' || state === 'escalate') e.missed = (e.missed || 0) + 1; e.next = next.value; save('ends', ''); render(); };
      const st = h('select', { 'data-closed': '', class: 'msel', 'aria-label': T('endState') }, Object.entries(L.END_STATUS).map(([k, v]) => h('option', { value: k, text: v }))); st.value = e.status || 'open';
      st.onchange = () => { const before = snap(['ends']); if (st.value === 'closed' && !confirm(Y('confirmClose'))) { st.value = e.status; return; } if (st.value === 'closed') { e.closedAt = nowIso(); e.closedLate = state === 'late' || state === 'escalate'; } e.status = st.value; save('ends', (st.value === 'closed' ? 'קצה נסגר: ' : L.END_STATUS[st.value] + ': ') + String(e.text).slice(0, 80)); render(); undoToast(L.END_STATUS[st.value], before); };
      const warn = state === 'noOwner' ? '' : state === 'escalate' ? Y('escalate') : state === 'late' ? T('late') : '';
      return mrow(e.id, e.text, [h('span', { text: !notPerson(e.owner) ? e.owner : emRole() }), e.next ? h('span', { class: lateDate(e.next) ? 'late' : '', text: T('endNext') + ' ' + dateIL(e.next) }) : null, warn ? h('span', { class: 'late', text: warn }) : null],
        [st, moveSel('ends', e)],
        [field(T('text'), bindText(h('textarea', { rows: 2 }), () => e.text, (v) => { e.text = v; }, 'ends', '')),
          field(T('owner'), bindText(h('input', { type: 'text', list: 'rdyPeople' }), () => e.owner, (v) => { e.owner = v; }, 'ends', '')),
          field(T('endNext'), next), h('p', { class: 'muted small', text: T('endOpened') + ': ' + (e.src || dateIL(e.openedAt)) })]);
    };
    const head = h('thead', {}, h('tr', {}, [T('text'), T('endOpened'), T('owner'), T('endNext'), T('endState')].map((x) => h('th', { text: x }))));
    return h('div', { class: 'card' }, h('h2', { text: T('ends') }),
      open.length ? (MOB() ? h('ul', { class: 'mlist' }, open.map(mob)) : h('table', { class: 'rt stack' }, head, h('tbody', {}, open.map(row)))) : h('p', { class: 'muted', text: Y('none2') }),
      h('p', { class: 'noprint' }, lnk(T('add'), () => { addEnd('', '', ''); const l = arr('ends'); S.edit = l.length ? l[l.length - 1].id : ''; render(); })));
  }
  // שינוי סטטוס של פעולה: "נבדק בתרגיל" באישור; "בוטלה" עם סיבה (רשות), והפעולה עוברת להושלמו לתיעוד; תמיד אפשר לבטל את השינוי
  function actStatus(a, st) {
    const was = a.status || 'todo', before = snap(['actions']);
    if (st.value === 'tested' && !confirm(Y('confirmTested'))) { st.value = was; return; }
    if (st.value === 'cancelled') { const why = window.prompt(Y('cancelWhy'), ''); if (why === null) { st.value = was; return; } a.cancelWhy = String(why).trim().slice(0, 200); }
    a.status = st.value; if (a.status === 'tested' || a.status === 'cancelled') a.doneAt = nowIso();
    save('actions', 'פעולה: ' + L.STATUS[a.status] + ': ' + String(a.text).slice(0, 60)); render();
    undoToast(L.STATUS[a.status], before);
  }
  function viewActions() {
    const acts = arr('actions'); S.doc.parts.actions = acts;
    const teamSel = (a) => { const s = h('select', { 'data-closed': '', 'aria-label': T('team') }, h('option', { value: '', text: '…' }), [...allTeams().map((t) => h('option', { value: t.id, text: t.name })), h('option', { value: 'all', text: Y('allTeams') })]); s.value = a.team || ''; s.onchange = () => { a.team = s.value; save('actions', ''); }; return s; };
    const rows = acts.filter((a) => P.sheetOf('actions', a) === 'tasks').map((a) => {
      const i = acts.indexOf(a);
      const st = h('select', { 'data-closed': '' }, Object.entries(L.STATUS).map(([k, v]) => h('option', { value: k, text: v }))); st.value = a.status || 'todo';
      st.onchange = () => actStatus(a, st);
      const due = h('input', { type: 'date', value: a.due || '' }); due.onchange = () => { a.due = due.value; save('actions', ''); };
      st.setAttribute('aria-label', T('status')); due.setAttribute('aria-label', T('due'));
      return h('tr', {}, h('td', { 'data-h': T('text') }, bindText(h('textarea', { rows: 2, class: 'cell wide', 'aria-label': T('text') }), () => a.text, (v) => { a.text = v; }, 'actions', '')),
        h('td', { 'data-h': T('team') }, teamSel(a)), h('td', { 'data-h': T('owner') }, bindText(h('input', { type: 'text', list: 'rdyPeople', 'aria-label': T('owner') }), () => a.owner, (v) => { a.owner = v; }, 'actions', ''), ownerWarn(a.owner)),
        h('td', { 'data-h': T('due') }, due), h('td', { 'data-h': T('status') }, st),
        h('td', { class: 'noprint' }, moveSel('actions', a), ' ', lnk(T('del'), () => { const before = snap(['actions']); acts.splice(i, 1); save('actions', T('del') + ': ' + String(a.text || '').slice(0, 60)); render(); undoToast(T('del'), before); }, { class: 'lnk muted small' })));
    });
    const mob = (a) => {
      const i = acts.indexOf(a);
      const st = h('select', { 'data-closed': '', class: 'msel', 'aria-label': T('status') }, Object.entries(L.STATUS).map(([k, v]) => h('option', { value: k, text: v }))); st.value = a.status || 'todo';
      st.onchange = () => actStatus(a, st);
      const due = h('input', { type: 'date', value: a.due || '', 'aria-label': T('due') }); due.onchange = () => { a.due = due.value; save('actions', ''); render(); };
      const late = lateDate(a.due) && a.status !== 'done' && a.status !== 'tested';
      const who = h('span', { text: (!notPerson(a.owner) ? a.owner : emRole()) + (a.team && a.team !== 'all' ? ' · ' + teamName(a.team) : '') });
      return mrow(a.id, a.text, [who, a.due ? h('span', { class: late ? 'late' : '', text: T('due') + ' ' + dateIL(a.due) + (late ? ' · ' + T('late') : '') }) : null],
        [st, moveSel('actions', a)],
        [field(T('text'), bindText(h('textarea', { rows: 2 }), () => a.text, (v) => { a.text = v; }, 'actions', '')),
          field(T('team'), teamSel(a)), field(T('owner'), bindText(h('input', { type: 'text', list: 'rdyPeople' }), () => a.owner, (v) => { a.owner = v; }, 'actions', '')),
          field(T('due'), due), h('p', { class: 'small' }, lnk(T('del'), () => { const before = snap(['actions']); acts.splice(i, 1); S.edit = ''; save('actions', T('del') + ': ' + String(a.text || '').slice(0, 60)); render(); undoToast(T('del'), before); }, { class: 'lnk muted' }))]);
    };
    const mine = acts.filter((a) => P.sheetOf('actions', a) === 'tasks');
    return h('div', { class: 'card' }, h('h2', { text: T('actions') }),
      h('p', { class: 'muted', text: L.STATUS.tested + ': ' + (S.lang === 'ar' ? 'يُغلق الإجراء فقط بعد فحصه في تمرين أو في يوم الصمود.' : 'פעולה נסגרת רק אחרי שנבדקה בתרגיל או ביום החוסן.') }),
      rows.length ? (MOB() ? h('ul', { class: 'mlist' }, mine.map(mob)) : h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('text'), T('team'), T('owner'), T('due'), T('status'), ''].map((x) => h('th', { text: x })))), h('tbody', {}, rows))) : h('p', { class: 'muted', text: Y('none2') }),
      h('p', { class: 'noprint' }, lnk(T('add'), () => { const a = { id: uid('a'), text: '', team: '', owner: fallbackOwner(''), due: plus(14), status: 'todo' }; acts.push(a); S.edit = a.id; save('actions', ''); render(); })));
  }
  function viewLog() {
    const log = (S.doc.log || []).slice().reverse();
    return h('div', { class: 'card' }, h('h2', { text: T('log') }),
      log.length ? h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [Y('when'), T('fullName'), T('text')].map((x) => h('th', { text: x })))),
        h('tbody', {}, log.map((l) => h('tr', {}, h('td', { 'data-h': Y('when'), text: dateIL(l.at) + ' ' + String(l.at || '').slice(11, 16) }), h('td', { 'data-h': T('fullName'), text: l.by || '' }), h('td', { 'data-h': T('text'), text: l.what || '' }))))) : h('p', { class: 'muted', text: Y('none2') }));
  }

  // ---------- הדפסות (SBE_DOC.print: לוגו, שוליים, כותרת טבלה חוזרת) ----------
  const tbl = (cols, rows) => h('table', { class: 'rtable' }, h('thead', {}, h('tr', {}, cols.map((c) => h('th', { text: c })))), h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', { text: c == null ? '' : String(c) }))))));
  function doPrint(title, kind, nodes) {
    if (!window.SBE_DOC) return window.print();
    const node = h('div', {}, nodes, h('p', { class: 'muted', text: L.TABLETOP_NOTE }));
    window.SBE_DOC.print({ title, subtitle: parts().profile?.name || '', kind, node });
  }
  function printTeams() {
    const teams = arr('teams');
    doPrint(Y('teamsT'), Y('teamsT'), [h('h2', { text: Y('teamsT') }),
      tbl([T('team'), T('lead'), T('deputy'), T('members')], teams.map((t) => [teamName(t.id) || t.name, t.lead && t.lead.name, t.deputy && t.deputy.name, (t.members || []).map((m) => m.name).filter(Boolean).join(', ')])),
      h('h2', { text: L.TEAMS[0].lead.split(',')[0] }), tbl([T('emDoes'), T('emDoesnt')], Array.from({ length: Math.max((obj('em').does || []).length, (obj('em').doesnt || []).length) }, (_, i) => [(obj('em').does || [])[i], (obj('em').doesnt || [])[i]])),
      h('h2', { text: T('mine') }), tbl([T('text'), Y('when'), T('team')], arr('tasks').map((t) => [t.text, L.WHEN[t.when], teamName(t.team)]))]);
  }
  function printPlan() {
    const plan = obj('plan');
    doPrint(T('tool'), Y('printPlan').replace('🖨 ', ''), [
      h('h2', { text: 'REMS' }), tbl([Y('step'), Y('ourText')], L.REMS.map((r) => [r.n + '. ' + r.title, (plan.steps || {})[r.n] || ''])),
      h('h2', { text: T('annexes') }), tbl([T('annexes'), T('team'), T('maturity'), Y('annexText')], (plan.annexes || []).map((a) => [a.name, teamName(a.team), L.MATURITY[a.maturity] || '', a.text || ''])),
      plan.premortem ? h('div', {}, h('h2', { text: T('premortem') }), h('p', { text: plan.premortem })) : null,
      h('h2', { text: T('log') }), tbl([Y('when'), T('fullName'), T('text')], (S.doc.log || []).slice(-40).map((l) => [dateIL(l.at), l.by, l.what]))]);
  }
  function printCards(ex) {
    const scn = scnOf(ex || curEx(3));
    doPrint(scn.title, Y('printCards').replace('🖨 ', ''), scenarioNodes(scn));
  }
  function scenarioNodes(scn) {
    const cards = [h('p', { text: scn.intro || '' })];
    if (scn.card && scn.card.tests) cards.unshift(tbl([Y('genTests'), Y('success')], [[scn.card.tests, (scn.card.success || []).join(' · ')]]));
    for (const R of scn.rounds) {
      cards.push(h('h2', { text: T('round') + ' ' + R.n + (R.time ? ' · ' + R.time : '') + ' · ' + R.title }));
      cards.push(tbl([T('team'), T('round') + ' ' + R.n], [[T('toAll'), R.all], ...allTeams().filter((t) => R.teams[t.id]).map((t) => [t.name, R.teams[t.id]])]));
      cards.push(h('p', {}, h('b', { text: T('decision') + ': ' }), R.decision || ''));
      for (const k of R.procedures || []) { const m = procOf(k); if (m) cards.push(tbl([L.PROC_KIND.binding, m.topic], [[m.rule, m.source + ' · ' + L.VERIFY]])); }
      for (const miss of R.missing || []) cards.push(tbl([L.PROC_KIND.missing], [[miss]]));
      if (R.alts) cards.push(tbl([T('alt'), T('allows'), T('gives')], R.alts));
    }
    if (scn.rounds.some((R) => R.callHelp)) cards.push(h('h2', { text: T('callHelp') }), h('ol', {}, L.SIRENS.callHelp.map((x) => h('li', { text: x }))));
    if (scn.hardTalk && scn.hardTalk.q) cards.push(h('h2', { text: T('hardTalk') }), h('p', { text: scn.hardTalk.q }), h('ul', {}, (scn.hardTalk.feedback || []).map((x) => h('li', { text: x }))));
    if ((scn.characters || []).length) cards.push(h('h2', { text: Y('roleplay') }), tbl([Y('character'), T('text')], scn.characters.map((c) => [c.name, c.brief])));
    return cards;
  }
  function printReport(ex) { doPrint(T('reportT') + ' · ' + ex.title, T('reportT'), reportNodes(ex)); }
  function reportNodes(ex) {
    const rep = ex.report || { rows: [] }, v = ex.draft || {};
    return [
      h('p', { text: dateIL(ex.startedAt) + ' · ' + ex.title + (rep.approvedAt ? ' · ' + T('approved') + ' ' + dateIL(rep.approvedAt) : '') }),
      (v.worked || []).length ? h('div', {}, h('h2', { text: Y('worked') }), h('ul', {}, v.worked.map((x) => h('li', { text: x })))) : null,
      h('h2', { text: T('reportT') }), tbl(L.REPORT_COLS, rep.rows.map((r) => [r.topic, r.planned, r.happened, r.how, L.KEEP[r.keep] || '', r.action, r.owner, dateIL(r.due)])),
      (v.ideas || []).length ? h('div', {}, h('h2', { text: T('ideas') }), tbl([T('text'), T('ifThen')], v.ideas.map((x) => [x.text, x.ifThen]))) : null,
      (v.feedback || []).length ? h('div', {}, h('h2', { text: Y('fb') }), tbl([T('text'), Y('src')], v.feedback.map((x) => [x.text, srcLabel(x.source)]))) : null];
  }
  // תיקיית הרציפות המודפסת: מה שצריך להיות ביד כשאין חשמל או רשת
  function protocolNodes(a) {
    const KIND = { said: '', decision: L.SHEETS.decisions, task: L.SHEETS.tasks, end: L.SHEETS.ends };
    return [h('h3', { text: a.title + (a.date ? ' · ' + dateIL(a.date) : '') }),
      a.attendees.length ? h('p', {}, h('b', { text: Y('attendT') + ': ' }), a.attendees.map((x) => x.name + (x.role ? ' (' + x.role + ')' : '')).join(' · ')) : null,
      a.reports && a.reports.length ? tbl([T('team')].concat(L.REPORT.map((q) => q[0])), a.reports) : null,
      a.proto.length ? tbl([Y('pWho'), Y('pKind'), Y('pWhat')], a.proto.map((x) => [x.who, KIND[x.kind] || '', x.what])) : null,
      a.decisions.length ? tbl([L.SHEETS.decisions], a.decisions.map((x) => [x])) : null,
      a.tasks.length ? tbl([L.SHEETS.tasks, T('owner'), T('due')], a.tasks.map((x) => [x[0], x[1], dateIL(x[2])])) : null,
      a.ends.length ? tbl([L.SHEETS.ends, T('owner')], a.ends) : null,
      a.notes ? h('p', { style: 'white-space:pre-line', text: a.notes }) : null,
      a.next ? h('p', {}, h('b', { text: T('next1') + ': ' }), dateIL(a.next)) : null];
  }
  function archives() {
    const out = [];
    const ss = obj('sessions'); for (const n of Object.keys(ss)) if (ss[n] && ss[n].archive) out.push(ss[n].archive);
    for (const m of arr('meetings')) if (m.archive) out.push(m.archive);
    return out.sort((a, b) => String(b.date || b.at).localeCompare(String(a.date || a.at)));
  }
  function printBinder() {
    const teams = arr('teams'), em = obj('em'), plan = obj('plan'), dm = obj('decmap');
    const openActs = arr('actions').filter(openAct), openEnds = arr('ends').filter((e) => e.status !== 'closed');
    // מה מוסיפים לתיקייה: לכל פריט מה כבר עלה למערכת (שם ותאריך עדכון), או איפה הוא נשמר בבית הספר
    const files = (S.doc && S.doc.files) || {}, bd = obj('binder'), where = bd.where || {};
    const MANUAL = binderItems(bd).map((it) => {
      const f = files[it.key], w = where[it.key];
      const st = f ? '📎 ' + f.title + ' · ' + Y('bUpdated') + ' ' + dateIL(f.date) : w && w.place ? Y('bWhere') + ': ' + w.place + (w.date ? ' · ' + Y('bUpdated') + ' ' + dateIL(w.date) : '') : '';
      return h('li', {}, (st ? '☑ ' : '☐ ') + it.text, st ? h('div', { class: 'muted small', text: st }) : null);
    });
    const sec = (title, cols, rows, extra) => (rows.length ? [h('h2', { text: title }), extra || null, tbl(cols, rows)] : []);
    const teamRows = teams.filter((t) => (t.lead && t.lead.name) || (t.deputy && t.deputy.name) || (t.members || []).some((m) => m.name)).map((t) => [teamName(t.id) || t.name, t.lead && t.lead.name, t.deputy && t.deputy.name, (t.members || []).map((m) => m.name).filter(Boolean).join(', ')]);
    const emRows = Array.from({ length: Math.max((em.does || []).length, (em.doesnt || []).length) }, (_, i) => [(em.does || [])[i], (em.doesnt || [])[i]]).filter((r) => r[0] || r[1]);
    const annexRows = (plan.annexes || []).filter((a) => a.text || a.maturity >= 0).map((a) => [a.name, L.MATURITY[a.maturity] || '', a.text || '']);
    doPrint(Y('binderT'), Y('binderT'), [
      h('h2', { text: Y('binderManual') }), h('ul', { class: 'checklist', style: 'list-style:none;padding-inline-start:0' }, MANUAL),
      ...sec(Y('teamsT'), [T('team'), T('lead'), T('deputy'), T('members')], teamRows),
      ...sec(L.TEAMS[0].lead.split(',')[0], [T('emDoes'), T('emDoesnt')], emRows),
      h('h2', { text: Y('callT') }), h('ol', {}, L.SIRENS.callHelp.map((x) => h('li', { text: x }))),
      h('h2', { text: Y('reportT2') }), h('ol', {}, L.REPORT.map((r) => h('li', { text: r[0] }))),
      ...sec(Y('decmapT'), L.DEC_COLS, decmapRows(), dm.intent ? h('p', {}, h('b', { text: Y('intent') + ': ' }), dm.intent) : null),
      ...sec(T('annexes'), [T('annexes'), T('maturity'), Y('annexText')], annexRows),
      ...sec(Y('mandT'), [L.PROC_KIND.binding, T('text'), Y('src')], L.MANDATORY.filter((m) => !m.sensitive).map((m) => [m.topic, m.rule, m.source]), h('p', { class: 'muted', text: L.VERIFY })),
      ...lastExercise(),
      ...sec(L.SHEETS.tasks, [T('text'), T('team'), T('owner'), T('due'), T('status')], openActs.map((a) => [a.text, teamName(a.team), a.owner, dateIL(a.due), L.STATUS[a.status] || ''])),
      ...sec(L.SHEETS.ends, [T('text'), T('owner'), T('endNext')], openEnds.map((e) => [e.text, e.owner, dateIL(e.next)])),
      ...sec(L.SHEETS.decisions, [T('text'), T('owner')], arr('ideas').filter((x) => x.decision === 'adopt' && !x.done).map((x) => [x.text, x.owner || x.by || ''])),
      archives().length ? h('div', {}, h('h2', { text: Y('protoT') }), archives().slice(0, 6).flatMap(protocolNodes)) : null]);
  }
  // רשימת הפריטים: הקבועים (m0, m1...) ומה שהצוות הוסיף (binder.items)
  function binderItems(bd) {
    const sens = L.BINDER_SENS || P.BINDER_SENS || [];
    return L.BINDER_MANUAL.map((text, i) => ({ key: 'm' + i, text, sens: sens.includes(i) }))
      .concat((Array.isArray(bd && bd.items) ? bd.items : []).filter((x) => x && x.key && x.text).map((x) => ({ key: x.key, text: x.text, sens: !!x.sens, custom: true })));
  }
  // בתיקייה המודפסת: התרגיל האחרון שהדוח שלו אושר: תאריך, מה עבד, ומה משפרים
  function lastExercise() {
    const ex = arr('exercises').filter((x) => x.report && x.report.approvedAt).sort((a, b) => String(a.report.approvedAt).localeCompare(String(b.report.approvedAt))).pop();
    if (!ex) return [];
    const rows = (ex.report.rows || []).map((r) => [r.topic || '', L.KEEP[r.keep] || '', r.action || r.how || '']);
    return [h('h2', { text: Y('lastEx') + ': ' + ex.title + ' · ' + dateIL(ex.startedAt) }), (ex.draft && ex.draft.worked || []).length ? h('ul', {}, ex.draft.worked.map((w) => h('li', { text: typeof w === 'string' ? w : (w.text || '') }))) : null,
      rows.length ? tbl([T('text'), Y('kindT'), T('action') || T('actions')], rows) : null];
  }
  window.sbeReadinessBinder = () => printBinder();
  function printSummary(n) { printMeeting(meetRec('s', n)); }
  function printMeeting(R) {
    const acts = arr('actions').filter(openAct), ends = arr('ends').filter((e) => e.status !== 'closed');
    const dec = arr('ideas').filter(fromMeeting(R));
    const ex = (R.n === 3 || R.n === 5) ? curEx(R.n) : null;
    const att = attendees(R).filter((a) => a.here && a.name);
    doPrint(R.title, Y('summaryT'), [
      att.length ? h('div', {}, h('h2', { text: Y('attendT') }), tbl([Y('pName'), Y('pRole')], att.map((a) => [a.name, a.role || '']))) : null,
      R.m && R.m.agenda ? h('div', {}, h('h2', { text: Y('agenda') }), h('p', { style: 'white-space:pre-line', text: R.m.agenda })) : null,
      ex ? h('div', {}, h('h2', { text: T('decision') }), tbl([T('round'), T('decision')], (ex.rounds || []).map((r, i) => [String(i + 1), r.decision || '']))) : null,
      dec.length ? h('div', {}, h('h2', { text: L.SHEETS.decisions }), tbl([T('text'), T('owner')], dec.map((x) => [x.text, x.owner || x.by || '']))) : null,
      h('h2', { text: T('actions') }), tbl([T('text'), T('team'), T('owner'), T('due'), T('status')], acts.map((a) => [a.text, teamName(a.team), a.owner, dateIL(a.due), L.STATUS[a.status] || ''])),
      h('h2', { text: T('ends') }), tbl([T('text'), T('owner'), T('endNext')], ends.map((e) => [e.text, e.owner, dateIL(e.next)])),
      R.r.next ? h('p', {}, h('b', { text: T('next1') + ': ' }), dateIL(R.r.next)) : null]);
  }

  // ---------- מעבדת הדמו (demo-hook.js): שני תוצרים מול המודל האמיתי, בלי לשמור במערך ----------
  // 1. תרחיש משבר בשגרה מהמחולל. 2. דוח תחקיר מתרגיל "אזעקות ופינוי" לדוגמה.
  async function demo(part) {
    const base = P.content('he');
    const routine = base.CRISIS.find((c) => c.k === 'routine');
    const sel = ORGSP
      ? { tests: 'ספירה ויציאה מסודרת כשהמבנה מוצף ובלי חשמל; הודעה אחת למשפחות ממקור אחד', kind: 'תרגיל שולחן', audience: ['צוות הניהול', 'כל הצוות'], missingRole: 'מנהל/ת מצב החירום', time: 'בזמן המשבר', crisis: routine.name, what: routine.what[0], complications: ['שמועה ברשתות', 'הורים בשער'], start: 'שיעור', level: base.AXES.find((a) => a.k === 'level').opts[2], scope: 'כל בית הספר', length: '20 דקות, בלי הכנה' }
      : { tests: 'ספירה ודיווח על חסרים כשהמבנה מוצף ובלי חשמל; הודעה להורים ממקור אחד', kind: 'תרגיל שולחן', audience: ['צוות הניהול', 'מחנכים ומחנכות'], missingRole: 'מנהל/ת מצב החירום', time: 'בזמן המשבר', crisis: routine.name, what: routine.what[0], complications: ['שמועה ברשתות', 'הורים בשער'], start: 'שיעור', level: base.AXES.find((a) => a.k === 'level').opts[2], scope: 'כל בית הספר', length: '20 דקות, בלי הכנה' };
    const fake = { parts: { profile: { name: ORGSP ? 'מרכז קהילתי לדוגמה' : 'בית ספר לדוגמה' }, decmap: { intent: ORGSP ? 'כולם מוגנים, ספורים ומחוברים, והפעילות ממשיכה.' : 'כולם מוגנים, ספורים ומחוברים, והלמידה ממשיכה.' } } };
    const items = [];
    if (part !== 'debrief') {
    const o = await window.sbeCallAIJson(SERVER, { system: P.generatorSystem('he'), messages: [{ role: 'user', content: P.generatorInput(sel, fake) }], maxTokens: 9000, customerReview: true }, 300000, P.validScenario);
    const scn = P.normalizeScenario(o);
    items.push({ node: h('div', {}, h('h2', { text: scn.title }), scenarioNodes(scn)), title: T('tool') + ': ' + scn.title, kind: 'scenario', input: [Y('genTests') + ': ' + sel.tests, ...base.AXES.map((a) => a.label + ': ' + [].concat(sel[a.k] || '').join(', '))].join('\n') });
    return items;
    }
    const SR = L.SIRENS;
    const ex = { id: 'ex-demo', session: 3, title: SR.title, rounds: [
      { decision: ORGSP ? 'איש/אשת צוות מהקבוצה הסמוכה נשאר/ת עם המשתתף בכיסא הגלגלים בחדר המדרגות הפנימי.' : 'מורה מהכיתה הסמוכה נשארת עם התלמיד בכיסא הגלגלים בחדר המדרגות הפנימי.', worked: 'כולם הגיעו למרחבים תוך דקה וחצי.' },
      { decision: 'מפנים את האגף המזרחי בלבד לאגף המערבי, ומזעיקים כבאות דרך צוות הקשר עם הרשויות.', worked: 'ההודעה לכבאות נמסרה בששת החלקים.', improved: 'מנהל/ת מצב החירום לא ענה/תה לטלפון בעצמו/ה.' },
      { decision: ORGSP ? 'יציאה מסודרת לפי קבוצות, עם רישום בכניסה.' : 'שחרור מסודר לפי כיתות, עם רישום בשער.', worked: 'לא היו יציאות בלי רישום.' }],
      callHelp: 'רכזת הביטחון מבית הספר הדר · ריח גז ליד המטבח · האגף המזרחי · 120 איש באגף · פינינו את האגף · צריכים כבאות', hardTalk: 'אני לא יודעת מה יהיה מחר. אני כן יודעת שהיום כולנו פה, יחד, ועשינו את מה שתרגלנו.',
      debrief: { worked: 'הספירה הייתה מהירה; ההודעה לכבאות הייתה ברורה.', hard: 'מפתח אחד בלבד למרחב בקומה השנייה; ההודעה להורים יצאה אחרי 25 דקות.', ideas: 'מפתח נוסף בארון החירום; נוסח מוכן לנפילה קרובה.' }, marks: [] };
    const srcs = window.SBE_ADVISOR_SOURCES ? window.SBE_ADVISOR_SOURCES.forAdvisor('readiness') : [];
    const v = await window.sbeCallAIJson(SERVER, { system: P.debriefSystem('he'), messages: [{ role: 'user', content: P.debriefInput(ex, { segments: [], marks: [] }, srcs, 'כוונת בית הספר: ' + fake.parts.decmap.intent) }], maxTokens: 12000, customerReview: true }, 300000, P.validDebrief);
    ex.draft = v; ex.report = { rows: (v.gaps || []).map((g) => ({ topic: g.topic || '', planned: g.planned || '', happened: g.happened || '', how: g.how || '', keep: g.keep === 'keep' ? 'keep' : 'improve', action: g.action || '', owner: g.team ? teamName(g.team) : '', due: plus(14) })) };
    items.push({ node: h('div', {}, h('h2', { text: T('reportT') + ' · ' + SR.title }), reportNodes(ex)), title: T('tool') + ': ' + T('reportT') + ' · ' + SR.title, kind: 'debrief', input: ex.rounds.map((r, i) => T('round') + ' ' + (i + 1) + ': ' + r.decision).join('\n') });
    return items;
  }

  window.sbeReadiness = { state: S, render, model: P, demo, org: ORGSP };
  start();
})();
