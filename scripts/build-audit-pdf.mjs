import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { marked } from 'marked';

const MD_PATH = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\133d3f91-289b-4aea-932e-8ade4a9de5ec\\HUMANITY_LEDGER_AUDIT_NOV2026.md';
const OUT_PDF_WORKSPACE = 'd:\\Projects\\Wallet Human Polymarket ID\\HUMANITY_LEDGER_AUDIT_NOV2026.pdf';
const OUT_PDF_BRAIN = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\133d3f91-289b-4aea-932e-8ade4a9de5ec\\HUMANITY_LEDGER_AUDIT_NOV2026.pdf';

async function generatePdf() {
  console.log('Leyendo informe markdown desde:', MD_PATH);
  let mdContent = fs.readFileSync(MD_PATH, 'utf-8');

  // Convert GitHub style alerts before parsing
  // > [!NOTE] -> <div class="alert alert-note">
  // > [!WARNING] -> <div class="alert alert-warning">
  // > [!CAUTION] -> <div class="alert alert-caution">
  // > [!IMPORTANT] -> <div class="alert alert-important">
  mdContent = mdContent.replace(/^>\s*\[!NOTE\]\s*\n((?:>.*\n?)+)/gm, (match, p1) => {
    const text = p1.replace(/^>\s?/gm, '');
    return `<div class="alert alert-note"><div class="alert-title">ℹ️ NOTA TÉCNICA</div>${text}</div>\n`;
  });
  mdContent = mdContent.replace(/^>\s*\[!WARNING\]\s*\n((?:>.*\n?)+)/gm, (match, p1) => {
    const text = p1.replace(/^>\s?/gm, '');
    return `<div class="alert alert-warning"><div class="alert-title">⚠️ ADVERTENCIA DE RIESGO</div>${text}</div>\n`;
  });
  mdContent = mdContent.replace(/^>\s*\[!CAUTION\]\s*\n((?:>.*\n?)+)/gm, (match, p1) => {
    const text = p1.replace(/^>\s?/gm, '');
    return `<div class="alert alert-caution"><div class="alert-title">🛑 ALERTA CRÍTICA DE SEGURIDAD</div>${text}</div>\n`;
  });
  mdContent = mdContent.replace(/^>\s*\[!IMPORTANT\]\s*\n((?:>.*\n?)+)/gm, (match, p1) => {
    const text = p1.replace(/^>\s?/gm, '');
    return `<div class="alert alert-important"><div class="alert-title">📌 CONCLUSIÓN PRINCIPAL</div>${text}</div>\n`;
  });

  const parsedHtml = marked.parse(mdContent);

  const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>HUMANITY LEDGER — Audit de Madurez de Protocolo</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 14mm 20mm 14mm;
    }
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.5;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    .header-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      color: #ffffff;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 24px;
      border-left: 6px solid #6366f1;
    }

    .header-banner h1 {
      margin: 0 0 6px 0;
      font-size: 20pt;
      letter-spacing: -0.5px;
      color: #ffffff;
      font-weight: 800;
    }

    .header-banner h2 {
      margin: 0 0 12px 0;
      font-size: 12pt;
      font-weight: 500;
      color: #cbd5e1;
      border: none;
      padding: 0;
    }

    .meta-box {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 8.5pt;
      line-height: 1.6;
      color: #e2e8f0;
    }

    h1 {
      font-size: 16pt;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }

    h2 {
      font-size: 13pt;
      color: #1e293b;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 20px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }

    h3 {
      font-size: 10.5pt;
      color: #334155;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    p {
      margin: 0 0 8px 0;
      text-align: justify;
    }

    ul, ol {
      margin: 0 0 10px 0;
      padding-left: 20px;
    }

    li {
      margin-bottom: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
      background: #ffffff;
      border: 1px solid #cbd5e1;
    }

    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
      padding: 7px 9px;
      border: 1px solid #cbd5e1;
      font-size: 8.5pt;
    }

    td {
      padding: 6px 9px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    code {
      background: #f1f5f9;
      color: #0969da;
      padding: 1.5px 4px;
      border-radius: 4px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 8pt;
      border: 1px solid #e2e8f0;
    }

    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 14px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 8pt;
      line-height: 1.4;
      margin: 10px 0;
      page-break-inside: avoid;
    }

    pre code {
      background: transparent;
      color: inherit;
      border: none;
      padding: 0;
    }

    blockquote {
      margin: 10px 0;
      padding: 8px 14px;
      border-left: 4px solid #6366f1;
      background: #f8fafc;
      color: #334155;
      font-style: italic;
    }

    .alert {
      border-radius: 6px;
      padding: 10px 14px;
      margin: 12px 0;
      page-break-inside: avoid;
      font-size: 8.5pt;
      line-height: 1.5;
    }

    .alert-title {
      font-weight: 800;
      font-size: 8.5pt;
      margin-bottom: 4px;
      letter-spacing: 0.3px;
    }

    .alert-note {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-left: 5px solid #3b82f6;
      color: #1e3a8a;
    }

    .alert-warning {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 5px solid #f59e0b;
      color: #78350f;
    }

    .alert-caution {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-left: 5px solid #ef4444;
      color: #7f1d1d;
    }

    .alert-important {
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-left: 5px solid #8b5cf6;
      color: #4c1d95;
    }

    hr {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 20px 0;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 7.5pt;
    }

    .badge-verified { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .badge-partial { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-unverified { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
    .badge-conflict { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
  </style>
</head>
<body>
  ${parsedHtml}
</body>
</html>`;

  const tempHtmlPath = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'humanity_audit_full.html');
  fs.writeFileSync(tempHtmlPath, fullHtml, 'utf-8');
  console.log('HTML compilado guardado en:', tempHtmlPath);

  console.log('Lanzando Puppeteer con Chrome...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.goto('file:///' + tempHtmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

  console.log('Generando PDF tamaño A4...');
  await page.pdf({
    path: OUT_PDF_WORKSPACE,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    margin: {
      top: '18mm',
      bottom: '18mm',
      left: '14mm',
      right: '14mm'
    },
    headerTemplate: `
      <div style="font-size: 7pt; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; color: #64748b; width: 100%; display: flex; justify-content: space-between; padding-left: 14mm; padding-right: 14mm;">
        <span style="font-weight: 700; letter-spacing: 0.5px;">HUMANITY LEDGER — AUDIT TOTAL DE MADUREZ</span>
        <span>NOVIEMBRE 2026 | ANTIGRAVITY AI</span>
      </div>`,
    footerTemplate: `
      <div style="font-size: 7pt; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; color: #64748b; width: 100%; display: flex; justify-content: space-between; padding-left: 14mm; padding-right: 14mm;">
        <span>INFORME TÉCNICO DE AUDITORÍA Y VERIFICACIÓN ON-CHAIN</span>
        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>`
  });

  await browser.close();

  // Copiar a la carpeta de artefactos de antigravity
  fs.copyFileSync(OUT_PDF_WORKSPACE, OUT_PDF_BRAIN);

  const stats = fs.statSync(OUT_PDF_WORKSPACE);
  console.log('PDF generado exitosamente!');
  console.log('Ruta Workspace:', OUT_PDF_WORKSPACE);
  console.log('Ruta Brain:', OUT_PDF_BRAIN);
  console.log('Tamaño:', (stats.size / 1024).toFixed(1), 'KB');
}

generatePdf().catch(err => {
  console.error('Error generando PDF:', err);
  process.exit(1);
});
