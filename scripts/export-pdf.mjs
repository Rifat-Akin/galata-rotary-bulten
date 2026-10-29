#!/usr/bin/env node
/**
 * Galata Rotary Bülten Stüdyosu — Headless Chrome PDF Generator CLI
 * Batch and single-issue CLI generator using native headless Chrome/Edge.
 *
 * Usage:
 *   node scripts/export-pdf.mjs --all
 *   node scripts/export-pdf.mjs --issue 2026-09-eylul
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { renderIssueToHTML } from '../public/renderer.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data', 'issues');
const publicDir = path.join(projectRoot, 'public');
const outputDir = path.join(projectRoot, 'output');

// Official Output Filename Mapping
const ISSUE_PDF_MAP = {
  '2026-07-temmuz': 'Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf',
  '2026-08-agustos': 'Galata_Rotary_Bulten_2026_08_Agustos_Sayi_2.pdf',
  '2026-09-eylul': 'Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf',
  '2026-10-ekim': 'Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf'
};

const ALL_ISSUE_IDS = [
  '2026-07-temmuz',
  '2026-08-agustos',
  '2026-09-eylul',
  '2026-10-ekim'
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

/**
 * Automatically detects Google Chrome or Chromium/Edge binary path
 */
export function findChromeBinary() {
  const candidates = [
    // Windows Google Chrome
    process.env['PROGRAMFILES'] ? path.join(process.env['PROGRAMFILES'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    process.env['LOCALAPPDATA'] ? path.join(process.env['LOCALAPPDATA'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // Windows Microsoft Edge fallback
    process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
    process.env['PROGRAMFILES'] ? path.join(process.env['PROGRAMFILES'], 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Creates an ephemeral HTTP server to serve rendered HTML and assets to Chrome
 */
function createPrintServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url, 'http://127.0.0.1');
        const pathname = decodeURIComponent(parsedUrl.pathname);

        // Render Issue Endpoint
        if (pathname === '/render') {
          const issueId = parsedUrl.searchParams.get('issue');
          if (!issueId) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Missing ?issue= parameter');
            return;
          }

          const jsonPath = path.join(dataDir, issueId.endsWith('.json') ? issueId : `${issueId}.json`);
          if (!fs.existsSync(jsonPath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Issue not found: ${issueId}`);
            return;
          }

          const issueData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          const html = renderIssueToHTML(issueData, { fullDoc: true, assetPrefix: '/' });

          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          });
          res.end(html);
          return;
        }

        // Static Asset Serving
        let relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
        let filePath = path.join(publicDir, relativePath);

        // Security check: ensure path remains within publicDir
        if (!filePath.startsWith(publicDir)) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end(`Not Found: ${pathname}`);
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Server Error: ${err.message}`);
      }
    });

    // Listen on random available port
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });

    server.on('error', reject);
  });
}

/**
 * Validates a generated PDF file
 */
export function inspectPDF(pdfPath) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const stats = fs.statSync(pdfPath);
  if (stats.size < 100000) {
    throw new Error(`PDF file ${path.basename(pdfPath)} size (${stats.size} bytes) is less than expected minimum 100 KB`);
  }

  const fd = fs.openSync(pdfPath, 'r');
  const buffer = Buffer.alloc(8);
  fs.readSync(fd, buffer, 0, 8, 0);
  fs.closeSync(fd);

  const header = buffer.toString('utf8');
  if (!header.startsWith('%PDF-')) {
    throw new Error(`Invalid PDF header: "${header}"`);
  }

  // Count pages using PDF object marker /Type /Page
  const fullContent = fs.readFileSync(pdfPath).toString('latin1');
  const pageMatches = fullContent.match(/\/Type\s*\/Page\b/g);
  const pageCount = pageMatches ? pageMatches.length : 0;

  if (pageCount < 7 || pageCount > 9) {
    throw new Error(`PDF ${path.basename(pdfPath)} page count (${pageCount}) is outside required 7–9 page range`);
  }

  return {
    size: stats.size,
    sizeMB: (stats.size / 1024 / 1024).toFixed(2),
    pageCount
  };
}

