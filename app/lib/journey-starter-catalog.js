(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_JOURNEY_STARTERS = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  // Candidate descriptions are suggestions; only explicit selection creates a team-reported record.
  const CATALOGS = {
  "school": {
    "roles": [
      {
        "title": "הובלה וסמכות",
        "id": "school_roles_01"
      },
      {
        "title": "ריכוז התהליך",
        "id": "school_roles_02"
      },
      {
        "title": "הובלה פדגוגית",
        "id": "school_roles_03"
      },
      {
        "title": "ריכוז שכבה או תחום",
        "id": "school_roles_04"
      },
      {
        "title": "חניכה וקליטת צוות",
        "id": "school_roles_05"
      },
      {
        "title": "קשר עם תלמידים ומשפחות",
        "id": "school_roles_06"
      },
      {
        "title": "מידע ולמידה",
        "id": "school_roles_07"
      },
      {
        "title": "תפעול ותשתיות",
        "id": "school_roles_08"
      }
    ],
    "mechanisms": [
      {
        "title": "אתוס משותף",
        "description": "מארגן ציפיות בדבר למידה, אחריות, שותפות ויחס לאחר",
        "connections": "תקנון; קבלת החלטות; השתתפות תלמידים",
        "questions": "ביטוי בהחלטות ובשגרות; מקום למחלוקת על פירוש האתוס",
        "id": "school_mechanisms_01"
      },
      {
        "title": "נורמות לא כתובות בצוות ובקבוצות",
        "description": "מכוונות בקשת עזרה, ביקורת, שיתוף וגבולות פעולה",
        "connections": "חניכה; תקשורת; השמעת התנגדות",
        "questions": "תיאור נורמה בפועל; קולות שונים; הבחנה בין נורמה מוצהרת לנוהגת",
        "id": "school_mechanisms_02"
      },
      {
        "title": "תקנון והסכמות עבודה",
        "description": "מסדירים זכויות, אחריות, סמכויות וציפיות",
        "connections": "פנייה וערעור; תקשורת; נציגות תלמידים",
        "questions": "נגישות; הכרת הכללים; סמכות להפעיל ולעדכן",
        "id": "school_mechanisms_03"
      },
      {
        "title": "פורום החלטות והנהלה",
        "description": "מארגן סדר יום, דיון, הכרעה ומעקב",
        "connections": "צוותים פדגוגיים; הקצאת משאבים; נציגות הורים",
        "questions": "מנדט; משתתפים; דרך לתיעוד, יידוע ובחינה מחדש",
        "id": "school_mechanisms_04"
      },
      {
        "title": "הסדר לתעדוף זמן ומשאבים",
        "description": "מחבר בין צרכים, הכרעות והקצאה ממשית",
        "connections": "הנהלה; למידת מורים; סיוע הדדי",
        "questions": "תמונת הקצאות; שיקולים גלויים; זיהוי שימושים מתחרים",
        "id": "school_mechanisms_05"
      },
      {
        "title": "תיאום בצוות שכבה או צוות מקצוע",
        "description": "מארגן עבודה משותפת בין מורים ובין כיתות",
        "connections": "הנהלה; למידת עמיתים; תקשורת",
        "questions": "זמן משותף; גבולות סמכות; מעקב החלטות וחלוקת עומס",
        "id": "school_mechanisms_06"
      },
      {
        "title": "למידת עמיתים ופיתוח פדגוגי",
        "description": "מארגנים בירור הוראה, שיתוף ידע והתנסות",
        "connections": "צוותים מקצועיים; חניכה; מאגר ידע",
        "questions": "זמן; זכות להציע ולחלוק; דרך לחבר למידה לשימוש בפועל",
        "id": "school_mechanisms_07"
      },
      {
        "title": "חניכה וקליטת אנשי צוות",
        "description": "מארגנות קשר מתמשך והעברת ידע למי שנכנסים לתפקיד",
        "connections": "למידת עמיתים; העברת תפקיד; מאגר ידע",
        "questions": "התאמה; זמן; הכרה באחריות; גיבוי וכללי פרטיות",
        "id": "school_mechanisms_08"
      },
      {
        "title": "השתתפות תלמידים בהחלטות",
        "description": "מחברת בין עמדות תלמידים לבין סדר יום ופעולה",
        "connections": "שיח כיתתי; תקנון; פורום החלטות",
        "questions": "ייצוג; גישה; סמכות השפעה; תשובה להצעות ולביקורת",
        "id": "school_mechanisms_09"
      },
      {
        "title": "שיח כיתתי קבוע",
        "description": "מארגן הקשבה, בירור צרכים והסכמות בכיתה",
        "connections": "השתתפות תלמידים; מענה לצרכים; ערעור",
        "questions": "זמן; כללי שיח; אפשרות פנייה אחרת למי שאינם מדברים במליאה",
        "id": "school_mechanisms_10"
      },
      {
        "title": "שותפות עם משפחות",
        "description": "מארגנת החלפת ידע, התייעצות ושיתוף בהחלטות",
        "connections": "תקשורת; השתתפות תלמידים; הנהלה",
        "questions": "דרכי השתתפות מגוונות; שפות וזמנים; גבולות אחריות וסמכות",
        "id": "school_mechanisms_11"
      },
      {
        "title": "הסדרי תקשורת וניתוב פניות",
        "description": "קובעים מי מפרסמים, מקבלים, מגיבים ומעבירים פנייה",
        "connections": "שותפות משפחות; צוותים; מענה לצרכים",
        "questions": "כללי גישה ותגובה; אחריות; חלופה; גבולות שעות עבודה",
        "id": "school_mechanisms_12"
      },
      {
        "title": "מענה לצרכים ועזרה הדדית",
        "description": "מחבר בין בקשת עזרה לבין אנשים ומשאבים זמינים",
        "connections": "שיח כיתתי; תקשורת; הקצאת משאבים",
        "questions": "דרך בקשה נגישה; חלוקת אחריות; מעקב; פרטיות והסכמה",
        "id": "school_mechanisms_13"
      },
      {
        "title": "בירור מחלוקות, פנייה וערעור",
        "description": "מאפשרים לבחון החלטה ולתת מענה למחלוקת",
        "connections": "תקנון; הנהלה; נציגות תלמידים ומשפחות",
        "questions": "הליך מוכר; אפשרות להשמיע עמדה; מי משיבים ובאיזה זמן",
        "id": "school_mechanisms_14"
      },
      {
        "title": "העברת תפקיד, מילוי מקום וגיבוי",
        "description": "מארגנים המשכיות בעת היעדרות או שינוי תפקיד",
        "connections": "חניכה; מאגר ידע; תקשורת",
        "questions": "ידע והרשאות שנמסרו; זמן הכנה; עצמאות הגיבוי",
        "id": "school_mechanisms_15"
      },
      {
        "title": "שימור ידע וזיכרון ארגוני",
        "description": "מארגנים תיעוד, מציאה, עדכון והעברה של ידע",
        "connections": "חניכה; למידת עמיתים; מעקב החלטות",
        "questions": "כללי כתיבה ואחזור; אחריות לעדכון; הרשאות ושמירת פרטיות",
        "id": "school_mechanisms_16"
      },
      {
        "title": "מעגל למידה יוזם",
        "description": "מארגן בחינה חוזרת של הנחות, ניסיון ושינויים ברשת",
        "connections": "הקצאת משאבים; הנהלה; למידת עמיתים",
        "questions": "מפגש חוזר; קולות מגוונים; אפשרות לשנות החלטה ולהקצות משאבים",
        "id": "school_mechanisms_17"
      },
      {
        "title": "שותפות בית ספר–קהילה",
        "description": "מסדירה תיאום, פעולה ואחריות עם שותפים מחוץ לבית הספר",
        "connections": "משפחות; הנהלה; גופים קהילתיים",
        "questions": "מטרות הדדיות; אחריות וגבולות סמכות; דרך לקשר רציף",
        "id": "school_mechanisms_18"
      },
      {
        "title": "פתיחות וחיבור לקהילות אחרות ולעולם שמסביב",
        "description": "מארגנים קשר מתמשך והדדי עם בתי ספר, קהילות ורשתות מחוץ למסגרת, ומחברים למידה מבחוץ לפעולה מקומית",
        "connections": "שותפות בית ספר–קהילה; תודעת חוסן רב־ערוצית; מעגל למידה יוזם",
        "questions": "מטרה ומשמעות משותפות; פתיחות לשונות; זמן ואחריות; הדדיות; העברת הידע פנימה; המשכיות וגיבוי",
        "id": "school_mechanisms_19"
      },
      {
        "title": "תודעת חוסן רב־ערוצית",
        "description": "מארגנת הבנה, ציפיות ובחירת דרכי פעולה סביב פיתוח חוסן",
        "connections": "אתוס; מעגל למידה; קבלת החלטות",
        "questions": "ביטוי בשגרה ובבחירה בין ערוצי פעולה; הכרה במגבלות ובאפשרות לשינוי",
        "id": "school_mechanisms_20"
      }
    ],
    "infrastructures": [
      {
        "title": "חדר למפגשי צוות",
        "id": "school_infrastructures_01"
      },
      {
        "title": "מרחב לשיחה פרטית",
        "id": "school_infrastructures_02"
      },
      {
        "title": "מרחב מפגש תלמידים",
        "id": "school_infrastructures_03"
      },
      {
        "title": "מרחב פתוח משותף",
        "id": "school_infrastructures_04"
      },
      {
        "title": "פלטפורמת תקשורת",
        "id": "school_infrastructures_05"
      },
      {
        "title": "מאגר מסמכים",
        "id": "school_infrastructures_06"
      },
      {
        "title": "לוח תכנון או מערכת שעות",
        "id": "school_infrastructures_07"
      },
      {
        "title": "ציוד וחיבור לרשת",
        "id": "school_infrastructures_08"
      }
    ],
    "resources": [
      {
        "title": "זמן מוגן לעבודה משותפת",
        "id": "school_resources_01"
      },
      {
        "title": "זמן נגיש לבעלי תפקידים",
        "id": "school_resources_02"
      },
      {
        "title": "תקציב",
        "id": "school_resources_03"
      },
      {
        "title": "ידע פדגוגי וניסיון",
        "id": "school_resources_04"
      },
      {
        "title": "מיומנויות חניכה ותיאום",
        "id": "school_resources_05"
      },
      {
        "title": "קשרים עם משפחות ושותפים",
        "id": "school_resources_06"
      },
      {
        "title": "מיומנויות שפה וגישור תרבותי",
        "id": "school_resources_07"
      },
      {
        "title": "נכונות וזמינות להשתתפות",
        "id": "school_resources_08"
      }
    ]
  },
  "community": {
    "roles": [
      {
        "title": "הובלה בעלת מנדט להחלטה או להמלצה",
        "id": "community_roles_01"
      },
      {
        "title": "ריכוז התהליך ותיאום בין המשימות",
        "id": "community_roles_02"
      },
      {
        "title": "קשר לקבוצות, ייצוג ונגישות להשתתפות",
        "id": "community_roles_03"
      },
      {
        "title": "אחריות לתקשורת ולהחזרת מידע",
        "id": "community_roles_04"
      },
      {
        "title": "תיאום מתנדבים ועזרה הדדית",
        "id": "community_roles_05"
      },
      {
        "title": "אחריות למשאבים ולתשתיות משותפות",
        "id": "community_roles_06"
      },
      {
        "title": "אחריות לתיעוד, למידע מאושר וללמידה",
        "id": "community_roles_07"
      },
      {
        "title": "קשר לרשות, לשירותים ולארגונים שותפים",
        "id": "community_roles_08"
      }
    ],
    "mechanisms": [
      {
        "title": "אתוס וסיפור קהילתי משותף",
        "description": "מארגנים ציפיות לגבי שייכות, אחריות ופעולה משותפת",
        "connections": "קבלת מצטרפים; מפגשים; כללי השתתפות",
        "questions": "אילו סיפורים נשמעים, איך הם משפיעים על החלטות ומי אינם מזדהים עמם",
        "id": "community_mechanisms_01"
      },
      {
        "title": "נורמות לא כתובות",
        "description": "מארגנות בקשת עזרה, תרומה, ביקורת ושמירת פנים",
        "connections": "עזרה הדדית; השתתפות; פניות וערעור",
        "questions": "מה מקובל בפועל, מי יכולים לחרוג ומה קורה כשמושמעת התנגדות",
        "id": "community_mechanisms_02"
      },
      {
        "title": "כללי חברות, זכויות ואחריות",
        "description": "מסדירים מי נכללים, מה מותר להחליט בשם מי ואיך משנים כללים",
        "connections": "קבלת מצטרפים; ייצוג; הכרעות",
        "questions": "שפה נגישה, היכרות עם הכללים וסמכות לשנותם",
        "id": "community_mechanisms_03"
      },
      {
        "title": "אספה או מסגרת לקבלת החלטות",
        "description": "מארגנת סדר יום, דיון, הכרעה ומעקב",
        "connections": "ייצוג; הקצאת משאבים; פרסום החלטות",
        "questions": "מנדט, דרך לקביעת סדר יום, השתתפות נוחה וגבולות הכרעה",
        "id": "community_mechanisms_04"
      },
      {
        "title": "ייצוג והקשבה לקבוצות",
        "description": "מאפשרים לקבוצות שונות להעלות צרכים ולהשפיע",
        "connections": "אספה; פניות; קשרים בין קבוצות",
        "questions": "כיצד נבחרים משתתפים, מי חסרים ואיך נשמעת עמדה מחוץ לנציגות",
        "id": "community_mechanisms_05"
      },
      {
        "title": "פרסום החלטות ומעקב פתוח",
        "description": "מחזיר מידע על החלטות, נימוקים והתקדמות לחברי הקהילה",
        "connections": "הכרעות; תקציב; ערוצי תקשורת",
        "questions": "אחריות לעדכון, גישה בדרכים שונות ודרך לבקש הבהרה",
        "id": "community_mechanisms_06"
      },
      {
        "title": "פניות, הסתייגויות ויישוב מחלוקות",
        "description": "מסדירים כתובת, תגובה ודרך לבחון החלטה מחדש",
        "connections": "כללים; ייצוג; פרסום החלטות",
        "questions": "כתובת מוכרת, זמן תגובה מוסכם, פרטיות והפרדה מעניין אישי",
        "id": "community_mechanisms_07"
      },
      {
        "title": "הסדרי תקשורת קהילתית",
        "description": "מארגנים פרסום, הפצת מידע, תגובה ואימות",
        "connections": "פניות; עזרה הדדית; החלטות",
        "questions": "שפה, הרשאות, נגישות לא דיגיטלית, אחריות וגיבוי",
        "id": "community_mechanisms_08"
      },
      {
        "title": "קליטת צרכים ותעדוף בקשות",
        "description": "הופכת פנייה למסלול בירור והמשך טיפול",
        "connections": "עזרה הדדית; משאבים; קשר לשירותים",
        "questions": "קריטריונים ברורים, כתובת, פרטיות ומעקב בלי לאסוף מידע עודף",
        "id": "community_mechanisms_09"
      },
      {
        "title": "התאמת עזרה הדדית",
        "description": "מחברת בין בקשות לבין אנשים ומשאבים מתאימים",
        "connections": "קליטת צרכים; תורנויות; תקשורת",
        "questions": "הסכמה, גבולות אחריות, זמינות ויכולת לבקש עזרה בכמה דרכים",
        "id": "community_mechanisms_10"
      },
      {
        "title": "גיוס מתנדבים וחלוקת תורנויות",
        "description": "מארגנים הצטרפות, התאמה, זמן, גיבוי והעברת משימה",
        "connections": "עזרה הדדית; למידה; חלוקת משאבים",
        "questions": "זמן ממשי, התאמה למיומנויות, חלוקה הוגנת ואפשרות לצמצם או לסיים תפקיד",
        "id": "community_mechanisms_11"
      },
      {
        "title": "קבלת מצטרפים וחיבור לקהילה",
        "description": "מעבירה ידע ומאפשרת היכרות והשפעה למצטרפים",
        "connections": "כללי חברות; מפגשים; ייצוג",
        "questions": "דרכי פנייה, שפות, ליווי נגיש והיכרות עם צרכים שונים",
        "id": "community_mechanisms_12"
      },
      {
        "title": "שגרות מפגש וקשרים בין קבוצות",
        "description": "מארגנות מפגשים והיכרות מעבר למעגלים הקיימים",
        "connections": "מצטרפים; ייצוג; אתוס",
        "questions": "מרחב או אמצעי חיבור, זמן, נגישות ואפשרות להשפיע על אופי המפגש",
        "id": "community_mechanisms_13"
      },
      {
        "title": "הקצאת כסף, ציוד ומרחבים",
        "description": "מסדירה גישה, קדימויות ושימוש במשאבים משותפים",
        "connections": "הכרעות; עזרה; יוזמות",
        "questions": "סמכות, קריטריונים, זמינות, תחזוקה ופתרון להתנגשות בין צרכים",
        "id": "community_mechanisms_14"
      },
      {
        "title": "תיאום בין קבוצות וארגונים עמיתים",
        "description": "מאפשר חלוקת עבודה, השלמה ושיתוף ידע אופקי",
        "connections": "מפגשים; תקשורת; משאבים",
        "questions": "נושא משותף, גבולות אחריות והסכמה לגבי מה משתפים",
        "id": "community_mechanisms_15"
      },
      {
        "title": "פתיחות וחיבור לקהילות אחרות ולעולם שמסביב",
        "description": "מארגנים קשר מתמשך והדדי מעבר לגבולות הקהילה, מפגש עם שונות, למידה מבחוץ ויצירת אפשרויות פעולה משותפות",
        "connections": "תיאום בין קבוצות וארגונים; תודעת חוסן רב־ערוצית; מעגל למידה יוזם",
        "questions": "מטרה ומשמעות משותפות; פתיחות לשונות; זמן ואחריות; הדדיות; החזרת ידע לקהילה; המשכיות וגיבוי",
        "id": "community_mechanisms_16"
      },
      {
        "title": "קשר לרשות, לשירותים או לגוף מסמיך",
        "description": "מארגן פנייה, ייצוג, מעקב והבאת מידע ומשאבים מבחוץ",
        "connections": "קליטת צרכים; הכרעות; הקצאה",
        "questions": "כתובת מוגדרת, מנדט, מעקב ודרך להחזיר תשובה לקהילה",
        "id": "community_mechanisms_17"
      },
      {
        "title": "חניכה, שימור ידע והעברת תפקידים",
        "description": "מארגנים העברת ניסיון, תיעוד והכנת ממלאי מקום",
        "connections": "תורנויות; קבלת מצטרפים; תיאום בין קבוצות",
        "questions": "זמן לחניכה, חומר נגיש, הרשאות וגיבוי שהוכן",
        "id": "community_mechanisms_18"
      },
      {
        "title": "מעגל למידה יוזם",
        "description": "מארגן בחינה חוזרת של ניסיון, הנחות, תלויות וחלופות והפיכת המשוב לשינוי",
        "connections": "החלטות; שינוי כללים; תיאום בין קבוצות",
        "questions": "זמן חוזר, קולות שונים, אפשרות לשנות החלטה ומעקב אחר השינוי",
        "id": "community_mechanisms_19"
      },
      {
        "title": "תודעת חוסן רב־ערוצית",
        "description": "מארגנת הבנה, ציפיות ובחירת דרכי פעולה סביב פיתוח חוסן",
        "connections": "אתוס; מעגל למידה; קבלת החלטות",
        "questions": "ביטוי בפעולה בשגרה ובתנאים משתנים, הכרה במגבלות ובדרכי פעולה חלופיות",
        "id": "community_mechanisms_20"
      }
    ],
    "infrastructures": [
      {
        "title": "מרחב מפגש פיזי, אם רלוונטי",
        "id": "community_infrastructures_01"
      },
      {
        "title": "אמצעי מפגש מרחוק ותקשורת דיגיטלית",
        "id": "community_infrastructures_02"
      },
      {
        "title": "טלפון או אמצעי קשר נוסף",
        "id": "community_infrastructures_03"
      },
      {
        "title": "מקום מאושר לשמירת מידע ומסמכים, עם הרשאות מתאימות",
        "id": "community_infrastructures_04"
      },
      {
        "title": "אמצעי הנגשה כגון גישה מותאמת למרחב, כתוביות או ציוד עזר, לפי הצורך המקומי",
        "id": "community_infrastructures_05"
      },
      {
        "title": "ציוד ומקום לאחסונו או לשיתופו",
        "id": "community_infrastructures_06"
      },
      {
        "title": "אמצעי ניידות או גישה למרחבים, אם קיימים ורלוונטיים",
        "id": "community_infrastructures_07"
      }
    ],
    "resources": [
      {
        "title": "זמן פנוי או מוקצה של משתתפים ומתנדבים",
        "id": "community_resources_01"
      },
      {
        "title": "ידע מקצועי וניסיון מקומי",
        "id": "community_resources_02"
      },
      {
        "title": "מיומנויות תיאום, הנחיה, ארגון ופתרון בעיות",
        "id": "community_resources_03"
      },
      {
        "title": "שפות, תרגום וידע בהנגשה",
        "id": "community_resources_04"
      },
      {
        "title": "תקציב ומקורות מימון זמינים",
        "id": "community_resources_05"
      },
      {
        "title": "היכרות וקשרים שיכולים לאפשר פנייה לשותפים או למשאבים",
        "id": "community_resources_06"
      },
      {
        "title": "נכונות לתרום וידע משותף שנוצר בפעילות קודמת",
        "id": "community_resources_07"
      }
    ]
  }
};
  function getCatalog(kind) {
    return CATALOGS[kind] ? JSON.parse(JSON.stringify(CATALOGS[kind])) : null;
  }
  function createRecord(kind, section, catalogId, recordId, updatedAt) {
    const items = (getCatalog(kind) || {})[section] || [];
    const item = items.find(item => item.id === catalogId);
    if (!item) throw Error('הצעת הפתיחה אינה ברשימה שנבחרה');
    return {id:recordId,title:item.title,catalogId:item.id,catalogSource:'הצעת פתיחה לבחירה ולהתאמה, גרסה 1.3; דיווח קיום של הצוות',knowledgeState:'present',updatedBy:'דיווח הצוות',updatedAt};
  }
  return {getCatalog,createRecord};
});
