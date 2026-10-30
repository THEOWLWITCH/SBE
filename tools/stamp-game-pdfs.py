#!/usr/bin/env python3
"""תחתית אחידה בכל עמוד של קובצי המשחקים להורדה (30/10/2026):
"בכל קובץ pdf יש להוסיף את הלוגו עם הכיתוב וזכויות יוצרים ופרטי קשר בתחתית הדף".
מכסה את פס התחתית (16 מ"מ) ומצייר: לוגו עם הכיתוב, זכויות יוצרים, אתר, מייל ומספר עמוד.
אפשר להריץ שוב אחרי הפקה מחדש של קובץ (הכיסוי מחליף את התחתית הקודמת).
שימוש: python3 tools/stamp-game-pdfs.py [קבצים...]  (ברירת מחדל: כל קובצי המשחקים ב-app/assets)"""
import sys, os, glob, base64, io, asyncio
from pypdf import PdfReader, PdfWriter
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'app', 'assets')
GAMES = ['game-*.pdf', 'no-panic-cards.pdf', 'resilience-journey-board.pdf', 'resilience-memory-*.pdf', 'resilience-quartets.pdf']
LOGO = 'data:image/jpeg;base64,' + base64.b64encode(open(os.path.join(ROOT, 'tools', 'fonts', 'logo-footer.jpg'), 'rb').read()).decode()
YEAR = '2026'
FD = os.path.join(ROOT, 'tools', 'fonts')
FONTS = ''.join("@font-face{font-family:Assistant;font-weight:%s;src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s}" % (wt, base64.b64encode(open(os.path.join(FD, 'assistant-%s-%s-normal.woff2' % (sub, wt)), 'rb').read()).decode(), rng)
    for sub, rng in (('hebrew', 'U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F'), ('latin', 'U+0000-00FF,U+2000-206F,U+20AC,U+2122')) for wt in ('400', '700'))

def page_html(w, h, i, n):
    return f'''<section style="position:relative;width:{w}pt;height:{h}pt;page-break-after:always;overflow:hidden">
<div style="position:absolute;left:0;right:0;bottom:0;height:16mm;background:#fff"></div>
<div style="position:absolute;left:14mm;right:14mm;bottom:3mm;height:12mm;border-top:.6pt solid #cfdce6;display:flex;align-items:center;gap:5mm;direction:rtl;font-family:Assistant,'Noto Sans Hebrew',Arial,sans-serif;color:#3b5266">
  <img src="{LOGO}" style="height:12.5mm;width:auto;flex:0 0 auto;margin-top:.5mm">
  <div style="flex:1;line-height:1.35;font-size:7.4pt;margin-top:1mm">
    <div><b style="color:#1d3f63">© {YEAR} ד״ר יעל שדה · Begood.</b> כל הזכויות שמורות. ההדפסה מותרת לשימוש בקבוצה, בכיתה ובצוות.</div>
    <div><span dir="ltr">be-good.co.il</span> · <span dir="ltr">yael.sade@gmail.com</span></div>
  </div>
  <div style="flex:0 0 auto;font-size:7.4pt;margin-top:1mm;white-space:nowrap">עמוד {i} מתוך {n}</div>
</div></section>'''

async def main(files):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        for f in files:
            r = PdfReader(f)
            sizes = [(float(x.mediabox.width), float(x.mediabox.height)) for x in r.pages]
            n = len(sizes)
            # עמוד שכבה אחד לכל עמוד, בהדפסה אחת, כדי שהלוגו והגופן יישמרו פעם אחת בקובץ
            if len(set(sizes)) == 1:
                w, h = sizes[0]
                html = '<!doctype html><html><head><meta charset="utf-8"><style>%s @page{size:%spt %spt;margin:0}body{margin:0}</style></head><body>%s</body></html>' % (FONTS, w, h, ''.join(page_html(w, h, i, n) for i in range(1, n + 1)))
                await pg.set_content(html, wait_until='load'); await pg.evaluate('document.fonts.ready')
                ovs = PdfReader(io.BytesIO(await pg.pdf(width=f'{w/72:.4f}in', height=f'{h/72:.4f}in', print_background=True, margin={'top':'0','bottom':'0','left':'0','right':'0'}))).pages
            else:
                ovs = []
                for i, (w, h) in enumerate(sizes, 1):
                    html = '<!doctype html><html><head><meta charset="utf-8"><style>%s @page{size:%spt %spt;margin:0}body{margin:0}</style></head><body>%s</body></html>' % (FONTS, w, h, page_html(w, h, i, n))
                    await pg.set_content(html, wait_until='load'); await pg.evaluate('document.fonts.ready')
                    ovs.append(PdfReader(io.BytesIO(await pg.pdf(width=f'{w/72:.4f}in', height=f'{h/72:.4f}in', print_background=True, margin={'top':'0','bottom':'0','left':'0','right':'0'}))).pages[0])
            out = PdfWriter(clone_from=r)
            for i, page in enumerate(out.pages):
                page.merge_page(ovs[i])
                page.compress_content_streams(level=9)
            out.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
            with open(f, 'wb') as fh: out.write(fh)
            print('✓', os.path.basename(f), n, 'עמודים')
        await b.close()

if __name__ == '__main__':
    files = sys.argv[1:] or sorted(set(sum([glob.glob(os.path.join(A, g)) for g in GAMES], [])))
    asyncio.run(main(files))
