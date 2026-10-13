/* Shared studies API and real-file previews. Vendor libraries load only on demand. */
(function (window) {
  'use strict';
  var API = 'https://sbe-server.onrender.com/api/studies';
  var MAX_FILE = 50 * 1024 * 1024, MAX_IMAGE = 1024 * 1024;
  var MIME = {
    pdf: 'application/pdf', ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain', csv: 'text/csv', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'
  };
  var script = window.document.currentScript;
  var base = new URL('.', script && script.src ? script.src : new URL('lib/studies-client.js', window.location.href));
  var vendor = new URL('vendor/studies/', base), pdfPromise, zipPromise;

  function token(value) {
    if (value !== undefined) return value;
    try { return window.sessionStorage.getItem('sbe.session.token') || ''; } catch (_) { return ''; }
  }
  async function request(action, extra, auth) {
    var body = Object.assign({}, extra || {}, { action: action, token: token(auth) });
    var response = await window.fetch(API, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!response.ok) {
      var detail;
      try { detail = await response.json(); } catch (_) { detail = {}; }
      var error = new Error(detail.error || detail.message || 'לא ניתן להשלים את הפעולה כעת. אפשר לנסות שוב.');
      error.status = response.status;
      if (detail.code) error.code = detail.code;
      throw error;
    }
    return response;
  }
  async function call(action, extra, auth) { return (await request(action, extra, auth)).json(); }
  async function attachment(id, auth) { return (await request('file', { id: id }, auth)).blob(); }
  function today() {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    var date = {};
    parts.forEach(function (part) { date[part.type] = part.value; });
    return date.year + '-' + date.month + '-' + date.day;
  }
  function mime(file) {
    if (!file || !file.name) throw new Error('אפשר לבחור קובץ לצירוף.');
    var extension = file.name.split('.').pop().toLowerCase();
    var normalized = MIME[extension], actual = String(file.type || '').toLowerCase().split(';')[0];
    var generic = !actual || actual === 'application/octet-stream' ||
      ((extension === 'pptx' || extension === 'docx' || extension === 'xlsx') && (actual === 'application/zip' || actual === 'application/x-zip-compressed'));
    var csvAlias = extension === 'csv' && (actual === 'text/plain' || actual === MIME.xls);
    if (!normalized || (!generic && !csvAlias && actual !== normalized)) {
      throw new Error('אפשר לצרף PDF, מצגת, מסמך, גיליון, טקסט או תמונת JPG, PNG או WebP.');
    }
    if (!Number.isFinite(file.size) || file.size > MAX_FILE) throw new Error('אפשר לצרף קובץ עד 50 MiB.');
    return normalized;
  }
  function base64(bytes) {
    var binary = '';
    for (var offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 32768));
    }
    return btoa(binary);
  }
  async function readAttachment(file) {
    var type = mime(file);
    return { name: file.name, mime: type, data: base64(new Uint8Array(await file.arrayBuffer())) };
  }
  function previewFailure() {
    return new Error('התצוגה המקדימה לא נוצרה מהקובץ. אפשר לצרף אותו ולהוסיף עד 3 תמונות תצוגה בנפרד.');
  }
  function canvas() {
    var result = window.document.createElement('canvas');
    if (!result.getContext('2d')) throw previewFailure();
    return result;
  }
  function jpeg(source) {
    var result = canvas(), ratio = Math.min(1, 1600 / Math.max(source.width, source.height));
    for (var attempt = 0; attempt < 6; attempt++) {
      result.width = Math.max(1, Math.round(source.width * ratio));
      result.height = Math.max(1, Math.round(source.height * ratio));
      var context = result.getContext('2d');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, result.width, result.height);
      context.drawImage(source, 0, 0, result.width, result.height);
      var url = result.toDataURL('image/jpeg', Math.max(0.48, 0.86 - attempt * 0.08));
      var encoded = url.split(',')[1] || '';
      var bytes = Math.floor(encoded.length * 3 / 4) - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
      if (url.indexOf('data:image/jpeg;base64,') === 0 && bytes <= MAX_IMAGE) {
        result.width = result.height = 0;
        return url;
      }
      ratio *= 0.75;
    }
    result.width = result.height = 0;
    throw previewFailure();
  }
  async function imagePreview(blob) {
    var url = window.URL.createObjectURL(blob), image = new window.Image();
    try {
      await new Promise(function (resolve, reject) {
        image.onload = resolve; image.onerror = function () { reject(previewFailure()); }; image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw previewFailure();
      return jpeg(image);
    } finally { window.URL.revokeObjectURL(url); }
  }
  async function images(files) {
    var selected = Array.from(files || []);
    if (selected.length > 3) throw new Error('אפשר להוסיף עד 3 תמונות תצוגה.');
    selected.forEach(function (file) {
      if (mime(file).indexOf('image/') !== 0) throw new Error('לתצוגה המקדימה אפשר לבחור תמונות JPG, PNG או WebP.');
    });
    var results = [];
    for (var file of selected) results.push(await imagePreview(new Blob([file], { type: mime(file) })));
    return results;
  }
  function loadPdf() {
    if (!pdfPromise) {
      pdfPromise = import(new URL('pdfjs/pdf.mjs', vendor).href).then(function (library) {
        library.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.mjs', vendor).href;
        return library;
      }).catch(function (error) { pdfPromise = null; throw error; });
    }
    return pdfPromise;
  }
  function loadZip() {
    if (!zipPromise) {
      zipPromise = new Promise(function (resolve, reject) {
        var element = window.document.createElement('script');
        element.src = new URL('jszip/jszip.min.js', vendor).href;
        element.onload = function () {
          if (window.JSZip) resolve(window.JSZip); else reject(previewFailure());
        };
        element.onerror = function () { element.remove(); reject(previewFailure()); };
        window.document.head.appendChild(element);
      }).catch(function (error) { zipPromise = null; throw error; });
    }
    return zipPromise;
  }
  async function pdfPreviews(file) {
    var library = await loadPdf(), task, document;
    try {
      task = library.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        cMapUrl: new URL('pdfjs/cmaps/', vendor).href, cMapPacked: true,
        iccUrl: new URL('pdfjs/iccs/', vendor).href,
        standardFontDataUrl: new URL('pdfjs/standard_fonts/', vendor).href,
        wasmUrl: new URL('pdfjs/wasm/', vendor).href, isEvalSupported: false
      });
      document = await task.promise;
      var results = [];
      for (var number = 1; number <= Math.min(3, document.numPages); number++) {
        var page = await document.getPage(number), initial = page.getViewport({ scale: 1 });
        var viewport = page.getViewport({ scale: Math.min(1.5, 1600 / Math.max(initial.width, initial.height)) });
        var output = canvas();
        output.width = Math.ceil(viewport.width); output.height = Math.ceil(viewport.height);
        try {
          await page.render({ canvasContext: output.getContext('2d'), viewport: viewport, background: '#ffffff' }).promise;
          results.push(jpeg(output));
        } finally { output.width = output.height = 0; page.cleanup(); }
      }
      return results;
    } finally { if (task) await task.destroy(); }
  }
  async function pptxPreviews(file) {
    var Zip = await loadZip(), zip = await Zip.loadAsync(await file.arrayBuffer());
    var name = Object.keys(zip.files).find(function (path) { return /^docProps\/thumbnail\.(jpe?g|png)$/i.test(path); });
    if (!name) return [];
    var bytes = await zip.file(name).async('uint8array');
    return [await imagePreview(new Blob([bytes], { type: /\.png$/i.test(name) ? 'image/png' : 'image/jpeg' }))];
  }
  async function previews(file) {
    var type = mime(file);
    try {
      if (type === MIME.pdf) return await pdfPreviews(file);
      if (type === MIME.pptx) return await pptxPreviews(file);
      if (type.indexOf('image/') === 0) return await images([file]);
      return [];
    } catch (_) { throw previewFailure(); }
  }
  window.SBE_STUDIES = { call: call, file: attachment, today: today, previews: previews, readFile: readAttachment, images: images };
})(window);
