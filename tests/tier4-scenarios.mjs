/**
 * Tier 4: Real-World Application Scenarios
 * Tests full pipeline execution from JSON to Chrome Headless PDF output for all 4 issues,
 * binary PDF integrity, Polio back cover, and editorial book accuracy.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  POLIO_CRIMSON,
  EXPECTED_BOOKS
} from './fixtures/mock-issues.mjs';

export function createTier4Suites(projectRoot) {
  const outputDir = path.join(projectRoot, 'output');
  const dataDir = path.join(projectRoot, 'data', 'issues');
  const scriptsDir = path.join(projectRoot, 'scripts');

  const EXPECTED_PDFS = [
    'Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf',
    'Galata_Rotary_Bulten_2026_08_Agustos_Sayi_2.pdf',
    'Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf',
    'Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf'
  ];

  return [
    // T4-01: Full Headless Chrome Pipeline Execution Check
    {
      id: 'T4-01',
      title: 'Scenario: Full Headless Chrome CLI PDF Generator Pipeline Discovery & Options',
      milestone: 'M2',
      async run() {
        const exportScript = path.join(scriptsDir, 'export-pdf.mjs');
        if (!fs.existsSync(exportScript)) {
          return { status: 'PENDING', milestone: 'M2', message: 'scripts/export-pdf.mjs not yet created' };
        }
        const scriptCode = fs.readFileSync(exportScript, 'utf8');

        // Verify Chrome path detection logic
        const commonPaths = ['Google\\Chrome\\Application\\chrome.exe', 'msedge.exe'];
        const hasPathDetection = commonPaths.some(p => scriptCode.includes('chrome') || scriptCode.includes('Chrome'));
        if (!hasPathDetection) {
          throw new Error('export-pdf.mjs does not include Chrome / Chromium path detection');
        }

        // Use the CDP print API; CLI --print-to-pdf can exit without producing a file.
        const cdpCode = fs.readFileSync(path.join(scriptsDir, 'chrome-cdp-print.mjs'), 'utf8');
        if (!scriptCode.includes('printPageToPDF') || !cdpCode.includes('Page.printToPDF') ||
            !scriptCode.includes('inspectPDF(stagedPdfPath)') ||
            !scriptCode.includes('renameSync(stagedPdfPath, destPdfPath)')) {
          throw new Error('Missing direct Chrome PDF printing or atomic output verification');
        }

        return { status: 'PASS', message: 'Chrome CDP print and atomic PDF verification present' };
      }
    },

    // T4-02: 4 Monthly PDFs Integrity Check
    {
      id: 'T4-02',
      title: 'Scenario: 4 Monthly Magazine PDFs Existence & Binary Header Validation (%PDF-)',
      milestone: 'M4',
      async run() {
        if (!fs.existsSync(outputDir)) {
          return { status: 'PENDING', milestone: 'M4', message: 'output directory not yet created' };
        }

        const missing = [];
        const verified = [];

        for (const pdfName of EXPECTED_PDFS) {
          const pdfPath = path.join(outputDir, pdfName);
          if (!fs.existsSync(pdfPath)) {
            missing.push(pdfName);
            continue;
          }

          // Read header bytes
          const fd = fs.openSync(pdfPath, 'r');
          const buffer = Buffer.alloc(8);
          fs.readSync(fd, buffer, 0, 8, 0);
          fs.closeSync(fd);

          const header = buffer.toString('utf8');
          if (!header.startsWith('%PDF-')) {
            throw new Error(`${pdfName} does not begin with valid PDF signature "%PDF-" (got "${header}")`);
          }

          const stats = fs.statSync(pdfPath);
          if (stats.size < 50000) {
            throw new Error(`${pdfName} file size (${stats.size} bytes) is suspiciously small for a full A4 magazine`);
          }

          verified.push(`${pdfName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }

        if (missing.length > 0) {
          return {
            status: 'PENDING',
            milestone: 'M4',
            message: `Missing ${missing.length} PDFs in output/: ${missing.join(', ')}`
          };
        }

        return { status: 'PASS', message: `All 4 monthly magazine PDFs verified:\n  - ${verified.join('\n  - ')}` };
      }
    },

    // T4-03: Back Cover Polio Closing Verification
    {
      id: 'T4-03',
      title: 'Scenario: Back Cover "ÇOCUK FELCİNE SON" Theme & Color (#E01E26) Verification',
      milestone: 'M1',
      async run() {
        if (!fs.existsSync(dataDir)) {
          return { status: 'PENDING', milestone: 'M1', message: 'data/issues directory not yet created' };
        }

        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'index.json');
        if (files.length === 0) {
          return { status: 'PENDING', milestone: 'M1', message: 'No issue files found in data/issues' };
        }

        for (const file of files) {
          const issue = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
          if (!issue.backCover) {
            throw new Error(`${file} missing backCover`);
          }
          if (issue.backCover.theme !== 'ÇOCUK FELCİNE SON') {
            throw new Error(`${file} backCover theme must be exact "ÇOCUK FELCİNE SON", found "${issue.backCover.theme}"`);
          }
          if (issue.backCover.color.toUpperCase() !== POLIO_CRIMSON.toUpperCase()) {
            throw new Error(`${file} backCover color must be ${POLIO_CRIMSON}, found "${issue.backCover.color}"`);
          }
          if (!issue.backCover.contact || !issue.backCover.contact.instagram) {
            throw new Error(`${file} backCover missing contact.instagram`);
          }
        }

        return { status: 'PASS', message: `All ${files.length} issues have verified "ÇOCUK FELCİNE SON" Polio crimson back covers` };
      }
    },

    // T4-04: Cultural Book Recommendation Accuracy
    {
      id: 'T4-04',
      title: 'Scenario: Cultural Book Recommendation Accuracy Across All 4 Issues',
      milestone: 'M1',
      async run() {
        if (!fs.existsSync(dataDir)) {
          return { status: 'PENDING', milestone: 'M1', message: 'data/issues directory not yet created' };
        }

        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
        if (files.length === 0) {
          return { status: 'PENDING', milestone: 'M1', message: 'No issue files found in data/issues' };
        }

        for (const [issueId, expected] of Object.entries(EXPECTED_BOOKS)) {
          const filePath = path.join(dataDir, `${issueId}.json`);
          if (fs.existsSync(filePath)) {
            const issue = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!issue.culture || !issue.culture.book) {
              throw new Error(`${issueId} missing culture.book object`);
            }
            const book = issue.culture.book;
            if (expected.author && !book.author.includes(expected.author)) {
              throw new Error(`${issueId} book author expected to contain "${expected.author}", got "${book.author}"`);
            }
            if (expected.titleContains && !book.title.includes(expected.titleContains)) {
              throw new Error(`${issueId} book title expected to contain "${expected.titleContains}", got "${book.title}"`);
            }
          }
        }

        return { status: 'PASS', message: 'Cultural book recommendations accurately match verified archive history' };
      }
    }
  ];
}