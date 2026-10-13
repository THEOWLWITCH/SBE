(function () {
  'use strict';
  var content = document.getElementById('studies-content');
  var groupsNav = document.getElementById('studies-groups');
  var count = document.getElementById('studies-count');
  var openedUrls = new Map();

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function safeLink(value) {
    try { var url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch (_) { return ''; }
  }
  function revoke(url) {
    if (!openedUrls.has(url)) return;
    clearTimeout(openedUrls.get(url)); URL.revokeObjectURL(url); openedUrls.delete(url);
  }
  window.addEventListener('pagehide', function () { Array.from(openedUrls.keys()).forEach(revoke); });
  function date(value) {
    if (window.sbeDateIL) return window.sbeDateIL(value);
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return match ? match[3] + '.' + match[2] + '.' + match[1].slice(2) : '';
  }
  function amount(length) { return length === 1 ? 'חומר לימוד אחד' : length + ' חומרי לימוד'; }
  function errorText(error) {
    return error.status === 401 || error.status === 403
      ? 'הספרייה אינה פתוחה בכניסה הנוכחית. אפשר לחזור למרחב שלי ולבדוק את הכניסה.'
      : 'החומר לא נטען כעת. אפשר לבדוק את החיבור ולנסות שוב.';
  }
  async function openFile(item, button, status) {
    var popup = window.open('about:blank', '_blank');
    if (popup) { popup.opener = null; popup.document.title = item.title; popup.document.body.textContent = 'הקובץ בדרך...'; popup.document.body.dir = 'rtl'; }
    button.disabled = true; button.textContent = 'טוענים את הקובץ...'; status.textContent = '';
    try {
      var blob = await window.SBE_STUDIES.file(item.id), url = URL.createObjectURL(blob);
      openedUrls.set(url, setTimeout(function () {
        revoke(url);
        var ready = status.querySelector('.studies-ready-link');
        if (ready && ready.href === url) status.textContent = 'אפשר לפתוח את הקובץ שוב.';
      }, 10 * 60 * 1000));
      if (popup && !popup.closed) popup.location.replace(url);
      else {
        var link = node('a', 'studies-ready-link', 'הקובץ מוכן. פתיחה בחלון חדש');
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        status.appendChild(link);
      }
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      status.textContent = errorText(error);
    } finally { button.disabled = false; button.textContent = 'פתיחת הקובץ ↗'; }
  }
  function material(item) {
    var card = node('article', 'studies-card');
    var previews = (Array.isArray(item.previews) ? item.previews : []).filter(function (url) {
      return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(url);
    }).slice(0, 3);
    var extension = item.file && item.file.name ? item.file.name.split('.').pop().toUpperCase() : '';
    if (previews.length) {
      var strip = node('div', 'studies-previews');
      previews.forEach(function (url, index) {
        var figure = node('figure', 'studies-preview'), image = node('img');
        image.src = url; image.alt = 'תצוגה מקדימה ' + (index + 1) + ' של ' + item.title; image.loading = 'lazy';
        figure.appendChild(image); figure.appendChild(node('figcaption', '', 'תצוגה ' + (index + 1)));
        strip.appendChild(figure);
      });
      card.appendChild(strip);
    } else {
      var cover = node('div', 'studies-no-preview');
      var icon = node('span', 'studies-file-icon', item.file ? '▤' : '↗'); icon.setAttribute('aria-hidden', 'true');
      cover.appendChild(icon); cover.appendChild(node('span', '', item.file ? 'חומר לקריאה ולהעמקה' : 'מרחיבים את המבט'));
      card.appendChild(cover);
    }
    var body = node('div', 'studies-card-body'), meta = node('div', 'studies-meta');
    if (item.file) meta.appendChild(node('span', 'studies-type', extension || 'קובץ'));
    else meta.appendChild(node('span', 'studies-type', 'קישור'));
    var time = node('time', '', date(item.date)); time.dateTime = item.date; meta.appendChild(time);
    body.appendChild(meta); body.appendChild(node('h3', '', item.title));
    if (item.description) body.appendChild(node('p', 'studies-description', item.description));
    if (item.file) {
      var filename = node('p', 'studies-filename', item.file.name); filename.dir = 'auto'; body.appendChild(filename);
    }
    var actions = node('div', 'studies-actions'), status = node('p', 'studies-card-status'); status.setAttribute('role', 'status');
    if (item.file) {
      var button = node('button', 'studies-btn', 'פתיחת הקובץ ↗'); button.type = 'button';
      button.addEventListener('click', function () { openFile(item, button, status); }); actions.appendChild(button);
    }
    var url = safeLink(item.url);
    if (url) {
      var link = node('a', item.file ? 'studies-btn studies-btn-secondary' : 'studies-btn', 'פתיחת הקישור ↗');
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; actions.appendChild(link);
    }
    body.appendChild(actions); body.appendChild(status); card.appendChild(body);
    return card;
  }
  function state(title, message, icon, retry) {
    var box = node('div', 'studies-state'); box.setAttribute('role', retry ? 'alert' : 'status');
    var mark = node('span', 'studies-state-icon', icon); mark.setAttribute('aria-hidden', 'true');
    box.appendChild(mark); box.appendChild(node('h2', '', title)); box.appendChild(node('p', '', message));
    if (retry) {
      var button = node('button', 'studies-btn studies-btn-secondary', 'ניסיון נוסף'); button.type = 'button';
      button.addEventListener('click', load); box.appendChild(button);
    }
    content.replaceChildren(box);
  }
  function render(data) {
    var groups = Array.isArray(data.groups) ? data.groups : [], items = Array.isArray(data.items) ? data.items : [];
    count.textContent = amount(items.length); count.hidden = !items.length;
    groupsNav.replaceChildren(); content.replaceChildren();
    if (!items.length) {
      groupsNav.hidden = true;
      state('מרחב ללמידה משותפת', 'חומרי הלימוד יופיעו כאן כשיתווספו לספרייה.', '▤', false);
      return;
    }
    var buckets = new Map(groups.map(function (group) { return [group.id, []]; })), ungrouped = [];
    items.forEach(function (item) {
      if (item.groupId && buckets.has(item.groupId)) buckets.get(item.groupId).push(item);
      else ungrouped.push(item);
    });
    var sections = groups.map(function (group) { return { title: group.title, items: buckets.get(group.id) }; });
    if (ungrouped.length) sections.push({ title: groups.length ? 'חומרי לימוד נוספים' : 'חומרי לימוד', items: ungrouped });
    sections.forEach(function (group, index) {
      var id = 'studies-group-' + index, section = node('section', 'studies-section'); section.id = id;
      var heading = node('div', 'studies-section-heading'), title = node('h2', '', group.title); title.id = id + '-title';
      section.setAttribute('aria-labelledby', title.id);
      heading.appendChild(title); heading.appendChild(node('span', '', amount(group.items.length))); section.appendChild(heading);
      var cards = node('div', 'studies-grid');
      group.items.forEach(function (item) { cards.appendChild(material(item)); });
      if (!group.items.length) cards.appendChild(node('p', 'studies-group-empty', 'חומרי הלימוד בקבוצה יופיעו כאן.'));
      section.appendChild(cards); content.appendChild(section);
      var link = node('a', '', group.title); link.href = '#' + id; groupsNav.appendChild(link);
    });
    groupsNav.hidden = sections.length < 2;
  }
  async function load() {
    content.setAttribute('aria-busy', 'true'); groupsNav.hidden = true; count.hidden = true;
    state('חומרי הלימוד בדרך', 'טוענים את הספרייה...', '◌', false);
    try { render(await window.SBE_STUDIES.call('list')); }
    catch (error) { state('הספרייה לא נטענה כעת', errorText(error), '◌', true); }
    finally { content.setAttribute('aria-busy', 'false'); }
  }
  try {
    var home = sessionStorage.getItem('sbe.session.homeUrl');
    if (/^[a-z0-9-]+\.html(?:[?#][^\s]*)?$/i.test(home || '')) document.getElementById('studies-home').href = home;
  } catch (_) {}
  load();
})();
