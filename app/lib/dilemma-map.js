// בירור דילמות: הלוח כמפת חשיבה (17/11/2026: "אני צריכה אפשרות לשנות את מיקום הכרטיסים. אני צריכה אפשרות לערום
// כרטיסים דומים ולתת שם לקבוצות - בקיצור- אני חייבת לוח הרבה יותר דינאמי יותר כמו מפת חשיבה").
//  SBE_DLM_MAP.html(board, opts): הלוח כמשטח חופשי: כרטיסים במיקום חופשי, קבוצות עם שם (אפשר לערום), קווי קשר עם שם הקשר,
//    ואזורי הלוח כרקע מנחה. כל כרטיס נשאר .dlm-item עם אותם כפתורי data-* כמו בלוח הרגיל, כך שהחיבורים הקיימים פועלים.
//  SBE_DLM_MAP.bind(root, opts): גרירה, קבוצות, זום ושורת הכלים. opts.op(input) שולח פעולת לוח ומחזיר את הלוח החדש;
//    opts.refresh() מצייר מחדש; opts.readOnly.  SBE_DLM_MAP.busy(): בזמן גרירה או עריכה לא מציירים מחדש (עדכון חי).
(function () {
  'use strict';
  const M = window.SBE_DILEMMA, esc = M.esc;
  const W = 2400, H = 1500, CW = 230;
  const ZCOL = { claims: '#2A9D8F', sources: '#1D3F63', missing: '#E9A23B', alternatives: '#8AB17D', certainty: '#9B5DE5', questions: '#E76F51' };
  const REL_COL = { supports: '#2E9E32', weakens: '#EF6C00', contradicts: '#C62828', raises: '#1D3F63', check: '#9B5DE5' };
  let busy = false;
  const view = { zoom: 0.7, sx: null, sy: null, zones: true, full: false };
  try { const v = JSON.parse(localStorage.getItem('sbe.dlm.map.view') || 'null'); if (v) Object.assign(view, { zoom: v.zoom || 0.7, zones: v.zones !== false }); } catch (e) {}
  const saveView = () => { try { localStorage.setItem('sbe.dlm.map.view', JSON.stringify({ zoom: view.zoom, zones: view.zones })); } catch (e) {} };

  // אזורי הלוח כרקע: שלוש עמודות ושתי שורות, מימין לשמאל
  const REG = { w: 760, h: 660 };
  function region(i) { const col = i % 3, row = Math.floor(i / 3); return { x: W - 40 - (col + 1) * REG.w, y: 30 + row * REG.h }; }
  function defaultPos(board) {
    const pos = {}, count = {};
    (board.items || []).forEach((it) => {
      if (it.pos) { pos[it.id] = it.pos; return; }
      const zi = Math.max(0, M.ZONES.findIndex((z) => z.k === it.zone)), r = region(zi), k = count[zi] = (count[zi] || 0) + 1;
      const n = k - 1; pos[it.id] = { x: r.x + REG.w - 60 - CW - (n % 3) * (CW + 14), y: r.y + 86 + Math.floor(n / 3) * 150 };
    });
    return pos;
  }

  function html(board, o) {
    o = o || {};
    const U = window.SBE_DLM_UI, items = (board.items || []).filter((i) => !i.deleted), clusters = board.clusters || [];
    const pos = defaultPos(board), byId = Object.fromEntries(items.map((i) => [i.id, i]));
    const conf = (k) => (M.CONFIDENCE.find((c) => c.k === k) || {}).t;
    // ערימה: הכרטיסים של קבוצה שמסומנת "ערומה" מוצגים זה על זה בתוך הקבוצה
    const stackIdx = {};
    clusters.filter((c) => c.stacked).forEach((c) => { items.filter((i) => i.cluster === c.id).forEach((i, n) => { stackIdx[i.id] = n; pos[i.id] = { x: c.x + 14 + Math.min(n, 6) * 7, y: c.y + 46 + Math.min(n, 6) * 7 }; }); });
    const zonesBg = view.zones ? M.ZONES.map((z, i) => { const r = region(i); return '<div class="mm-region" style="left:' + r.x + 'px;top:' + r.y + 'px;width:' + (REG.w - 30) + 'px;height:' + (REG.h - 30) + 'px;--zc:' + ZCOL[z.k] + '"><b>' + esc(z.t) + '</b><span>' + esc(z.d) + '</span></div>'; }).join('') : '';
    const clusterHTML = clusters.map((c) => {
      const n = items.filter((i) => i.cluster === c.id).length;
      return '<div class="mm-cluster' + (c.stacked ? ' stacked' : '') + '" data-cluster="' + esc(c.id) + '" style="left:' + c.x + 'px;top:' + c.y + 'px;width:' + (c.stacked ? 300 : c.w) + 'px;height:' + (c.stacked ? 230 : c.h) + 'px;--kc:' + esc(c.color) + '">'
        + '<div class="mm-khead" data-kdrag="1"><b>' + esc(c.name) + '</b><span class="mm-kn">' + n + '</span>'
        + (o.readOnly ? '' : '<button type="button" data-kstack="' + esc(c.id) + '" title="' + (c.stacked ? 'פריסת הכרטיסים' : 'ערימת הכרטיסים') + '">' + (c.stacked ? '⤢ פריסה' : '⧉ ערימה') + '</button>'
          + '<button type="button" data-kname="' + esc(c.id) + '" title="שינוי השם" aria-label="שינוי שם הקבוצה">✎</button><button type="button" data-kdel="' + esc(c.id) + '" title="ביטול הקבוצה (הכרטיסים נשארים)" aria-label="ביטול הקבוצה">×</button>')
        + '</div>' + (o.readOnly || c.stacked ? '' : '<span class="mm-kres" data-kres="' + esc(c.id) + '" title="שינוי הגודל"></span>') + '</div>';
    }).join('');
    const cards = items.map((i) => {
      const p = pos[i.id], s = i.sourceId ? U.sourceById(board, i.sourceId) : null, z = M.ZONES.find((x) => x.k === i.zone) || M.ZONES[0];
      const al = (board.alerts || []).filter((a) => a.itemId === i.id);
      const inStack = stackIdx[i.id] !== undefined, top = inStack && stackIdx[i.id] === items.filter((x) => x.cluster === i.cluster).length - 1;
      const links = (board.links || []).filter((l) => l.from === i.id).map((l) => { const to = byId[l.to]; return to ? '<div>↳ ' + esc((M.RELATIONS.find((r) => r.k === l.rel) || {}).t) + ': ' + esc(to.text.slice(0, 40)) + (o.readOnly ? '' : ' <button type="button" class="dlm-btn small" data-unlink="' + esc(l.id) + '" aria-label="הסרת הקשר">×</button>') + '</div>' : ''; }).join('');
      return '<div class="dlm-item mm-card' + (o.sel === i.id ? ' sel' : '') + (inStack ? ' in-stack' : '') + '" data-item="' + esc(i.id) + '" style="left:' + p.x + 'px;top:' + p.y + 'px;--zc:' + ZCOL[z.k] + (inStack ? ';z-index:' + (10 + stackIdx[i.id]) : '') + '">'
        + '<div class="mm-zone">' + esc(z.t) + (i.origin === 'facilitator' ? ' · מנחה' : '') + '</div>'
        + (s ? M.dotHTML(U.scoreNow(s, board)) + ' ' : '') + (al.length ? '<span class="dlm-warnmark" title="התרעה: לבדיקה">⚠</span> ' : '')
        + '<span class="mm-text">' + esc(i.text) + '</span>'
        + (s && s.fileId ? '<div class="mm-file">📎 ' + esc(s.fileName || 'קובץ') + '</div>' : '')
        + '<div class="meta">' + (i.origin === 'ai' ? '<span class="dlm-tag ai">AI</span>' : '') + (i.confidence ? '<span class="dlm-tag">ביטחון: ' + esc(conf(i.confidence)) + '</span>' : '') + '<span>' + esc(i.by || '') + '</span>'
        + (inStack && top ? '<span class="dlm-tag">ערימה</span>' : '') + '</div>'
        + '<details class="mm-more"><summary aria-label="פעולות על הכרטיס">⋯</summary><div class="acts">'
        + (s ? '<button type="button" data-src="' + esc(s.id) + '">כרטיס המקור</button>' : '')
        + (o.readOnly ? '' : '<button type="button" data-edit="' + esc(i.id) + '">עריכה</button><button type="button" data-link="' + esc(i.id) + '">קשר לכרטיס</button>'
          + (i.zone !== 'sources' && o.conf !== false ? '<button type="button" data-conf="' + esc(i.id) + '">מידת ביטחון</button>' : '')
          + (o.manip !== false ? '<button type="button" data-alert="' + esc(i.id) + '">בדיקת סימני מניפולציה</button>' : '')
          + (i.cluster ? '<button type="button" data-unk="' + esc(i.id) + '">הוצאה מהקבוצה</button>' : '')
          + '<button type="button" data-del="' + esc(i.id) + '">הסרה</button>')
        + '</div>' + (links ? '<div class="dlm-links">' + links + '</div>' : '') + '</details></div>';
    }).join('');
    let cw = W, ch = H;
    items.forEach((i) => { const p = pos[i.id]; if (p) { cw = Math.max(cw, p.x + CW + 60); ch = Math.max(ch, p.y + 220); } });
    clusters.forEach((c) => { cw = Math.max(cw, c.x + c.w + 40); ch = Math.max(ch, c.y + c.h + 40); });
    const tools = '<div class="mm-tools">'
      + (o.readOnly ? '' : '<form class="dlm-add mm-addcard" data-addto="claims"><select class="mm-zsel" aria-label="לאיזה אזור">' + M.ZONES.filter((z) => z.k !== 'sources').map((z) => '<option value="' + z.k + '">' + esc(z.t) + '</option>').join('') + '</select>'
        + '<input type="text" aria-label="כרטיס חדש" placeholder="כרטיס חדש: טענה, שאלה, מידע חסר…"><button class="dlm-btn small main">➕ כרטיס</button></form>'
        + '<button type="button" class="dlm-btn small" data-addsrc="1">➕ מקור או קובץ</button><button type="button" class="dlm-btn small" data-kadd="1">🗂 קבוצה חדשה</button>')
      + '<span class="mm-sp"></span><button type="button" class="dlm-btn small" data-zoom="-1" aria-label="הקטנה">−</button><button type="button" class="dlm-btn small" data-zoom="0" title="התאמה למסך">⤢</button><button type="button" class="dlm-btn small" data-zoom="1" aria-label="הגדלה">+</button>'
      + '<label class="mm-zt"><input type="checkbox" data-zones' + (view.zones ? ' checked' : '') + '> אזורי הלוח</label>'
      + '<button type="button" class="dlm-btn small main" data-full="1">' + (view.full ? '✕ יציאה ממסך מלא' : '⛶ מסך מלא') + '</button></div>'
      + (o.readOnly ? '' : '<p class="dlm-hint mm-help">גוררים כרטיס לכל מקום בלוח. כרטיס שנגרר לתוך קבוצה מצטרף אליה. "⧉ ערימה" מקבצת את הכרטיסים של הקבוצה, ו"⋯" פותח פעולות על כרטיס.</p>');
    return '<div class="mm-wrap' + (view.full ? ' mm-full' : '') + '">' + tools + '<div class="mm-view" tabindex="0" aria-label="הלוח כמפת חשיבה"><div class="mm-size" style="width:' + Math.round(W * view.zoom) + 'px;height:' + Math.round(H * view.zoom) + 'px">'
      + '<div class="mm-canvas" style="width:' + W + 'px;height:' + H + 'px;transform:scale(' + view.zoom + ')">' + zonesBg + clusterHTML + '<svg class="mm-lines" width="' + W + '" height="' + H + '"></svg>' + cards + '</div></div></div></div>';
  }

  function drawLines(root, board) {
    const svg = root.querySelector('.mm-lines'); if (!svg) return;
    const box = (id) => { const el = root.querySelector('.mm-card[data-item="' + CSS.escape(id) + '"]'); return el ? { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 } : null; };
    svg.innerHTML = '<defs>' + Object.entries(REL_COL).map(([k, c]) => '<marker id="mm-ar-' + k + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="' + c + '"/></marker>').join('') + '</defs>'
      + (board.links || []).map((l) => {
        const a = box(l.from), b = box(l.to); if (!a || !b) return '';
        const c = REL_COL[l.rel] || '#556', t = (M.RELATIONS.find((r) => r.k === l.rel) || {}).t || '';
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        return '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="' + c + '" stroke-width="2.5" stroke-opacity=".75" marker-end="url(#mm-ar-' + l.rel + ')"/>'
          + '<g transform="translate(' + mx + ',' + my + ')"><rect x="-' + (t.length * 5 + 10) + '" y="-12" width="' + (t.length * 10 + 20) + '" height="24" rx="12" fill="#fff" stroke="' + c + '"/><text text-anchor="middle" y="5" font-size="14" fill="' + c + '" font-family="Assistant,sans-serif">' + esc(t) + '</text></g>';
      }).join('');
  }

  function bind(root, o) {
    o = o || {};
    const board = o.board, vw = root.querySelector('.mm-view'), canvas = root.querySelector('.mm-canvas');
    if (!vw || !canvas) return;
    if (view.sx === null) { view.sx = vw.scrollWidth; view.sy = 0; }
    vw.scrollLeft = view.sx; vw.scrollTop = view.sy;
    vw.addEventListener('scroll', () => { view.sx = vw.scrollLeft; view.sy = vw.scrollTop; });
    requestAnimationFrame(() => drawLines(root, board));
    root.querySelectorAll('[data-zoom]').forEach((b) => b.onclick = () => {
      const d = +b.dataset.zoom;
      view.zoom = d === 0 ? Math.max(0.3, Math.min(1, (vw.clientWidth - 20) / (canvas.offsetWidth || W))) : Math.max(0.3, Math.min(1.6, +(view.zoom + d * 0.15).toFixed(2)));
      saveView(); o.refresh();
    });
    // 17/11/2026 ("אפשר לפרוס את הלוח על רוב המסך שלי גם במצב עבודה"): מסך מלא, עם כל הכלים. Esc יוצא.
    const fb = root.querySelector('[data-full]'); if (fb) fb.onclick = () => { view.full = !view.full; o.refresh(); };
    if (!window.__mmEsc) { window.__mmEsc = true; document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && view.full && !document.querySelector('dialog[open]')) { const b = document.querySelector('.mm-full [data-full]'); if (b) b.click(); } }); }
    const zt = root.querySelector('[data-zones]'); if (zt) zt.onchange = () => { view.zones = zt.checked; saveView(); o.refresh(); };
    const zs = root.querySelector('.mm-zsel'); if (zs) zs.onchange = () => { zs.closest('form').dataset.addto = zs.value; };
    root.querySelectorAll('.mm-more').forEach((d) => d.addEventListener('toggle', () => { busy = d.open; if (d.open) root.querySelectorAll('.mm-more[open]').forEach((x) => { if (x !== d) x.open = false; }); }));
    if (o.readOnly) return;
    const z = () => view.zoom;
    const point = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / z(), y: (e.clientY - r.top) / z() }; };
    const clusterAt = (x, y, skip) => (board.clusters || []).slice().reverse().find((c) => c.id !== skip && x >= c.x && x <= c.x + (c.stacked ? 300 : c.w) && y >= c.y && y <= c.y + (c.stacked ? 230 : c.h));
    const send = async (input) => { try { await o.op(input); } catch (e) {} busy = false; o.refresh(); };
    // גרירת כרטיס
    root.querySelectorAll('.mm-card').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('button,summary,a,input,select,textarea,details[open] .acts')) return;
        const st = point(e), ox = el.offsetLeft, oy = el.offsetTop; let moved = false;
        el.setPointerCapture(e.pointerId); busy = true;
        const mv = (ev) => { const p = point(ev), dx = p.x - st.x, dy = p.y - st.y; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; el.classList.add('drag'); el.style.left = Math.round(ox + dx) + 'px'; el.style.top = Math.round(oy + dy) + 'px'; drawLines(root, board); };
        const up = () => {
          el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('drag');
          if (!moved) { busy = false; return; }
          const x = el.offsetLeft, y = el.offsetTop, k = clusterAt(x + el.offsetWidth / 2, y + 30);
          send({ kind: 'move', id: el.dataset.item, x, y, cluster: k ? k.id : null });
        };
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
    });
    // גרירת קבוצה (מהכותרת) ושינוי הגודל
    root.querySelectorAll('.mm-cluster').forEach((el) => {
      const id = el.dataset.cluster, head = el.querySelector('[data-kdrag]'), res = el.querySelector('[data-kres]');
      head.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('button')) return;
        const st = point(e), ox = el.offsetLeft, oy = el.offsetTop; let moved = false; head.setPointerCapture(e.pointerId); busy = true;
        const mine = Array.from(root.querySelectorAll('.mm-card')).filter((c) => { const it = (board.items || []).find((i) => i.id === c.dataset.item); return it && it.cluster === id; }).map((c) => [c, c.offsetLeft, c.offsetTop]);
        const mv = (ev) => { const p = point(ev), dx = p.x - st.x, dy = p.y - st.y; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; el.style.left = Math.round(ox + dx) + 'px'; el.style.top = Math.round(oy + dy) + 'px'; mine.forEach(([c, x, y]) => { c.style.left = Math.round(x + dx) + 'px'; c.style.top = Math.round(y + dy) + 'px'; }); drawLines(root, board); };
        const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); if (!moved) { busy = false; return; } send({ kind: 'cluster', action: 'move', id, x: el.offsetLeft, y: el.offsetTop }); };
        head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up);
      });
      if (res) res.addEventListener('pointerdown', (e) => {
        const st = point(e), ow = el.offsetWidth, oh = el.offsetHeight; res.setPointerCapture(e.pointerId); busy = true;
        const mv = (ev) => { const p = point(ev); el.style.width = Math.max(160, Math.round(ow + (p.x - st.x))) + 'px'; el.style.height = Math.max(120, Math.round(oh + (p.y - st.y))) + 'px'; };
        const up = () => { res.removeEventListener('pointermove', mv); res.removeEventListener('pointerup', up); send({ kind: 'cluster', action: 'edit', id, w: el.offsetWidth, h: el.offsetHeight }); };
        res.addEventListener('pointermove', mv); res.addEventListener('pointerup', up);
      });
    });
    root.querySelectorAll('[data-kstack]').forEach((b) => b.onclick = () => { const c = (board.clusters || []).find((x) => x.id === b.dataset.kstack); send({ kind: 'cluster', action: 'edit', id: b.dataset.kstack, stacked: !(c && c.stacked) }); });
    root.querySelectorAll('[data-kname]').forEach((b) => b.onclick = () => { const c = (board.clusters || []).find((x) => x.id === b.dataset.kname); const n = prompt('שם הקבוצה', c ? c.name : ''); if (n && n.trim()) send({ kind: 'cluster', action: 'edit', id: b.dataset.kname, name: n.trim() }); });
    root.querySelectorAll('[data-kdel]').forEach((b) => b.onclick = () => { if (confirm('לבטל את הקבוצה? הכרטיסים נשארים בלוח.')) send({ kind: 'cluster', action: 'remove', id: b.dataset.kdel }); });
    root.querySelectorAll('[data-unk]').forEach((b) => b.onclick = () => { const el = b.closest('.mm-card'); send({ kind: 'move', id: b.dataset.unk, x: el.offsetLeft + 60, y: el.offsetTop + 60, cluster: null }); });
    const ka = root.querySelector('[data-kadd]'); if (ka) ka.onclick = () => {
      const n = prompt('שם הקבוצה (למשל: טענות על ניגוד עניינים)', ''); if (n === null) return;
      const x = Math.round((vw.scrollLeft + vw.clientWidth / 2) / z() - 180), y = Math.round((vw.scrollTop + vw.clientHeight / 2) / z() - 130);
      send({ kind: 'cluster', action: 'add', name: n.trim() || 'קבוצה חדשה', x: Math.max(0, x), y: Math.max(0, y), w: 380, h: 280 });
    };
  }

  window.SBE_DLM_MAP = { html, bind, busy: () => busy, W, H };
})();
