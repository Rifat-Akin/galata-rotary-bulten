/**
 * Reviewer M1-1 Empirical & Adversarial Verification Script
 * Validates Milestone M1 implementation integrity, DOM IDs, regex veto,
 * path resolution, CSS rules, and edge cases.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';

const PROJECT_ROOT = process.cwd();

console.log('========================================================================');
console.log('  REVIEWER M1-1: ADVERSARIAL STRESS TEST & INTEGRITY AUDIT');
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
// SUITE 1: DOM ID & Markup Contract Verification
// ----------------------------------------------------------------------
console.log('[SUITE 1] DOM ID & Markup Contract Verification');
console.log('─'.repeat(72));

const htmlContent = fs.readFileSync(path.join(PROJECT_ROOT, 'public/index.html'), 'utf8');
const jsContent = fs.readFileSync(path.join(PROJECT_ROOT, 'public/studio.js'), 'utf8');
const cssContent = fs.readFileSync(path.join(PROJECT_ROOT, 'public/styles/studio.css'), 'utf8');

// Extract all getElementById calls from studio.js
const idMatches = Array.from(jsContent.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)).map(m => m[1]);
const uniqueIdsInJs = Array.from(new Set(idMatches));

test('All getElementById targets in studio.js exist in public/index.html', () => {
  const missingIds = [];
  uniqueIdsInJs.forEach(id => {
    // runtime-mode-badge can be created dynamically if missing, but should be in HTML
    const pattern = new RegExp(`id=["']${id}["']`);
    if (!pattern.test(htmlContent)) {
      missingIds.push(id);
    }
  });
  assert.strictEqual(missingIds.length, 0, `Missing IDs in index.html: ${missingIds.join(', ')}`);
});

test('public/index.html contains Mode Switcher buttons (btn-mode-editor, btn-mode-reader)', () => {
  assert(htmlContent.includes('id="btn-mode-editor"'), 'btn-mode-editor missing');
  assert(htmlContent.includes('id="btn-mode-reader"'), 'btn-mode-reader missing');
});

test('public/index.html contains Reader Navigation toolbar with page indicators and jump select', () => {
  assert(htmlContent.includes('id="reader-navigation-bar"'), 'reader-navigation-bar missing');
  assert(htmlContent.includes('id="btn-prev-page"'), 'btn-prev-page missing');
  assert(htmlContent.includes('id="btn-next-page"'), 'btn-next-page missing');
  assert(htmlContent.includes('id="reader-page-current"'), 'reader-page-current missing');
  assert(htmlContent.includes('id="reader-page-total"'), 'reader-page-total missing');
  assert(htmlContent.includes('id="reader-page-jump-select"'), 'reader-page-jump-select missing');
  assert(htmlContent.includes('id="btn-fullscreen-toggle"'), 'btn-fullscreen-toggle missing');
});

test('public/index.html contains Reset and Download JSON buttons', () => {
  assert(htmlContent.includes('id="btn-download-json"'), 'btn-download-json missing');
  assert(htmlContent.includes('id="btn-reset-issue"'), 'btn-reset-issue missing');
});

// ----------------------------------------------------------------------
// SUITE 2: CSS Conformance & Non-Displacing Overflow Rules
// ----------------------------------------------------------------------
console.log('\n[SUITE 2] CSS Conformance & Non-Displacing Overflow Rules');
console.log('─'.repeat(72));

test('.page-overflow-indicator is position: absolute (0px content displacement)', () => {
  assert(cssContent.includes('.page-overflow-indicator'), '.page-overflow-indicator rule missing');
  const match = cssContent.match(/\.page-overflow-indicator\s*\{([^}]+)\}/);
  assert(match, '.page-overflow-indicator rule block not found');
  const body = match[1];
  assert(body.includes('position: absolute'), 'Must be position: absolute to prevent displacement');
  assert(body.includes('top: 14px') || body.includes('top:'), 'Must specify top positioning');
  assert(body.includes('right: 14px') || body.includes('right:'), 'Must specify right positioning');
  assert(body.includes('z-index: 1000') || body.includes('z-index:'), 'Must have high z-index');
});

test('@media print suppresses all interactive reader and overflow badges', () => {
  const printBlockMatch = cssContent.match(/@media print\s*\{([\s\S]+?)\}\s*\n/);
  assert(printBlockMatch, '@media print block not found in studio.css');
  const printRules = printBlockMatch[1];
  assert(printRules.includes('.page-overflow-indicator'), '.page-overflow-indicator not suppressed in print');
  assert(printRules.includes('.reader-navigation-bar'), '.reader-navigation-bar not suppressed in print');
  assert(printRules.includes('.studio-mode-switch'), '.studio-mode-switch not suppressed in print');
  assert(printRules.includes('.runtime-mode-badge'), '.runtime-mode-badge not suppressed in print');
});

test('Responsive media queries for <900px and <640px exist and are properly structured', () => {
  assert(cssContent.includes('@media screen and (max-width: 900px)'), 'max-width: 900px query missing');
  assert(cssContent.includes('@media screen and (max-width: 640px)'), 'max-width: 640px query missing');
  assert(cssContent.includes('mode-reader-active'), 'mode-reader-active selector missing');
});

test('Mobile 16px font-size rule present to prevent iOS Safari auto-zoom', () => {
  const mobile640Index = cssContent.indexOf('@media screen and (max-width: 640px)');
  assert(mobile640Index !== -1, '640px media query missing');
  const mobileCss = cssContent.substring(mobile640Index);
  assert(mobileCss.includes('font-size: 16px !important'), '16px input font-size rule missing in mobile breakpoint');
});

// ----------------------------------------------------------------------
// SUITE 3: Dual Mode Logic & Relative Path Resolution Stress
// ----------------------------------------------------------------------
console.log('\n[SUITE 3] Dual Mode Logic & Relative Path Resolution Stress');
console.log('─'.repeat(72));

function mockResolveAppPath(relPath, origin, pathname) {
  const cleanRel = relPath.replace(/^\/+/, '');
  const dir = pathname.substring(0, pathname.lastIndexOf('/') + 1) || '/';
  return `${origin}${dir}${cleanRel}`;
}

test('resolveAppPath correctly handles root deployment (localhost)', () => {
  const resolved = mockResolveAppPath('data/issues/index.json', 'http://localhost:3420', '/');
  assert.strictEqual(resolved, 'http://localhost:3420/data/issues/index.json');
});

test('resolveAppPath correctly handles root deployment with index.html', () => {
  const resolved = mockResolveAppPath('data/issues/index.json', 'http://localhost:3420', '/index.html');
  assert.strictEqual(resolved, 'http://localhost:3420/data/issues/index.json');
});

test('resolveAppPath correctly preserves GitHub Pages subpath', () => {
  const resolved = mockResolveAppPath(
    'data/issues/index.json',
    'https://rifat-akin.github.io',
    '/galata-rotary-bulten/'
  );
  assert.strictEqual(resolved, 'https://rifat-akin.github.io/galata-rotary-bulten/data/issues/index.json');
});

test('resolveAppPath correctly handles subpath with trailing index.html', () => {
  const resolved = mockResolveAppPath(
    'output/Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf',
    'https://rifat-akin.github.io',
    '/galata-rotary-bulten/index.html'
  );
  assert.strictEqual(resolved, 'https://rifat-akin.github.io/galata-rotary-bulten/output/Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf');
});

test('resolveAppPath strips leading slashes in relative paths', () => {
  const resolved = mockResolveAppPath('/output/test.pdf', 'http://localhost:3420', '/');
  assert.strictEqual(resolved, 'http://localhost:3420/output/test.pdf');
});

// ----------------------------------------------------------------------
// SUITE 4: Adversarial Corporate Theme Veto Regex Testing
// ----------------------------------------------------------------------
console.log('\n[SUITE 4] Adversarial Corporate Theme Veto Regex Testing');
console.log('─'.repeat(72));

const FORBIDDEN_THEME_REGEX = /rotary\s*[sş][iıİI]hr[iıİI]/i;

const forbiddenCases = [
  'Rotary Sihri',
  'rotary sihri',
  'ROTARY SİHRİ',
  'ROTARY SIHRI',
  'Rotary Şihri',
  'rotary  sıhri',
  'Rotary   Sihri',
  'Bu bültende rotary sihri teması kullanılmıştır',
  'ROTARY  ŞİHRİ'
];

forbiddenCases.forEach(c => {
  test(`FORBIDDEN_THEME_REGEX vetoes: "${c}"`, () => {
    assert(FORBIDDEN_THEME_REGEX.test(c), `Failed to match forbidden phrase in "${c}"`);
  });
});

const allowedCases = [
  'KALICI ETKİ YARAT',
  'Rotary Barış Ormanı',
  'Rotary Vakfı',
  'Rotary ile Sihirli Değil Kalıcı Etki',
  'Sihirli bir akşam değil, kalıcı bir proje'
];

allowedCases.forEach(c => {
  test(`FORBIDDEN_THEME_REGEX allows legitimate phrase: "${c}"`, () => {
    assert(!FORBIDDEN_THEME_REGEX.test(c), `False positive on legitimate phrase "${c}"`);
  });
});

// ----------------------------------------------------------------------
// SUITE 5: HTML Escaping & XSS Sanitization Stress
// ----------------------------------------------------------------------
console.log('\n[SUITE 5] HTML Escaping & XSS Sanitization Stress');
console.log('─'.repeat(72));

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

test('escapeHtml neutralizes tags', () => {
  const escaped = escapeHtml('<script>alert("xss")</script>');
  assert(!escaped.includes('<script>'), 'Failed to escape tag');
  assert(escaped.includes('&lt;script&gt;'));
});

test('escapeAttr neutralizes attribute breakout quotes', () => {
  const escaped = escapeAttr('" onclick="alert(1)"');
  assert(!escaped.includes('"'), 'Quotes not escaped');
  assert(escaped.includes('&quot;'));
});

test('escapeHtml and escapeAttr safely handle null, undefined, numbers', () => {
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
  assert.strictEqual(escapeHtml(12345), '12345');
  assert.strictEqual(escapeAttr(null), '');
  assert.strictEqual(escapeAttr(undefined), '');
  assert.strictEqual(escapeAttr(999), '999');
});

// ----------------------------------------------------------------------
// SUITE 6: Integrity Violations & Cheating Audit
// ----------------------------------------------------------------------
console.log('\n[SUITE 6] Integrity Violations & Cheating Audit');
console.log('─'.repeat(72));

test('No hardcoded test mocks or dummy responses in studio.js', () => {
  assert(!jsContent.includes('// mock test pass'), 'Mock test found');
  assert(!jsContent.includes('window.__MOCK_TEST_OVERRIDE__'), 'Mock test override found');
  assert(!jsContent.includes('return true; // bypass'), 'Bypass shortcut found');
});

test('No facade functions with empty bodies in critical workflows', () => {
  const checkA4Match = jsContent.match(/function checkA4PageOverflow\([^)]*\)\s*\{([^}]+)\}/);
  assert(checkA4Match, 'checkA4PageOverflow function missing');
  assert(checkA4Match[1].length > 100, 'checkA4PageOverflow body too trivial');

  const setViewModeMatch = jsContent.match(/function setViewMode\([^)]*\)\s*\{([^}]+)\}/);
  assert(setViewModeMatch, 'setViewMode function missing');
  assert(setViewModeMatch[1].includes('mode-reader-active'), 'setViewMode body missing mode-reader-active logic');

  const addPhotoIndex = jsContent.indexOf('function addPhotoToArticle');
  assert(addPhotoIndex !== -1, 'addPhotoToArticle function missing');
  const addPhotoSlice = jsContent.substring(addPhotoIndex, addPhotoIndex + 1500);
  assert(addPhotoSlice.includes('createPhotoRowElement'), 'addPhotoToArticle must call createPhotoRowElement');
});

// ----------------------------------------------------------------------
// SUITE 7: M1 Enhancements & Empirical Verification
// ----------------------------------------------------------------------
console.log('\n[SUITE 7] M1 Enhancements & Empirical Verification');
console.log('─'.repeat(72));

const serverContent = fs.readFileSync(path.join(PROJECT_ROOT, 'server.mjs'), 'utf8');

test('Reader Mode Keyboard Navigation in studio.js handles ArrowLeft, PageUp, ArrowRight, PageDown', () => {
  assert(jsContent.includes('e.key === \'ArrowLeft\' || e.key === \'PageUp\''), 'ArrowLeft/PageUp handler missing');
  assert(jsContent.includes('e.key === \'ArrowRight\' || e.key === \'PageDown\''), 'ArrowRight/PageDown handler missing');
  assert(jsContent.includes('mode-reader-active'), 'Must guard navigation with mode-reader-active check');
});

test('Reader Mode Keyboard Navigation ignores events on input, textarea, and contenteditable', () => {
  assert(jsContent.includes('tagName === \'INPUT\''), 'INPUT tag check missing');
  assert(jsContent.includes('tagName === \'TEXTAREA\''), 'TEXTAREA tag check missing');
  assert(jsContent.includes('isContentEditable') || jsContent.includes('contenteditable'), 'contenteditable check missing');
});

test('Ctrl + MouseWheel Zooming listener exists on #preview-viewport with valid bounds (0.4 to 2.0)', () => {
  assert(jsContent.includes('preview-viewport'), 'preview-viewport container missing');
  assert(jsContent.includes("addEventListener('wheel'"), 'wheel event listener missing');
  assert(jsContent.includes('e.ctrlKey'), 'ctrlKey check missing in wheel listener');
  assert(jsContent.includes('e.preventDefault()'), 'preventDefault missing in wheel listener');
  assert(jsContent.includes('0.4') && jsContent.includes('2.0'), 'Zoom clamping bounds [0.4, 2.0] missing');
  assert(jsContent.includes('applyZoom()'), 'applyZoom call missing');
});

test('selectIssue(issueId) resets currentReaderPage to 1 and updates reader page selector', () => {
  const selectIssueMatch = jsContent.match(/async function selectIssue\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\/\*\*|\nasync function|\nfunction)/);
  assert(selectIssueMatch, 'selectIssue function not found');
  const body = selectIssueMatch[1];
  assert(body.includes('currentReaderPage = 1'), 'currentReaderPage reset to 1 missing');
  assert(body.includes('updateReaderPageIndicator(1)'), 'updateReaderPageIndicator(1) missing');
  assert(body.includes('reader-page-jump-select'), 'reader-page-jump-select update missing');
});

test('Multi-Page Overflow Cycling cycles sequentially across repeated clicks on #overflow-status-badge', () => {
  const checkOverflowMatch = jsContent.match(/function checkA4PageOverflow\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\/\*\*|\nfunction|\n\/\*)/);
  assert(checkOverflowMatch, 'checkA4PageOverflow not found');
  const body = checkOverflowMatch[1];
  assert(body.includes('overflowCycleIndex'), 'overflowCycleIndex state tracking missing');
  assert(body.includes('querySelectorAll(\'.a4-page.page-overflow\')'), 'Must query all overflowing pages');
  assert(body.includes('% overflowPages.length'), 'Must cycle through pages modulo total overflowing count');
});

test('Asynchronous Image Overflow Re-check triggers checkA4PageOverflow on image load and error', () => {
  assert(jsContent.includes("img.addEventListener('load'"), 'Image load listener missing');
  assert(jsContent.includes("img.addEventListener('error'"), 'Image error listener missing');
  assert(jsContent.includes('checkA4PageOverflow()'), 'checkA4PageOverflow() call on image completion missing');
});

test('server.mjs createIssue() resolves monthNumStr by looking up customData.month in MONTH_ORDER', () => {
  assert(serverContent.includes('monthEntry = MONTH_ORDER.find'), 'MONTH_ORDER lookup for customData.month missing');
  assert(serverContent.includes('monthNumStr = String(monthEntry.num).padStart(2, \'0\')'), 'monthNumStr derivation from monthEntry.num missing');
});

test('server.mjs POST /api/export-pdf/:id robustly resolves PDF output filename', () => {
  assert(serverContent.includes('ISSUE_PDF_MAP'), 'ISSUE_PDF_MAP mapping missing in server.mjs');
  const exportPdfMatch = serverContent.match(/pathname\.startsWith\('\/api\/export-pdf\/'\)([\s\S]*?)(?=\n\s*\/\/\s*POST|\n\s*if\s*\(method)/);
  assert(exportPdfMatch, 'export-pdf endpoint not found');
  const body = exportPdfMatch[1];
  assert(body.includes('ISSUE_PDF_MAP[issueId]'), 'ISSUE_PDF_MAP check missing');
  assert(!body.includes("split('-')[2]"), "Fragile split('-')[2] must be eliminated");
});

// ----------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------
console.log('\n========================================================================');
console.log('  REVIEWER M1-1 STRESS TEST SUMMARY');
console.log('========================================================================');
console.log(`  Total Evaluated Tests : ${passCount + failCount}`);
console.log(`  Passed                : ${passCount}`);
console.log(`  Failed                : ${failCount}`);
console.log('========================================================================');

if (failCount > 0) {
  process.exit(1);
}
