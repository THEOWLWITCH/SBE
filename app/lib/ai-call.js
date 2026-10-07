// Shared authenticated background call. Caller may cancel with {signal}.
(function () {
  "use strict";
  async function post(url, body, ms, signal) {
    const ctrl = new AbortController(), abort = () => ctrl.abort();
    const timer = setTimeout(abort, ms);
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, {once:true});
    try {
      const res = await fetch(url, {method:"POST", headers:window.sbeAIHeaders(), body:JSON.stringify(body), signal:ctrl.signal});
      const raw = await res.text();
      let data;
      try {data = JSON.parse(raw);} catch {throw new Error("החיבור לשרת נקטע באמצע (" + res.status + ")");}
      if (!res.ok || data.error) {
        const error = new Error(data.error || ("שגיאת שרת " + res.status));
        error.status = res.status;
        throw error;
      }
      return data;
    } finally {clearTimeout(timer); signal?.removeEventListener("abort", abort);}
  }

  function sleep(ms, signal) {
    return new Promise((resolve,reject) => {
      if (signal?.aborted) return reject(new DOMException("Cancelled","AbortError"));
      const abort = () => {clearTimeout(timer); reject(new DOMException("Cancelled","AbortError"));};
      const timer = setTimeout(() => {signal?.removeEventListener("abort",abort); resolve();},ms);
      signal?.addEventListener("abort",abort,{once:true});
    });
  }

  async function sbeCallAI(server, body, timeoutMs, options = {}) {
    const requestId = body.requestId || crypto.randomUUID();
    const start = await post(server + "/api/complete", {...body,requestId,async:true},90000,options.signal);
    if (!start.jobId) {
      if (typeof start.text === "string") return start.text;
      throw new Error("המודל לא החזיר תשובה");
    }
    const t0 = Date.now(), limit = (timeoutMs || 60000) + 120000;
    let misses = 0;
    try {
      while (Date.now() - t0 < limit) {
        await sleep(document.hidden ? 8000 : 3000,options.signal);
        let data;
        try {
          data = await post(server + "/api/pipeline-status",{jobId:start.jobId},30000,options.signal);
          misses = 0;
        } catch (error) {
          if (error.name === "AbortError" || [401,403,404,410].includes(error.status)) throw error;
          if (++misses >= 20) throw new Error("החיבור לשרת נקטע לזמן ארוך");
          continue;
        }
        if (data.status === "done" && typeof data.text === "string") return data.text;
        if (["error","cancelled","expired","lost","unknown"].includes(data.status))
          throw new Error(data.error || "הבקשה נעצרה. אפשר לנסות מחדש; הטיוטה הקודמת נשמרה.");
      }
      throw new Error("timeout: הקריאה למודל נמשכה יותר מדי");
    } catch (error) {
      await post(server + "/api/pipeline-cancel",{jobId:start.jobId},10000).catch(() => {});
      throw error;
    }
  }
  window.sbeCallAI = sbeCallAI;
})();
