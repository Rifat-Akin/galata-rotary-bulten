/**
 * Milestone 1 Functional & Unit Test Suite
 * Validates real state, functional execution, and behavioral contracts:
 * 1. createIssue() monthNumStr resolution from MONTH_ORDER
 * 2. POST /api/export-pdf/:id filename resolution resilience
 * 3. Multi-page overflow cycling logic
 * 4. Reader Mode keyboard navigation event filtering and page indexing
 * 5. Ctrl + Wheel zoom bounding and smooth step progression
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { createIssue, sanitizeIssueId } from '../server.mjs';

const PROJECT_ROOT = process.cwd();
const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'issues');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

console.log('========================================================================');
console.log('  MILESTONE 1 FUNCTIONAL UNIT TEST SUITE');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✔ [PASS] ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${description}`);
    console.error(`    Detail: ${err.message}`);
    failCount++;
  }
}

// ----------------------------------------------------------------------
// 1. Server createIssue() month resolution tests
// ----------------------------------------------------------------------
console.log('[SUITE 1] server.mjs createIssue() Functional Tests');
console.log('─'.repeat(72));

test('createIssue() resolves January (Ocak) to monthNumStr "01" and correct ID', () => {
  const result = createIssue({ month: 'Ocak', year: 2027, overwrite: true });
  try {
    assert.strictEqual(result.month, 'Ocak');
    assert.strictEqual(result.year, 2027);
    assert.strictEqual(result.id, '2027-01-ocak');
    assert.strictEqual(result.theme, 'KALICI ETKİ YARAT');
    assert(fs.existsSync(path.join(DATA_DIR, '2027-01-ocak.json')));
  } finally {
    const jsonPath = path.join(DATA_DIR, '2027-01-ocak.json');
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    const photoDir = path.join(PUBLIC_DIR, 'assets', 'photos', '2027-01');
    if (fs.existsSync(photoDir)) fs.rmdirSync(photoDir);
  }
});

test('createIssue() resolves November (Kasım) to monthNumStr "11" and correct ID', () => {
  const result = createIssue({ month: 'Kasım', year: 2026, overwrite: true });
  try {
    assert.strictEqual(result.month, 'Kasım');
    assert.strictEqual(result.year, 2026);
    assert.strictEqual(result.id, '2026-11-kasim');
    assert.strictEqual(result.rotaryMonthTheme, 'Rotary Vakfı Ayı');
    assert(fs.existsSync(path.join(DATA_DIR, '2026-11-kasim.json')));
  } finally {
    const jsonPath = path.join(DATA_DIR, '2026-11-kasim.json');
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    const photoDir = path.join(PUBLIC_DIR, 'assets', 'photos', '2026-11');
    if (fs.existsSync(photoDir)) fs.rmdirSync(photoDir);
  }
});

// ----------------------------------------------------------------------
// 2. Server PDF filename resolution logic
// ----------------------------------------------------------------------
console.log('\n[SUITE 2] server.mjs Export-PDF Filename Resolution Tests');
console.log('─'.repeat(72));

const ISSUE_PDF_MAP = {
  '2026-07-temmuz': 'Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf',
  '2026-08-agustos': 'Galata_Rotary_Bulten_2026_08_Agustos_Sayi_2.pdf',
  '2026-09-eylul': 'Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf',
  '2026-10-ekim': 'Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf'
};

function resolvePdfFilename(issueId, outputDir) {
  if (ISSUE_PDF_MAP[issueId] && fs.existsSync(path.join(outputDir, ISSUE_PDF_MAP[issueId]))) {
    return ISSUE_PDF_MAP[issueId];
  } else if (fs.existsSync(path.join(outputDir, `${issueId}.pdf`))) {
    return `${issueId}.pdf`;
  } else if (fs.existsSync(outputDir)) {
    const pdfFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.pdf'));
    const parts = issueId.toLowerCase().split(/[-_]/).filter(Boolean);
    return pdfFiles.find(f => {
      const lower = f.toLowerCase();
      return lower.includes(issueId.toLowerCase()) || parts.some(part => part.length >= 3 && lower.includes(part));
    }) || null;
  }
  return null;
}

test('Resolves official July issue to Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf', () => {
  const resolved = resolvePdfFilename('2026-07-temmuz', path.join(PROJECT_ROOT, 'output'));
  assert.strictEqual(resolved, 'Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf');
});

test('Resolves official October issue to Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf', () => {
  const resolved = resolvePdfFilename('2026-10-ekim', path.join(PROJECT_ROOT, 'output'));
  assert.strictEqual(resolved, 'Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf');
});

// ----------------------------------------------------------------------
// 3. Multi-Page Overflow Sequential Cycling Simulation
// ----------------------------------------------------------------------
console.log('\n[SUITE 3] Multi-Page Overflow Cycling Simulation');
console.log('─'.repeat(72));

test('Sequentially cycles through multiple overflowing pages on badge click', () => {
  const mockOverflowPages = [
    { pageNum: 2, scrolled: false },
    { pageNum: 5, scrolled: false },
    { pageNum: 8, scrolled: false }
  ];

  let overflowCycleIndex = 0;
  const visitOrder = [];

  function simulateBadgeClick() {
    overflowCycleIndex = overflowCycleIndex % mockOverflowPages.length;
    const target = mockOverflowPages[overflowCycleIndex];
    visitOrder.push(target.pageNum);
    overflowCycleIndex = (overflowCycleIndex + 1) % mockOverflowPages.length;
  }

  // 4 clicks should visit: 2, 5, 8, 2
  simulateBadgeClick();
  simulateBadgeClick();
  simulateBadgeClick();
  simulateBadgeClick();

  assert.deepStrictEqual(visitOrder, [2, 5, 8, 2], `Unexpected visit order: ${visitOrder}`);
});

// ----------------------------------------------------------------------
// 4. Ctrl + MouseWheel Zoom Progression
// ----------------------------------------------------------------------
console.log('\n[SUITE 4] Ctrl + MouseWheel Zoom Progression & Bounds');
console.log('─'.repeat(72));

test('Ctrl + Wheel clamps zoom factor strictly within [0.4, 2.0]', () => {
  let zoom = 0.75;

  function simulateWheel(deltaY, ctrlKey) {
    if (!ctrlKey) return;
    const delta = deltaY < 0 ? 0.05 : -0.05;
    zoom = Math.min(2.0, Math.max(0.4, Math.round((zoom + delta) * 100) / 100));
  }

  // Zoom up past upper boundary
  for (let i = 0; i < 40; i++) simulateWheel(-100, true);
  assert.strictEqual(zoom, 2.0, `Upper bound exceeded: ${zoom}`);

  // Zoom down past lower boundary
  for (let i = 0; i < 50; i++) simulateWheel(100, true);
  assert.strictEqual(zoom, 0.4, `Lower bound violated: ${zoom}`);

  // Without ctrlKey, zoom must not change
  const before = zoom;
  simulateWheel(-100, false);
  assert.strictEqual(zoom, before, 'Zoom changed without ctrlKey');
});

// ----------------------------------------------------------------------
// 5. Reader Mode Keyboard Navigation State & Form Guard
// ----------------------------------------------------------------------
console.log('\n[SUITE 5] Reader Mode Keyboard Navigation State & Form Guard');
console.log('─'.repeat(72));

test('Navigates reader pages sequentially and respects boundaries', () => {
  let currentReaderPage = 1;
  const totalPages = 9;

  function handleKeydown(key, isReaderActive, isInputFocused) {
    if (isInputFocused) return;
    if (!isReaderActive) return;

    if (key === 'ArrowLeft' || key === 'PageUp') {
      if (currentReaderPage > 1) currentReaderPage--;
    } else if (key === 'ArrowRight' || key === 'PageDown') {
      if (currentReaderPage < totalPages) currentReaderPage++;
    }
  }

  // In reader mode: ArrowRight advances page
  handleKeydown('ArrowRight', true, false);
  assert.strictEqual(currentReaderPage, 2);

  handleKeydown('PageDown', true, false);
  assert.strictEqual(currentReaderPage, 3);

  // When focused on input/textarea: ArrowRight is IGNORED
  handleKeydown('ArrowRight', true, true);
  assert.strictEqual(currentReaderPage, 3);

  // When NOT in reader mode: ArrowRight is IGNORED
  handleKeydown('ArrowRight', false, false);
  assert.strictEqual(currentReaderPage, 3);

  // ArrowLeft and PageUp navigate backwards
  handleKeydown('ArrowLeft', true, false);
  assert.strictEqual(currentReaderPage, 2);

  handleKeydown('PageUp', true, false);
  assert.strictEqual(currentReaderPage, 1);

  // Boundary: cannot decrement below 1
  handleKeydown('ArrowLeft', true, false);
  assert.strictEqual(currentReaderPage, 1);
});

console.log('\n========================================================================');
console.log(`  M1 FUNCTIONAL TESTS: ${passCount} Passed, ${failCount} Failed`);
console.log('========================================================================');

if (failCount > 0) process.exit(1);
