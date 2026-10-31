# האתר האישי של ד״ר יעל שדה

אתר Netlify נפרד מ-Begood, עם דומיין משלו. התוכן נערך מדף הניהול (`/admin`), ונשמר ב-Netlify Blobs של האתר הזה.

## העלאה ל-Netlify (פעם אחת)

1. ב-Netlify: **Add new site → Import an existing project → GitHub** ובוחרים את המאגר `theowlwitch/sbe`.
2. **Branch to deploy:** `main`. **Base directory:** `yael-site`. את שאר השדות משאירים כמו שהם (ההגדרות ב-`netlify.toml`).
3. **Site configuration → Environment variables:** מוסיפים `YAEL_SITE_PASSWORD` עם הסיסמה לניהול (לפחות 6 תווים). אחרי ההוספה: **Deploys → Trigger deploy**.
4. **Domain management → Add a domain:** הדומיין החדש. אם הוא נקנה במקום אחר, מעדכנים שם את ה-DNS לפי ההוראות של Netlify.

גרירת תיקייה ל-Netlify (Netlify Drop) לא מעלה את הפונקציה, ולכן הניהול לא יעבוד בדרך הזאת. צריך את החיבור ל-GitHub שבסעיף 1.

## עבודה שוטפת

- **ניהול:** `https://<הדומיין>/admin`. נכנסים עם הסיסמה. "לזכור את המכשיר הזה" שומר את הכניסה ל-90 יום.
- בכל דף: עריכת השם והפתיחה, "➕ הוספת חומר" (טקסט, קובץ, קישור, תמונה, סרטון מ-YouTube או Vimeo), הזזה למעלה ולמטה, הסתרה (טיוטה) ומחיקה.
- **שמירה ופרסום:** השינויים מופיעים באתר רק אחרי הלחיצה.
- קבצים עד 4 מגה (PDF, תמונה, Word, PowerPoint, Excel, שמע, סרטון קצר). קובץ גדול יותר: מעלים ל-Google Drive או ל-YouTube ומוסיפים כקישור או כסרטון.
- קובץ שהוסר מהאתר נמחק מהאחסון בשמירה.
- **החלפת הסיסמה** ב-Netlify (ופריסה מחדש) מנתקת את כל המכשירים שנכנסו.

## קבצים

- `public/index.html`: האתר. `public/site.js`: הצגת הדפים. `public/site.css`: העיצוב.
- `public/site-data.js`: תוכן הפתיחה, עד השמירה הראשונה בניהול.
- `public/admin.html`: הניהול.
- `netlify/functions/site.mjs`: שמירה, קבצים וכניסה (`/api/site`, `/api/file`). בדיקות: `harness/tests/yael-site.test.mjs`.
