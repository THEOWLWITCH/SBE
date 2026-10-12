# Studies preview dependencies

These official browser distributions are vendored unchanged and loaded lazily by `studies-client.js`. No CDN request is used for previews.

## PDF.js 6.4.299

- Package: https://registry.npmjs.org/pdfjs-dist/6.4.299
- Tarball: https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz
- Verified npm integrity: `sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==`
- Upstream and API: https://github.com/mozilla/pdf.js and https://mozilla.github.io/pdf.js/examples/
- License: Apache-2.0, in `pdfjs/LICENSE`. Distribution CMaps, standard fonts, ICC profiles, WASM decoders and their accompanying licenses are retained alongside the module and worker. These resources allow the canvas renderer to read the document's real fonts and images locally.

## JSZip 3.10.2

- Package: https://registry.npmjs.org/jszip/3.10.2
- Tarball: https://registry.npmjs.org/jszip/-/jszip-3.10.2.tgz
- Verified npm integrity: `sha512-3l+rb15IOWtUhU0H5MFqES/T6Kh7abYwjosBey/vD6hDt8zoEffkSC5Ws5SGtgVw3gBx2NEbhTeSW1+kWkpyTQ==`
- Upstream and API: https://github.com/Stuk/jszip and https://stuk.github.io/jszip/documentation/api_jszip/load_async.html
- License: MIT option of the upstream dual license; complete license is in `jszip/LICENSE.markdown`.

PowerPoint preview extraction uses only an existing `docProps/thumbnail.jpeg`, `.jpg` or `.png`. It does not synthesize slides or substitute other embedded slide images. Missing covers, unsupported EMF covers and non-previewable attachments leave previews empty so administrators can supply images.
