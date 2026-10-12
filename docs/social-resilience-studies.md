# לימודי חוסן חברתי

Approved scope, 12 October 2026: a materials library using the approved logo-window landscape and symbolic group header, named groups, titles, file or link, optional explanation, date and slide previews. All upload, group and item management controls live only in the system administration area. A separate `studies` permission grants readers access to the whole library through the existing access-code and institution-ceiling mechanism. It defaults closed. No publishing or production data changes are authorized by the build request.

## Shared implementation contract

- Reader page: `app/social-resilience-studies.html`. Header: `assets/studies-header.png`, unchanged approved image; include a semantic heading for accessibility.
- Administration: system-only `studies` tab in `app/admin.html`, mounted through `window.SBE_STUDIES_ADMIN.mount(node, { token: sysToken })`. No upload control on the reader page.
- Endpoint: `POST /api/studies`, JSON `{ action, token, ... }`. Read actions `list` and `file` recheck `authorizePermission(store, token, ['studies'])`. Mutations accept system-admin tokens only.
- `list` response: `{ groups: [{id,title}], items: [{id,groupId,title,description,date,url,file,previews}] }`. `file` is null or `{name,mime,size}`; object keys stay server-side. `previews` contains up to three JPEG/PNG/WebP data URLs. Items are ordered by date descending. An empty `groupId` means ungrouped.
- `groupSave`: `{ group: { id?, title } }`, response `{ group }`. `groupDelete`: `{ id }`, reject a nonempty group so materials are moved deliberately first.
- `save`: `{ item: { id?,groupId,title,description,date,url,previews }, file?: {name,mime,data} | null }`, response `{item}`. `data` is raw base64. Omitted `file` preserves an existing attachment; null removes it. At least file or HTTP(S) link, title, date and any referenced group must be valid. Files up to 50 MiB, three previews up to 1 MiB each. Date is editable YYYY-MM-DD, default today's date in Asia/Jerusalem.
- `delete`: `{id}`, response `{ok:true}`. `file`: `{id}`, binary response, private/no-store, attachment disposition, only after current authorization. Viewer creates/revokes a local object URL for opening the file. Links open directly with noopener/noreferrer.
- Attachments use a private Supabase Storage bucket `study-materials`, accessed through the server's existing Supabase service credentials. The backend ensures the bucket is private before uploading, stores metadata in `access_settings`, and never exposes the service key or public attachment URLs.
- Previews: PDF first three pages via a locally vendored pinned PDF.js build; PPTX embedded cover via a locally vendored pinned JSZip build. Image attachments preview directly. Other files/links may use up to three administrator-supplied preview images. Preview generation failure leaves the file attachable with a clear message and manual image choice.
- Browser shared client: `app/lib/studies-client.js`, `window.SBE_STUDIES` exposes `call(action, extra, token?)`, `file(id, token?)`, `today()`, `previews(file)`, `readFile(file)`, `images(files)`. Default token comes from `sbe.session.token`; API base is `https://sbe-server.onrender.com/api/studies`. Client file result is `{name,mime,data}`; previews returns data URLs; file download returns Blob. PDF.js/JSZip are lazy loaded only when needed.

## Verification

Exercise admin group/item create, edit, move and delete; file upload and opening; link-only item; PDF previews and PowerPoint embedded cover; empty library; permission denial, revoked/expired code and closed institution ceiling; reader has no upload controls; desktop and mobile layouts with the exact approved banner. Tests and browser checks use only local synthetic files, never production content.
