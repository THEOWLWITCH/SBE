(function(root){
  'use strict';

  function el(tag, attrs, text){
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key,value]) => {
      if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    });
    if (text != null) node.textContent = text;
    return node;
  }
  function button(text, run, cls){
    const node = el('button', {type:'button', class:'sa-button ' + (cls || '')}, text);
    node.addEventListener('click', run);
    return node;
  }
  function field(label, input){
    const wrap = el('label', {class:'sa-field'});
    input.setAttribute('aria-label', label);
    wrap.append(el('span', {class:'sa-label'}, label), input);
    return wrap;
  }
  function errorText(error){
    if (error.status === 403) return 'הכניסה הסתיימה או שאין הרשאה לניהול החומרים. אפשר להיכנס שוב לניהול.';
    return error.message || 'הפעולה לא הושלמה. אפשר לנסות שוב.';
  }

  function mount(container, options){
    const client = root.SBE_STUDIES;
    let data = {groups:[], items:[]};
    const top = el('div', {class:'sa-top'});
    top.append(el('h2', {}, 'לימודי חוסן חברתי'));
    const actions = el('div', {class:'sa-actions'});
    const add = button('העלאת חומר', () => itemEditor(), 'primary');
    const addGroup = button('הוספת קבוצה', () => groupEditor());
    actions.append(add, addGroup, el('a', {class:'sa-button', href:'social-resilience-studies.html', target:'_blank', rel:'noopener'}, 'צפייה בדף'));
    top.append(actions);
    const note = el('div', {class:'sa-note', role:'status', 'aria-live':'polite'});
    const content = el('div', {});
    container.append(top, note, content);
    const token = () => options.token();
    const call = (action, extra) => client.call(action, extra || {}, token());
    function notify(text, error){
      note.className = 'sa-note' + (error ? ' sa-error' : '');
      note.textContent = text;
      if (error && error.status === 403) note.append(' ', el('a', {href:'entry.html'}, 'כניסה מחדש'));
    }
    async function load(){
      add.disabled = addGroup.disabled = true;
      try {
        data = await call('list');
        render();
        add.disabled = addGroup.disabled = false;
      } catch(error) {
        notify(errorText(error), error);
        content.replaceChildren(button('ניסיון נוסף', load));
      }
    }
    function render(){
      content.replaceChildren();
      if (!data.groups.length && !data.items.length) {
        content.append(el('p', {class:'sa-empty'}, 'כאן יופיעו החומרים שלך. אפשר להתחיל בקבוצה או בחומר הראשון.'));
        return;
      }
      const groups = data.groups.slice();
      const buckets = new Map(groups.map(group => [group.id, []]));
      data.items.forEach(item => {
        if (!buckets.has(item.groupId)) buckets.set(item.groupId, []);
        buckets.get(item.groupId).push(item);
      });
      if (buckets.has('')) groups.push({id:'', title:'ללא קבוצה'});
      groups.forEach(group => {
        const items = buckets.get(group.id);
        const box = el('section', {class:'sa-group'});
        const head = el('div', {class:'sa-group-head'});
        const title = el('div', {});
        title.append(el('h3', {}, group.title), el('span', {class:'sa-count'}, items.length + ' חומרים'));
        head.append(title);
        if (group.id) {
          const manage = el('div', {class:'sa-actions'});
          manage.append(button('עריכת כותרת', () => groupEditor(group)), button('מחיקת קבוצה', async () => {
            if (items.length) { notify('כדי למחוק את הקבוצה, אפשר להעביר את החומרים לקבוצה אחרת דרך עריכת החומר.'); return; }
            if (!root.confirm('למחוק את הקבוצה "' + group.title + '"?')) return;
            try { await call('groupDelete', {id:group.id}); await load(); notify('הקבוצה נמחקה.'); }
            catch(error) { notify(errorText(error), error); }
          }, 'danger'));
          head.append(manage);
        }
        box.append(head);
        if (!items.length) box.append(el('p', {class:'sa-empty'}, 'עדיין אין חומרים בקבוצה הזאת.'));
        items.forEach(item => {
          const row = el('article', {class:'sa-item'});
          if (item.previews.length) row.append(el('img', {class:'sa-cover', src:item.previews[0], loading:'lazy', alt:'השקופית הראשונה של ' + item.title}));
          const copy = el('div', {class:'sa-item-copy'});
          copy.append(el('h4', {}, item.title));
          if (item.description) copy.append(el('p', {}, item.description));
          copy.append(el('div', {class:'sa-meta'}, root.sbeDateIL(item.date) + (item.file ? ' · ' + item.file.name : ' · קישור')));
          row.append(copy);
          const manage = el('div', {class:'sa-actions'});
          manage.append(button('עריכה', () => itemEditor(item)), button('מחיקה', async () => {
            if (!root.confirm('למחוק את החומר "' + item.title + '"?')) return;
            try { await call('delete', {id:item.id}); await load(); notify('החומר נמחק.'); }
            catch(error) { notify(errorText(error), error); }
          }, 'danger'));
          row.append(manage);
          box.append(row);
        });
        content.append(box);
      });
    }
    function dialog(title){
      const modal = el('dialog', {'aria-label':title});
      const form = el('form', {class:'sa-form'});
      form.append(el('h3', {}, title));
      modal.append(form);
      const error = el('div', {class:'sa-note sa-error', role:'alert'});
      const footer = el('div', {class:'sa-form-footer'});
      const save = el('button', {type:'submit', class:'sa-button primary'}, 'שמירה');
      let locked = false;
      function lock(value){
        locked = value;
        form.querySelectorAll('input,select,textarea,button').forEach(control => { control.disabled = value; });
      }
      footer.append(save, button('ביטול', () => { if (!locked) modal.close(); }));
      modal.addEventListener('cancel', event => { if (locked) event.preventDefault(); });
      modal.addEventListener('close', () => {
        modal.remove();
        if (options.onClose) options.onClose();
      });
      container.append(modal);
      return {modal, form, error, footer, save, lock, isLocked:() => locked};
    }
    function groupEditor(group){
      const ui = dialog(group ? 'עריכת כותרת הקבוצה' : 'הוספת קבוצה');
      const title = el('input', {type:'text', maxlength:'120', required:'', autocomplete:'off'});
      title.value = group ? group.title : '';
      ui.form.append(field('כותרת הקבוצה', title), ui.error, ui.footer);
      ui.form.addEventListener('submit', async event => {
        event.preventDefault();
        if (ui.isLocked()) return;
        ui.lock(true);
        ui.error.textContent = '';
        try {
          await call('groupSave', {group:{...(group ? {id:group.id} : {}), title:title.value.trim()}});
          await load(); notify('הקבוצה נשמרה.'); ui.modal.close();
        } catch(error) { ui.error.textContent = errorText(error); ui.lock(false); }
      });
      ui.modal.showModal();
      title.focus();
    }
    function itemEditor(item){
      const ui = dialog(item ? 'עריכת חומר' : 'העלאת חומר');
      let previews = item ? item.previews.slice() : [];
      let revision = 0, busy = false, saving = false;
      const title = el('input', {type:'text', maxlength:'200', required:'', autocomplete:'off'});
      title.value = item ? item.title : '';
      const group = el('select', {});
      group.append(el('option', {value:''}, 'ללא קבוצה'));
      data.groups.forEach(g => group.append(el('option', {value:g.id}, g.title)));
      group.value = item ? item.groupId : '';
      const date = el('input', {type:'date', required:''});
      date.value = item ? item.date : client.today();
      const description = el('textarea', {rows:'4', maxlength:'5000'});
      description.value = item ? item.description : '';
      const url = el('input', {type:'url', placeholder:'https://', maxlength:'2000'});
      url.value = item ? item.url : '';
      const file = el('input', {type:'file', accept:'.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp'});
      const remove = el('input', {type:'checkbox'});
      const previewFiles = el('input', {type:'file', accept:'image/jpeg,image/png,image/webp', multiple:''});
      const previewStatus = el('p', {class:'sa-help', role:'status', 'aria-live':'polite'});
      const strip = el('div', {class:'sa-preview-strip'});
      function showPreviews(){
        strip.replaceChildren();
        previews.forEach((src,index) => {
          const wrap = el('div', {class:'sa-preview'});
          const erase = el('button', {type:'button', 'aria-label':'הסרת תצוגה ' + (index + 1)}, '×');
          erase.addEventListener('click', () => { previews.splice(index,1); showPreviews(); });
          wrap.append(el('img', {src, alt:'תצוגה מקדימה ' + (index + 1)}), erase);
          strip.append(wrap);
        });
      }
      function setBusy(value){ busy = value; ui.save.disabled = busy || saving; }
      function setSaving(value){ saving = value; ui.lock(value); ui.save.disabled = busy || saving; }
      file.addEventListener('change', async () => {
        const current = ++revision;
        previews = [];
        showPreviews();
        previewStatus.textContent = '';
        const selected = file.files[0];
        if (!selected) { if (item && !remove.checked) previews = item.previews.slice(); showPreviews(); setBusy(false); return; }
        if (selected.size > 50 * 1024 * 1024) { setBusy(false); previewStatus.textContent = 'אפשר לצרף קובץ בגודל של עד 50 MB.'; return; }
        remove.checked = false;
        setBusy(true);
        previewStatus.textContent = 'מכינה תצוגה מקדימה...';
        try {
          const images = await client.previews(selected);
          if (current !== revision || !ui.modal.open) return;
          previews = images;
          previewStatus.textContent = images.length ? 'התצוגה המקדימה מוכנה.' : 'אפשר לצרף תמונות של השקופיות הראשונות לתצוגה מקדימה.';
          showPreviews();
        } catch(error) {
          if (current === revision) previewStatus.textContent = 'לא נוצרה תצוגה אוטומטית. אפשר לצרף תמונות תצוגה ולשמור את הקובץ.';
        } finally { if (current === revision) setBusy(false); }
      });
      previewFiles.addEventListener('change', async () => {
        const current = ++revision;
        setBusy(true);
        previewStatus.textContent = 'מכינה את תמונות התצוגה...';
        try {
          const images = await client.images(Array.from(previewFiles.files));
          if (current !== revision || !ui.modal.open) return;
          previews = images; showPreviews(); previewStatus.textContent = 'תמונות התצוגה מוכנות.';
        } catch(error) { if (current === revision) previewStatus.textContent = errorText(error); }
        finally { if (current === revision) setBusy(false); }
      });
      remove.addEventListener('change', () => { if (remove.checked) { ++revision; file.value = ''; previews = []; showPreviews(); setBusy(false); } });
      ui.form.append(field('כותרת', title));
      const pair = el('div', {class:'sa-pair'});
      pair.append(field('קבוצה', group), field('תאריך', date));
      ui.form.append(pair, field('כמה מילים על החומר (לבחירתך)', description));
      if (item && item.file) {
        const current = el('div', {class:'sa-current-file'});
        const removeLabel = el('label', {});
        removeLabel.append(remove, ' הסרת הקובץ');
        current.append(el('span', {}, 'הקובץ המצורף: ' + item.file.name), removeLabel);
        ui.form.append(current);
      }
      ui.form.append(field('קובץ', file), el('p', {class:'sa-help'}, 'עד 50 MB. אפשר לצרף קובץ, קישור או את שניהם.'), field('או קישור', url));
      ui.form.append(field('תמונות לתצוגה מקדימה (לבחירתך)', previewFiles), el('p', {class:'sa-help'}, 'עד שלוש תמונות. ב־PDF מוצגים העמודים הראשונים; ב־PowerPoint נלקחת תמונת הפתיחה כשיש כזאת.'), previewStatus, strip, ui.error, ui.footer);
      showPreviews();
      ui.form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || saving) return;
        ui.error.textContent = '';
        if (!file.files.length && !(item && item.file && !remove.checked) && !url.value.trim()) {
          ui.error.textContent = 'כדי לשמור את החומר, אפשר לצרף קובץ או קישור.';
          return;
        }
        setSaving(true); ui.save.textContent = 'שומרת...';
        try {
          const extra = {item:{...(item ? {id:item.id} : {}), groupId:group.value, title:title.value.trim(), description:description.value.trim(), date:date.value, url:url.value.trim(), previews}};
          if (file.files.length) extra.file = await client.readFile(file.files[0]);
          else if (remove.checked) extra.file = null;
          await call('save', extra);
          await load(); notify('החומר נשמר.'); ui.modal.close();
        } catch(error) { ui.error.textContent = errorText(error); setSaving(false); ui.save.textContent = 'שמירה'; }
      });
      ui.modal.showModal(); title.focus();
    }
    content.append(el('p', {class:'sa-empty'}, 'טוענת את החומרים...'));
    load();
  }
  root.SBE_STUDIES_ADMIN = {mount};
})(window);