/**
 * Exports a single issue to PDF via headless Chrome
 */
export async function exportIssueToPDF(issueId, options = {}) {
  const chromePath = options.chromePath || findChromeBinary();
  if (!chromePath) {
    throw new Error('Google Chrome or Microsoft Edge binary could not be located on this system');
  }

  const port = options.port;
  if (!port) {
    throw new Error('Print server port is required');
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const pdfFileName = ISSUE_PDF_MAP[issueId] || `${issueId}.pdf`;
  const destPdfPath = path.join(outputDir, pdfFileName);

  const renderUrl = `http://127.0.0.1:${port}/render?issue=${encodeURIComponent(issueId)}`;

  const chromeFlags = [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=2000',
    `--print-to-pdf=${destPdfPath}`,
    renderUrl
  ];

  if (os.platform() === 'linux') {
    chromeFlags.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  console.log(`[export-pdf] Exporting "${issueId}" -> "${pdfFileName}"...`);
  const startTime = Date.now();

  try {
    await execFileAsync(chromePath, chromeFlags, { timeout: 45000 });
  } catch (err) {
    throw new Error(`Chrome headless PDF generation failed for "${issueId}": ${err.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const inspection = inspectPDF(destPdfPath);

  console.log(`[export-pdf] ✔ Created ${pdfFileName} (${inspection.sizeMB} MB, ${inspection.pageCount} pages, ${duration}s)`);

  return {
    issueId,
    destPdfPath,
    fileName: pdfFileName,
    ...inspection,
    duration
  };
}

/**
 * Main CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  let singleIssue = null;

  const issueIdx = args.indexOf('--issue');
  if (issueIdx !== -1 && args[issueIdx + 1]) {
    singleIssue = args[issueIdx + 1];
  }

  if (!isAll && !singleIssue) {
    console.log(`
Galata Rotary Bülten Stüdyosu — Headless Chrome PDF Generator CLI

Usage:
  node scripts/export-pdf.mjs --all
  node scripts/export-pdf.mjs --issue <issueId>

Examples:
  node scripts/export-pdf.mjs --all
  node scripts/export-pdf.mjs --issue 2026-09-eylul
    `);
    process.exit(1);
  }

  const chromePath = findChromeBinary();
  if (!chromePath) {
    console.error('ERROR: Could not detect Google Chrome or Edge binary on host system.');
    process.exit(1);
  }
  console.log(`[export-pdf] Detected browser: ${chromePath}`);

  const { server, port } = await createPrintServer();
  console.log(`[export-pdf] Ephemeral print server running on port ${port}`);

  const targetIssues = isAll ? ALL_ISSUE_IDS : [singleIssue];
  const results = [];
  let hasError = false;

  try {
    for (const issueId of targetIssues) {
      try {
        const res = await exportIssueToPDF(issueId, { chromePath, port });
        results.push(res);
      } catch (err) {
        hasError = true;
        console.error(`[export-pdf] ✖ Error exporting "${issueId}": ${err.message}`);
      }
    }
  } finally {
    server.close();
  }

  console.log('\n========================================================================');
  console.log('  PDF GENERATION SUMMARY');
  console.log('========================================================================');
  for (const r of results) {
    console.log(`  ✔ ${r.fileName.padEnd(52)} ${r.pageCount} sayfa  ${r.sizeMB} MB  (${r.duration}s)`);
  }
  console.log('========================================================================');

  if (hasError || (isAll && results.length < 4)) {
    console.error('\nPDF Export failed or incomplete.');
    process.exit(1);
  } else {
    console.log(`\nAll ${results.length} magazine PDF(s) successfully generated in output/`);
    process.exit(0);
  }
}

// Only execute CLI if run directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch(err => {
    console.error('Unhandled fatal error in export-pdf.mjs:', err);
    process.exit(1);
  });
}
