(() => {
  'use strict';

  // item_score = avg(valid raters) / 3 * 100
  // valid raters: levels 0-3 only (level 4 = "לא יודע" excluded)
  function itemScore(ratings) {
    const valid = ratings.filter(r => typeof r === 'number' && r >= 0 && r <= 3);
    if (!valid.length) return null;
    return (valid.reduce((s, r) => s + r, 0) / valid.length) / 3 * 100;
  }

  // NON-NEGOTIABLE formula:
  //   good  = avg(positive item scores)
  //   harm  = avg(negative/reverse item scores)
  //   cap   = 100 - harm
  //   score = min(good, cap)   ← harm caps the score!
  // Example: good=74, harm=92 → cap=8 → score=8 (not 41)
  function domainScore(domainItems, responses) {
    const goodScores = [];
    const harmScores = [];

    for (const item of domainItems) {
      const ratings = (responses[item.i] || []).filter(r => r >= 0 && r <= 3);
      if (!ratings.length) continue;
      const s = itemScore(ratings);
      if (s === null) continue;
      (item.r === 0 ? goodScores : harmScores).push(s);
    }

    if (!goodScores.length && !harmScores.length) return null;

    const avg   = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const good  = avg(goodScores);
    const harm  = avg(harmScores);
    const cap   = 100 - harm;
    const score = Math.min(good, cap);

    return { score, good, harm, cap, capped: cap < good };
  }

  function scoreLabel(score) {
    if (score >= 75) return { label: 'תפקודי',       tier: 3, color: '#2e7d32', bg: '#e8f5e9' };
    if (score >= 50) return { label: 'חלקי',          tier: 2, color: '#ef6c00', bg: '#fff3e0' };
    if (score >= 25) return { label: 'חלש',           tier: 1, color: '#c62828', bg: '#ffebee' };
    return              { label: 'בקושי תפקודי', tier: 0, color: '#7b1fa2', bg: '#f3e5f5' };
  }

  function unknownRate(items, responses) {
    let total = 0, unknown = 0;
    for (const item of items) {
      for (const r of (responses[item.i] || [])) {
        total++;
        if (r === 4) unknown++;
      }
    }
    return total ? unknown / total : 0;
  }

  // FNV-1a-like hash, base36, exactly 12 chars
  function hashCode(voice, code) {
    const s = 'v' + voice + ':' + String(code).trim().toLowerCase().replace(/\s+/g, '');
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h = (h ^ s.charCodeAt(i)) >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    const a = (h >>> 0).toString(36).padStart(7, '0');
    const b = ((h ^ 0xdeadbeef) >>> 0).toString(36).padStart(5, '0');
    return (a + b).slice(0, 12);
  }

  // Build {itemIndex -> ratings[]} from response records for a given band
  function buildResponses(records, bandItems) {
    const resp = {};
    for (const rec of records) {
      for (let j = 0; j < rec.a.length && j < bandItems.length; j++) {
        if (rec.a[j] === null || rec.a[j] === undefined) continue;
        const idx = bandItems[j].i;
        if (!resp[idx]) resp[idx] = [];
        resp[idx].push(rec.a[j]);
      }
    }
    return resp;
  }

  // Build {voiceId -> {itemIndex -> ratings[]}}
  function buildVoiceResponses(records, bandItems) {
    const vr = {};
    for (const rec of records) {
      if (!vr[rec.v]) vr[rec.v] = {};
      for (let j = 0; j < rec.a.length && j < bandItems.length; j++) {
        if (rec.a[j] === null || rec.a[j] === undefined) continue;
        const idx = bandItems[j].i;
        if (!vr[rec.v][idx]) vr[rec.v][idx] = [];
        vr[rec.v][idx].push(rec.a[j]);
      }
    }
    return vr;
  }

  // Compute all domain scores with flags
  function computeDomains(records, allItems, band) {
    const bandItems = allItems.filter(it => it.b === band);
    const responses = buildResponses(records, bandItems);
    const voiceResp = buildVoiceResponses(records, bandItems);

    const domainMap = {};
    for (const item of bandItems) {
      const key = item.g + '\x00' + item.d;
      if (!domainMap[key]) domainMap[key] = { g: item.g, d: item.d, items: [] };
      domainMap[key].items.push(item);
    }

    return Object.entries(domainMap).map(([, dom]) => {
      const ds = domainScore(dom.items, responses);
      if (!ds) return null;

      const lbl     = scoreLabel(ds.score);
      const unk     = unknownRate(dom.items, responses);

      // Voice-separated scores for gap detection
      const vScores = {};
      for (const [v, vr] of Object.entries(voiceResp)) {
        const vds = domainScore(dom.items, vr);
        if (vds) vScores[v] = vds.score;
      }
      const vals    = Object.values(vScores);
      const gap     = vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : 0;

      const flags = [];
      if (ds.capped) flags.push('פועל, ופוגע');
      if (gap >= 30)  flags.push('קולות חלוקים');
      if (unk >= 0.34) flags.push('רבים אינם יודעים');

      return { g: dom.g, d: dom.d, ...ds, ...lbl, unknownRate: unk, gap, vScores, flags };
    }).filter(Boolean);
  }

  window.SBE_SCORE = {
    itemScore,
    domainScore,
    scoreLabel,
    unknownRate,
    hashCode,
    buildResponses,
    buildVoiceResponses,
    computeDomains,
  };
})();
