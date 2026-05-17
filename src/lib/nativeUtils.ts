/**
 * nativeUtils.ts
 * Mobile-safe wrappers for print and file download.
 *
 * On desktop (Electron / browser): uses window.print() and blob download links.
 * On Android (Capacitor WebView): window.print() and blob downloads are silently
 * broken. Instead we:
 *   - Write the file to the device cache via @capacitor/filesystem
 *   - Open the system share sheet via @capacitor/share so the user can print,
 *     save, WhatsApp, email, etc.
 */

import { Capacitor } from '@capacitor/core';

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/* ─────────────────────────────────────────────
   PRINT  (receipt / slip HTML)
───────────────────────────────────────────── */

const SLIP_STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; font-family: monospace; }
  @page { size: 80mm auto; margin: 4mm; }
`;

/** Desktop: hidden iframe print.  Android: save HTML → share sheet. */
export async function printOrShare(slipHtml: string, filename = 'slip.html'): Promise<void> {
  if (isNative()) {
    await shareHtml(slipHtml, filename);
  } else {
    iframePrint(slipHtml);
  }
}

/** Desktop: window.print() for full-page receipts.  Android: share current page HTML. */
export async function printPageOrShare(pageTitle = 'Receipt'): Promise<void> {
  if (isNative()) {
    // Capture the current rendered page HTML and share it
    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>${pageTitle}</title>
      <style>
        body { font-family: sans-serif; padding: 12px; }
        @media print { button, nav, .no-print { display:none !important; } }
      </style>
    </head><body>${document.body.innerHTML}</body></html>`;
    await shareHtml(html, `${pageTitle.replace(/\s+/g, '_')}.html`);
  } else {
    window.print();
  }
}

/* ─────────────────────────────────────────────
   DOWNLOAD  (CSV / JSON files)
───────────────────────────────────────────── */

/** Desktop: browser blob download.  Android: save to Documents → share sheet. */
export async function downloadOrShare(
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8;'
): Promise<void> {
  if (isNative()) {
    await shareTextFile(content, filename);
  } else {
    blobDownload(content, filename, mimeType);
  }
}

/* ─────────────────────────────────────────────
   INTERNAL HELPERS
───────────────────────────────────────────── */

function iframePrint(slipHtml: string) {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><style>${SLIP_STYLE}</style></head><body>${slipHtml}</body></html>`);
  doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => document.body.removeChild(iframe), 2000);
}

function blobDownload(content: string, filename: string, mimeType: string) {
  // Only add BOM for CSV files — adding it to JSON breaks JSON.parse()
  const bom = mimeType.includes('csv') ? '\uFEFF' : '';
  const blob = new Blob([bom + content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareHtml(slipHtml: string, filename: string) {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const fullHtml = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <style>${SLIP_STYLE}</style>
    </head><body>${slipHtml}</body></html>`;

    // btoa doesn't handle UTF-8 safely — use TextEncoder approach
    const bytes  = new TextEncoder().encode(fullHtml);
    const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
    const base64 = btoa(binary);

    await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({ title: filename, url: uri, dialogTitle: 'Print or share slip' });
  } catch (err) {
    console.error('shareHtml failed:', err);
    alert('Could not open share sheet. Please try again.');
  }
}

async function shareTextFile(content: string, filename: string) {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const bytes  = new TextEncoder().encode(content);
    const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
    const base64 = btoa(binary);

    await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Documents });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Documents });
    await Share.share({ title: filename, url: uri, dialogTitle: 'Save or share file' });
  } catch (err) {
    console.error('shareTextFile failed:', err);
    alert('Could not save file. Please try again.');
  }
}
