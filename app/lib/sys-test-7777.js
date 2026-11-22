// כניסת בדיקה 7777, זמנית (22/11/2026: "תאפשר לי כניסה לגירסת הסטודנטיות בבי גוד עם הקוד 7777... אבטל זאת בהמשך.
// זה רק לי אחרי כניסה כמנהלת"; ובאותו יום: "הרחב את ההרשאה לקוד 7777 גם לעינת ולאיבנה"). מנהלת המערכת, ועינת ואיבנה
// בקוד האישי שלהן (הרשאת dilemma או credibility, השרת בודק): כל דף משתתפים מוצא או פותח פעילות בדיקה,
// בלי איסוף למחקר, ועובר אליה. בלי כניסה: חזרה לדף הכניסה.
// לביטול: למחוק את הקובץ הזה, את הטעינה שלו ואת השורה של 7777 בכל דף (entry, talk-study, credibility-join, dilemma-join).
(function () {
  'use strict';
  const TITLE = 'פעילות בדיקה · 7777';
  const OLD_TITLE = 'בדיקה של מנהלת המערכת · 7777'; // פעילות הבדיקה שכבר נפתחה למנהלת המערכת
  function token() {
    try {
      const t = sessionStorage.getItem('sbe.session.token'); if (t) return t;
      const m = JSON.parse(localStorage.getItem('sbe.session.mirror') || 'null');
      return (m && m.data && m.data['sbe.session.token']) || '';
    } catch (e) { return ''; }
  }
  function device() { try { return JSON.parse(localStorage.getItem('sbe.sys.device') || 'null'); } catch (e) { return null; } }
  // חזרה לכניסה (מכשיר מוכר נכנס לבד), ואחר כך שוב לאותו דף עם 7777
  function relogin(page) {
    location.replace('entry.html?' + (device() ? '' : 'expired=1&') + 'next=' + encodeURIComponent(page + '?c=7777'));
  }
  // find(): מחזיר את קוד הכיתה של פעילות הבדיקה (או פותח אותה). api(op, input, cred) של הדף.
  async function run({ page, api, setup }) {
    const tk = token();
    if (!tk) { relogin(page); return null; }
    try { return await setup((op, input) => api(op, input || {}, { token: tk }), TITLE); }
    catch (e) {
      if (e.status === 401 && device()) { relogin(page); return null; }
      if (e.status === 401 || e.status === 403) throw Object.assign(new Error('הקוד 7777 פתוח רק לצוות המחקר. אפשר להיכנס עם הקוד האישי שלך ב־Be Good ולנסות שוב.'), { status: 403 });
      throw e;
    }
  }
  window.SBE_SYS7777 = { TITLE, OLD_TITLE, token, relogin, run };
})();
