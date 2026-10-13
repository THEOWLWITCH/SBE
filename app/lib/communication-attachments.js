(function () {
  'use strict';
  const MAX_TEXT = 120000;
  const MAX_BYTES = 10 * 1024 * 1024;
  const MAX_XML_BYTES = 16 * 1024 * 1024;
  function checkText(text) {
    if (!String(text).trim()) throw new Error('לא נמצא בקובץ טקסט קריא. אפשר לצרף צילום ברור או להדביק את הטקסט.');
    if (text.length > MAX_TEXT) throw new Error('בקובץ יותר מ־120,000 תווים. אפשר לחלק אותו לקבצים קטנים יותר; הטקסט לא קוצר ולא נשמר.');
    return text;
  }
  function xmlText(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('לא ניתן לקרוא את מבנה קובץ ה־Word. אפשר להדביק את הטקסט או לייצא אותו כ־TXT.');
    const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    return Array.from(doc.getElementsByTagNameNS(ns, 'p')).map(p => {
      let value = '';
      function walk(n) {
        if (n.nodeType !== 1) return;
        if (n.namespaceURI === ns && n.localName === 't') { value += n.textContent; return; }
        if (n.namespaceURI === ns && n.localName === 'tab') { value += '\t'; return; }
        if (n.namespaceURI === ns && /^(br|cr)$/.test(n.localName)) { value += '\n'; return; }
        Array.from(n.children).forEach(walk);
      }
      walk(p);
      return value;
    }).join('\n');
  }
  async function docxText(file) {
    if (!window.JSZip) throw new Error('רכיב קריאת Word לא נטען. אפשר לרענן את הדף או להדביק את הטקסט.');
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files).filter(n => /^word\/(?:document|footnotes|endnotes|comments|header\d*|footer\d*)\.xml$/.test(n));
    if (!names.includes('word/document.xml')) throw new Error('לא נמצא מסמך Word קריא בקובץ. אפשר לשמור אותו שוב בפורמט DOCX.');
    // Bound decompression before reading any XML. The complete extracted text is kept or rejected, never sliced.
    let bytes = 0;
    for (const n of names) {
      const size = zip.files[n]._data && zip.files[n]._data.uncompressedSize;
      if (!Number.isSafeInteger(size) || size < 0) throw new Error('לא ניתן לבדוק את גודל קובץ ה־Word. אפשר לייצא אותו כ־TXT.');
      bytes += size;
      if (bytes > MAX_XML_BYTES) throw new Error('קובץ ה־Word גדול מדי לקריאה כאן. אפשר לחלק אותו; הקובץ לא נשמר.');
    }
    names.sort((a, b) => a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b));
    const parts = [];
    for (const n of names) {
      const text = xmlText(await zip.files[n].async('string'));
      if (text.trim()) parts.push(text);
    }
    return checkText(parts.join('\n\n'));
  }
  async function plainText(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let encoding = 'utf-8';
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    try { return checkText(new TextDecoder(encoding, { fatal: true }).decode(bytes)); }
    catch (e) {
      if (e instanceof TypeError) throw new Error('קידוד הטקסט לא נקרא. אפשר לשמור את הקובץ ב־UTF-8 ולהוסיף אותו שוב.');
      throw e;
    }
  }
  function base64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('הקובץ לא נקרא. אפשר לבחור אותו שוב.'));
      reader.readAsDataURL(file);
    });
  }
  async function prepare(file) {
    if (!file || !file.size) throw new Error('הקובץ ריק. אפשר לבחור קובץ אחר.');
    if (file.size > MAX_BYTES) throw new Error('הקובץ גדול מ־10 MB. אפשר להוסיף קובץ קטן יותר; הקובץ לא קוצר ולא נשמר.');
    const name = file.name || 'קובץ';
    const ext = name.toLowerCase().split('.').pop();
    if (ext === 'txt' || file.type === 'text/plain') return { kind: 'text', name, mediaType: 'text/plain', text: await plainText(file) };
    if (ext === 'docx') return { kind: 'text', name, mediaType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', text: await docxText(file) };
    if (ext === 'pdf' || file.type === 'application/pdf') return { kind: 'pdf', name, mediaType: 'application/pdf', data: await base64(file) };
    if (/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return { kind: 'image', name, mediaType: file.type, data: await base64(file) };
    throw new Error('פורמט הקובץ לא נתמך כאן. אפשר לצרף תמונת PNG, JPEG, WebP או GIF, קובץ PDF, DOCX או TXT.');
  }
  window.SBE_COMMUNICATION_ATTACHMENTS = Object.freeze({ prepare, MAX_TEXT, MAX_BYTES });
})();
