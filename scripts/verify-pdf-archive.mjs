#!/usr/bin/env node
/**
 * Checks the exact generated publication archive before Pages upload/push.
 * Does not create/change PDF files or editorial data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectPDF } from './export-pdf.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const issuesDir = path.join(root, 'data', 'issues');
const outDir = path.join(root, 'output');
const catalog = JSON.parse(fs.readFileSync(path.join(issuesDir, 'index.json'), 'utf8'));
if (!Array.isArray(catalog) || catalog.length !== 4) {
  throw new Error('Expected exactly the four approved 2026 issues in the published catalog');
}
let pagesTotal = 0;
const seen = new Set();
for (const item of catalog) {
  if (!item.id || !/^[0-9]{4}-[0-9]{2}-[a-z-]+$/.test(item.id)) {
    throw new Error('Invalid published issue ID');
  }
  if (seen.has(item.id)) throw new Error('Duplicate issue in published catalog: ' + item.id);
  seen.add(item.id);
  if (!item.pdfFile || path.basename(item.pdfFile) !== item.pdfFile ||
      !item.pdfFile.endsWith('.pdf')) throw new Error('Invalid PDF filename for ' + item.id);
  const original = JSON.parse(fs.readFileSync(path.join(issuesDir, item.id + '.json'), 'utf8'));
  if (original.id !== item.id || original.issueNumber !== item.issueNumber ||
      original.theme !== 'KALICI ETKİ YARAT') {
    throw new Error('Published metadata differs from canonical source: ' + item.id);
  }
  const file = path.join(outDir, item.pdfFile);
  const result = inspectPDF(file);
  if (result.pageCount !== item.pageCount) {
    throw new Error('PDF and index page counts differ for ' + item.id);
  }
  pagesTotal += result.pageCount;
  console.log('VERIFIED', item.id, 'pages='+result.pageCount, 'bytes='+result.size);
}
if (pagesTotal !== 34) throw new Error('Expected 34 total pages, got '+pagesTotal);
console.log('PDF_ARCHIVE_PASS issues=4 pages=34');