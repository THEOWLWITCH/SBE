// הצגת האתר מתוך מבנה התוכן (YS_DEFAULT או מה שנשמר בניהול). משותף לאתר ולתצוגה המקדימה בניהול.
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var safeUrl = function (u) {
    u = String(u || '').trim();
    if (/^(https?:\/\/|mailto:|tel:)/i.test(u) || /^#[\w-]+$/.test(u) || /^\/(?!\/)/.test(u)) return u;
    return '';
  };
  var fileUrl = function (f) { return f && f.id ? '/api/file?id=' + encodeURIComponent(f.id) : ''; };

  // **מודגש**, שורות "- " לתבליטים, "1. " לרשימה ממוספרת, שורה ריקה לפסקה, וקישורים.
  function inline(s) {
    s = esc(s);
    s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[\s(])((https?:\/\/)[^\s<)]+)/g, function (m, pre, url) { return pre + '<a href="' + url + '" target="_blank" rel="noopener">' + url.replace(/^https?:\/\//, '').replace(/\/$/, '') + '</a>'; });
    s = s.replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.-]+)/g, '$1<a href="mailto:$2">$2</a>');
    return s;
  }
  function rich(text) {
    var out = [], list = null;
    var close = function () { if (list) { out.push('</' + list + '>'); list = null; } };
    String(text || '').split('\n').forEach(function (raw) {
      var line = raw.trim(), m;
      if (!line) { close(); return; }
      if ((m = line.match(/^[-•*]\s+(.*)$/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
      if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
      if ((m = line.match(/^#{1,3}\s+(.*)$/))) { close(); out.push('<h3>' + inline(m[1]) + '</h3>'); return; }
      close(); out.push('<p>' + inline(line) + '</p>');
    });
    close();
    return out.join('');
  }

  function video(url) {
    var m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/);
    if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    m = String(url || '').match(/vimeo\.com\/(?:video\/)?(\d{5,12})/);
    if (m) return 'https://player.vimeo.com/video/' + m[1];
    return '';
  }
  var kb = function (n) { n = Number(n) || 0; return n > 1048576 ? (n / 1048576).toFixed(1) + ' מגה' : Math.max(1, Math.round(n / 1024)) + ' ק״ב'; };
  var ext = function (name) { return (String(name || '').match(/\.([a-z0-9]{1,5})$/i) || [, ''])[1].toUpperCase(); };

  function item(it, opt) {
    var head = (it.title ? '<h2>' + esc(it.title) + '</h2>' : '') + (it.date ? '<p class="date">' + esc(it.date) + '</p>' : '');
    var body = it.body ? '<div class="rich">' + rich(it.body) + '</div>' : '';
    var cls = 'item it-' + it.type + (it.hidden ? ' draft' : '');
    var tag = it.hidden && opt.preview ? '<span class="draft-tag">טיוטה: לא מוצג באתר</span>' : '';
    if (it.type === 'file') {
      var u = fileUrl(it.file);
      var btn = u ? '<a class="btn" href="' + u + '" target="_blank" rel="noopener">⬇ ' + esc(it.label || 'לקובץ') + ' <small>' + esc(ext(it.file.name)) + ' · ' + kb(it.file.size) + '</small></a>' : '<p class="muted">(עוד לא הועלה קובץ)</p>';
      return '<article class="' + cls + '">' + tag + head + body + btn + '</article>';
    }
    if (it.type === 'link') {
      var l = safeUrl(it.url);
      var ext2 = /^https?:/.test(l) ? ' target="_blank" rel="noopener"' : '';
      return '<article class="' + cls + '">' + tag + head + body + (l ? '<a class="btn ghost" href="' + esc(l) + '"' + ext2 + '>' + esc(it.label || 'לקישור') + ' ←</a>' : '') + '</article>';
    }
    if (it.type === 'image') {
      var iu = fileUrl(it.file);
      return '<figure class="' + cls + '">' + tag + (iu ? '<img src="' + iu + '" alt="' + esc(it.title || '') + '" loading="lazy">' : '<p class="muted">(עוד לא הועלתה תמונה)</p>') + (it.title || it.body ? '<figcaption>' + (it.title ? '<b>' + esc(it.title) + '</b>' : '') + (it.body ? rich(it.body) : '') + '</figcaption>' : '') + '</figure>';
    }
    if (it.type === 'video') {
      var v = video(it.url);
      return '<article class="' + cls + '">' + tag + head + (v ? '<div class="vid"><iframe src="' + v + '" title="' + esc(it.title || 'סרטון') + '" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' : (it.url ? '<a class="btn ghost" href="' + esc(safeUrl(it.url)) + '" target="_blank" rel="noopener">לסרטון ←</a>' : '')) + body + '</article>';
    }
    return '<article class="' + cls + '">' + tag + head + body + '</article>';
  }

  function contactCard(b) {
    var rows = [];
    if (b.email) rows.push('<a class="ct" href="mailto:' + esc(b.email) + '"><span>✉</span><b dir="ltr">' + esc(b.email) + '</b></a>');
    if (b.phone) {
      var digits = String(b.phone).replace(/[^\d]/g, ''), intl = digits.replace(/^0/, '972');
      rows.push('<a class="ct" href="tel:' + esc(digits) + '"><span>☎</span><b dir="ltr">' + esc(b.phone) + '</b></a>');
      rows.push('<a class="ct" href="https://wa.me/' + esc(intl) + '" target="_blank" rel="noopener"><span>💬</span><b>וואטסאפ</b></a>');
    }
    return rows.length ? '<div class="contact">' + rows.join('') + '</div>' : '';
  }

  // site: מבנה התוכן; pageId: הדף להצגה; opt.preview: להראות גם טיוטות
  function renderPage(site, pageId, opt) {
    opt = opt || {};
    var pages = (site.pages || []).filter(function (p) { return opt.preview || !p.hidden; });
    var home = pages.filter(function (p) { return p.home; })[0] || pages[0];
    var page = pages.filter(function (p) { return p.id === pageId; })[0] || home;
    if (!page) return '';
    var b = site.brand || {};
    var items = (page.items || []).filter(function (it) { return opt.preview || !it.hidden; });
    var html = '';
    if (page.home) {
      var photo = b.photo ? '<img class="portrait" src="' + fileUrl(b.photo) + '" alt="' + esc(b.name) + '">' : '<div class="portrait mono" aria-hidden="true">' + esc(String(b.name || '').replace(/^ד״ר\s*/, '').slice(0, 1)) + '</div>';
      html += '<section class="hero">' + photo + '<div><p class="eyebrow">' + esc(b.title) + '</p><h1>' + esc(b.name) + '</h1>' + (b.tagline ? '<p class="tagline">' + esc(b.tagline) + '</p>' : '') + '</div></section>';
      if (page.intro) html += '<section class="intro rich">' + rich(page.intro) + '</section>';
      html += items.map(function (it) { return item(it, opt); }).join('');
      var others = pages.filter(function (p) { return !p.home; });
      if (others.length) html += '<section class="cards">' + others.map(function (p) {
        var first = String(p.intro || '').split('\n')[0];
        if (first.length > 150) first = first.slice(0, 147).replace(/\s+\S*$/, '') + '…';
        return '<a class="card" href="#/' + esc(p.id) + '"><b>' + esc(p.title) + '</b>' + (first ? '<span>' + esc(first) + '</span>' : '') + '<i>←</i></a>';
      }).join('') + '</section>';
    } else {
      html += '<header class="page-head"><h1>' + esc(page.title) + '</h1>' + (page.hidden && opt.preview ? '<span class="draft-tag">דף מוסתר</span>' : '') + '</header>';
      if (page.intro) html += '<section class="intro rich">' + rich(page.intro) + '</section>';
      if (page.id === 'contact') html += contactCard(b);
      html += items.map(function (it) { return item(it, opt); }).join('');
    }
    return html;
  }

  function nav(site, current, opt) {
    return (site.pages || []).filter(function (p) { return (opt && opt.preview) || !p.hidden; }).map(function (p) {
      return '<a href="#/' + esc(p.id) + '"' + (p.id === current ? ' aria-current="page"' : '') + '>' + esc(p.nav || p.title) + '</a>';
    }).join('');
  }

  window.YS = { esc: esc, rich: rich, renderPage: renderPage, nav: nav, contactCard: contactCard, fileUrl: fileUrl, video: video, kb: kb };
})();
