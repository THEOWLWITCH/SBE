import { writeFileSync } from 'node:fs';

const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);

export function printTable(results) {
  console.log('\n' + '─'.repeat(78));
  console.log(pad('#', 4) + pad('קלט', 34) + pad('שערים', 10) + pad('זמן', 8) + 'הערה');
  console.log('─'.repeat(78));
  for (const r of results) {
    const g = r.error ? 'שגיאה' : `${r.gates.gates.filter(x => x.pass).length}/8`;
    const note = r.error ? String(r.error).slice(0, 30)
      : (r.gates.flagged[0]?.name ? `${r.gates.flagged[0].name}: ${r.gates.flagged[0].detail}`.slice(0, 34) : 'עבר הכל');
    console.log(pad(r.id, 4) + pad(r.title, 34) + pad(g, 10) + pad(r.ms ? (r.ms / 1000).toFixed(0) + 'ש' : '—', 8) + note);
  }
  console.log('─'.repeat(78));
  const ok = results.filter(r => !r.error && r.gates.passed).length;
  console.log(`${ok}/${results.length} עברו את השערים הוודאיים\n`);
}

export function writeReport(results, meta, path) {
  writeFileSync(path, JSON.stringify({ meta, results }, null, 2), 'utf8');
  console.log(`הדוח נשמר: ${path}`);
}
