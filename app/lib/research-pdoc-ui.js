// מסמך שותפות במרכז המחקר (15/11/2026): כותבים, שולחים קישור לשותף או לשותפה, ורואים אישור ושאלות.
// הנוסח הפותח ב־partner-doc-core.js; השרת ב־harness/lib/partner-docs.mjs; מה שהשותף/ה רואה: partner-doc.html.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SBE_PDOC_UI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const P = () => root.SBE_PDOC || (typeof require === 'function' ? require('./partner-doc-core.js') : null);
  function endpoint() {
    return (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) ? '/api/access' : 'https://sbe-server.onrender.com/api/access';
  }
  function token() { try { return sessionStorage.getItem('sbe.session.token') || ''; } catch (_) { return ''; } }
  async function call(body) {
    try {
      const r = await fetch(endpoint(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, token: token() }) });
      const data = await r.json().catch(() => ({}));
      return r.ok ? data : { error: data.error || 'failed' };
    } catch (_) { return { error: 'network' }; }
  }
  const dateIL = (iso) => { try { return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }).replace(/\//g, '.'); } catch (_) { return ''; } };
  function shareText(d) {
    return 'שלום' + (d.partnerName ? ' ' + d.partnerName : '') + ',\nכתבנו מסמך שותפות קצר' + (d.studyTitle ? ' למחקר "' + d.studyTitle + '"' : '') +
      ', במילים פשוטות, על איך נעבוד יחד. אפשר לקרוא אותו כאן, ולאשר או לכתוב לנו שאלה או הצעה:\n' + d.link + '\n\nתודה, ושמחים לעבוד יחד!\n' + (d.fromName || '');
  }

  function view(box, ctx) {
    const { D, study, message, ask } = ctx;
    const node = D.node;
    D.paragraph(box, 'מסמך קצר ומזמין על העבודה המשותפת: למה יחד, מה כל אחד ואחת מביאים, איך מחליטים ואיך משתפים קרדיט. כותבים, שולחים קישור, והשותף או השותפה קוראים ומאשרים בלי כניסה ובלי קוד, או כותבים שאלה.', 'r-muted');
    const menu = node('div', 'r-linkmenu'); box.append(menu);
    const area = node('div'); box.append(area);
    menu.append(D.button('מסמך שותפות חדש', () => edit(P().draft(study)), 'r-secondary'));

    async function list() {
      area.replaceChildren(D.node('p', 'r-muted', 'טעינת המסמכים…'));
      const out = await call({ action: 'pdocList', studyId: study.id });
      area.replaceChildren();
      if (out.error) { D.paragraph(area, 'לא הצלחנו לטעון את מסמכי השותפות. אפשר לרענן את הדף ולנסות שוב.', 'r-notice r-error'); return; }
      if (!out.items.length) { D.paragraph(area, 'עדיין אין מסמך שותפות למחקר הזה. אפשר להתחיל מהנוסח המוכן ולשנות בו כל מה שרוצים.', 'r-muted'); return; }
      for (const d of out.items) item(d);
    }
    function item(d) {
      const card = D.card(area, d.title || 'מסמך שותפות');
      D.paragraph(card, (d.partnerName ? 'אל: ' + d.partnerName + ' · ' : '') + P().STATUS[d.status] + (d.approval && d.status === 'approved' ? ' · ' + d.approval.name + ', ' + dateIL(d.approval.at) : '') + ' · עודכן ' + dateIL(d.updated), 'r-muted');
      const m = node('div', 'r-linkmenu'); card.append(m);
      m.append(D.button('עריכה', () => edit(d), 'r-secondary'));
      if (d.status === 'draft') m.append(D.button('שליחה לשותפות', () => send(d), 'r-secondary'));
      else m.append(D.button('שליחת הקישור', () => share(card, d), 'r-secondary'));
      const open = node('a', 'r-btn r-secondary', 'איך זה נראה אצל השותפות'); open.href = d.link; open.target = '_blank'; open.rel = 'noopener'; m.append(open);
      m.append(D.button('מחיקה', async () => {
        if (!(await ask('למחוק את המסמך "' + (d.title || '') + '"? הקישור שנשלח יפסיק לפעול.', 'כן, למחוק'))) return;
        const out = await call({ action: 'pdocDelete', id: d.id });
        if (out.error) message('המחיקה לא הושלמה. אפשר לנסות שוב.', true, card); else list();
      }, 'r-danger'));
      if (d.status === 'draft') D.paragraph(card, 'השותפות עוד לא רואות את המסמך. אחרי "שליחה לשותפות" הקישור נפתח.', 'r-muted');
      const talk = d.responses || [];
      if (talk.length) {
        const t = node('div', 'r-fold'); t.append(node('strong', '', 'השיחה על המסמך'));
        for (const r of talk) {
          const p = node('p'); p.append(node('strong', '', (r.name || (r.from === 'owner' ? 'Begood' : 'השותפות')) + ' · ' + dateIL(r.at) + (r.kind === 'approve' ? ' · אישור' : '') + ': '), document.createTextNode(r.text || (r.kind === 'approve' ? 'אישר.ה את המסמך' : '')));
          t.append(p);
        }
        const reply = D.field(t, 'תשובה (תופיע בדף המסמך)', 'textarea', '', { placeholder: 'למשל: תודה! הוספנו מפגש חודשי.' });
        t.append(D.button('שליחת התשובה', async () => {
          if (!reply.value.trim()) return;
          const out = await call({ action: 'pdocReply', id: d.id, text: reply.value });
          if (out.error) message('התשובה לא נשמרה. אפשר לנסות שוב.', true, t); else list();
        }, 'r-secondary'));
        card.append(t);
      }
    }
    async function send(d) {
      const out = await call({ action: 'pdocSave', send: true, doc: d });
      if (out.error) { message('השליחה לא הושלמה. אפשר לנסות שוב.', true, area); return; }
      await list();
      const first = area.querySelector ? area.querySelector('.r-card') : null;
      share(first || area, out.doc);
    }
    function share(parent, d) {
      const s = node('div', 'r-fold');
      s.append(node('strong', '', 'הקישור מוכן. אפשר לשלוח אותו בדרך שנוחה לכם:'));
      const link = D.field(s, 'הקישור למסמך', 'text', d.link); link.readOnly = true; link.setAttribute('dir', 'ltr');
      const text = shareText(d);
      const m = node('div', 'r-linkmenu'); s.append(m);
      m.append(D.button('העתקת ההודעה והקישור', async () => {
        try { await navigator.clipboard.writeText(text); message('✓ ההודעה והקישור הועתקו.', false, s); } catch (_) { link.select(); message('אפשר להעתיק את הקישור מהשדה.', false, s); }
      }, 'r-secondary'));
      const wa = node('a', 'r-btn r-secondary', 'וואטסאפ'); wa.href = 'https://wa.me/?text=' + encodeURIComponent(text); wa.target = '_blank'; wa.rel = 'noopener'; m.append(wa);
      const mail = node('a', 'r-btn r-secondary', 'מייל'); mail.href = 'mailto:' + encodeURIComponent(d.partnerEmail || '') + '?subject=' + encodeURIComponent(d.title || 'מסמך שותפות') + '&body=' + encodeURIComponent(text); m.append(mail);
      D.paragraph(s, 'כשהשותפות מאשרות או כותבות שאלה, תגיע אלייך הודעה במייל, והכול יופיע כאן.', 'r-muted');
      parent.append(s);
    }
    function edit(d) {
      area.replaceChildren();
      const card = D.card(area, d.id ? 'עריכת מסמך השותפות' : 'מסמך שותפות חדש');
      D.paragraph(card, 'הנוסח כתוב כמו מכתב לעמיתים, לא כחוזה. אפשר לשנות כל מילה, להוסיף חלקים ולמחוק. **מודגש** ושורות שמתחילות ב־"- " יוצגו כהדגשה ותבליטים.', 'r-muted');
      if (d.status === 'approved') D.paragraph(card, 'המסמך כבר אושר. שינוי בנוסח יוצר גרסה חדשה, והשותפות יתבקשו לאשר אותה שוב.', 'r-notice');
      const g = node('div', 'r-grid'); card.append(g);
      const partnerName = D.field(g, 'למי (שם השותף או השותפה)', 'text', d.partnerName, { placeholder: 'למשל: ד״ר רונית לוי' });
      const partnerEmail = D.field(g, 'מייל (רשות, רק לשליחה במייל)', 'email', d.partnerEmail);
      const fromName = D.field(g, 'מאת', 'text', d.fromName);
      const title = D.field(g, 'כותרת', 'text', d.title);
      const intro = D.field(card, 'פתיחה', 'textarea', d.intro);
      const secs = node('div'); card.append(secs);
      const rows = [];
      function addRow(s) {
        const f = node('fieldset', 'r-nested'); f.append(node('legend', '', 'חלק במסמך'));
        const t = D.field(f, 'כותרת החלק', 'text', s.title), x = D.field(f, 'מה כתוב בו', 'textarea', s.text);
        const row = { id: s.id, t, x, f };
        f.append(D.button('הסרת החלק', () => { f.remove(); rows.splice(rows.indexOf(row), 1); }, 'r-danger'));
        rows.push(row); secs.append(f);
      }
      (d.sections || []).forEach(addRow);
      const more = node('div', 'r-linkmenu'); card.append(more);
      more.append(D.button('הוספת חלק', () => addRow({ title: '', text: '' }), 'r-secondary'));
      const closing = D.field(card, 'סיום', 'textarea', d.closing);
      const read = () => ({ id: d.id, studyId: d.studyId || study.id, studyTitle: d.studyTitle || study.config?.title || '', title: title.value, partnerName: partnerName.value, partnerEmail: partnerEmail.value,
        fromName: fromName.value, intro: intro.value, closing: closing.value, sections: rows.map((r) => ({ id: r.id, title: r.t.value, text: r.x.value })) });
      const actions = node('div', 'r-linkmenu'); card.append(actions);
      async function save(sendNow) {
        const out = await call({ action: 'pdocSave', send: sendNow, doc: read() });
        if (out.error) { message('השמירה לא הושלמה. אפשר לנסות שוב.', true, actions); return; }
        await list();
        if (sendNow) { const first = area.querySelector ? area.querySelector('.r-card') : null; share(first || area, out.doc); }
        else message('✓ המסמך נשמר.', false, area.firstChild || area);
      }
      actions.append(D.button(d.status && d.status !== 'draft' ? 'שמירת השינויים' : 'שמירה כטיוטה', () => save(false)));
      if (!d.status || d.status === 'draft') actions.append(D.button('שמירה ושליחה לשותפות', () => save(true)));
      actions.append(D.button('ביטול', list, 'r-secondary'));
    }
    list();
  }
  return Object.freeze({ view, shareText });
});
