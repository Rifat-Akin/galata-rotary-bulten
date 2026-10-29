/**
 * Challenger 2 for Milestone 2: Empirical Adversarial Layout & Typography Test Suite
 * 
 * Mission:
 * 1. Check public/styles/bulletin-print.css for dimensional compliance:
 *    - @page { size: 210mm 297mm; margin: 0; }
 *    - .a4-page dimensions (210mm x 297mm, max-height: 297mm, overflow: hidden, page breaks)
 *    - @media print rules (margin: 0 !important, box-shadow: none, last-child page-break-after: auto)
 * 2. Verify that Turkish characters render crisply and are not replaced with fallback question marks or broken glyphs:
 *    - Full charset UTF-8 verification
 *    - Zero \uFFFD, zero mojibake, zero ? substitutions in names and titles
 *    - Font stack coverage with Turkish Unicode support
 *    - Binary PDF ToUnicode CMap analysis across all 4 output PDFs for all 12 Turkish characters
 * 3. Check that Page 2 is the ONLY page containing the 12-month Rotary Calendar:
 *    - Complete 12 months present in correct Rotary order
 *    - Exactly ONE active month matching the issue
 *    - Active month highlighted with gold border #F7A81B
 *    - Negative check: Pages 1, 3..N have ZERO calendar elements
 * 4. Check that the back cover is rendered as a discrete, full A4 page in crimson #E01E26 with "ÇOCUK FELCİNE SON":
 *    - Discrete .a4-page.page-backcover as final page
 *    - Background #E01E26 with print-color-adjust: exact
 *    - "ÇOCUK FELCİNE SON" title and "END POLIO NOW" subtitle
 *    - Negative check: No other page is back cover or contains "ÇOCUK FELCİNE SON"
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { renderIssueToHTML, ROTARY_MONTHS } from '../public/renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const CSS_PATH = path.join(PROJECT_ROOT, 'public', 'styles', 'bulletin-print.css');
const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'issues');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');

const TURKISH_CHARS = ['ç', 'Ç', 'ğ', 'Ğ', 'ı', 'İ', 'ö', 'Ö', 'ş', 'Ş', 'ü', 'Ü'];
const TURKISH_UNICODE_MAP = {
  'ç': '00e7', 'Ç': '00c7',
  'ğ': '011f', 'Ğ': '011e',
  'ı': '0131', 'İ': '0130',
  'ö': '00f6', 'Ö': '00d6',
  'ş': '015f', 'Ş': '015e',
  'ü': '00fc', 'Ü': '00dc'
};

const ISSUES = [
  { id: '2026-07-temmuz', month: 'Temmuz', pages: 8, pdf: 'Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf' },
  { id: '2026-08-agustos', month: 'Ağustos', pages: 8, pdf: 'Galata_Rotary_Bulten_2026_08_Agustos_Sayi_2.pdf' },
  { id: '2026-09-eylul', month: 'Eylül', pages: 9, pdf: 'Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf' },
  { id: '2026-10-ekim', month: 'Ekim', pages: 9, pdf: 'Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf' }
];

async function main() {
  console.log('========================================================================');
  console.log('  CHALLENGER 2 (M2): PRINT STYLING, TYPOGRAPHY & LAYOUT VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;
  const failures = [];

  function assert(name, condition, details = '') {
    if (condition) {
      passed++;
      console.log(`  ✔ [PASS] ${name}`);
    } else {
      failed++;
      console.error(`  ✖ [FAIL] ${name}${details ? ` -> ${details}` : ''}`);
      failures.push({ name, details });
    }
  }

  // ----------------------------------------------------------------------
  // SUITE 1: Dimensional Compliance in public/styles/bulletin-print.css
  // ----------------------------------------------------------------------
  console.log('[SUITE 1] Dimensional Compliance (bulletin-print.css)');
  console.log('────────────────────────────────────────────────────────────────────────');

  assert('CSS file exists at public/styles/bulletin-print.css', fs.existsSync(CSS_PATH));
  const cssContent = fs.readFileSync(CSS_PATH, 'utf8');

  // Check @page declaration
  const atPageMatch = cssContent.match(/@page\s*\{([^}]+)\}/i);
  assert('@page rule is present in CSS', !!atPageMatch);
  if (atPageMatch) {
    const pageBody = atPageMatch[1].replace(/\s+/g, ' ');
    assert('@page specifies "size: 210mm 297mm"', /size\s*:\s*210mm\s+297mm/i.test(pageBody));
    assert('@page specifies "margin: 0"', /margin\s*:\s*0/i.test(pageBody));
  }

  // Check .a4-page rule
  const a4PageMatch = cssContent.match(/\.a4-page\s*\{([^}]+)\}/i);
  assert('.a4-page CSS rule is present', !!a4PageMatch);
  if (a4PageMatch) {
    const a4Body = a4PageMatch[1];
    assert('.a4-page has width: 210mm', /width\s*:\s*210mm/i.test(a4Body));
    assert('.a4-page has height: 297mm', /height\s*:\s*297mm/i.test(a4Body));
    assert('.a4-page has max-height: 297mm', /max-height\s*:\s*297mm/i.test(a4Body));
    assert('.a4-page has box-sizing: border-box', /box-sizing\s*:\s*border-box/i.test(a4Body));
    assert('.a4-page has overflow: hidden', /overflow\s*:\s*hidden/i.test(a4Body));
    assert('.a4-page specifies page break behavior', /page-break-after\s*:\s*always/i.test(a4Body) || /break-after\s*:\s*page/i.test(a4Body));
    assert('.a4-page forces print-color-adjust exact', /print-color-adjust\s*:\s*exact/i.test(a4Body));
  }

  // Check @media print block
  const printMediaBlocks = [...cssContent.matchAll(/@media\s+print\s*\{([\s\S]*?\n\})/gi)];
  assert('@media print blocks are present in CSS', printMediaBlocks.length >= 1);
  const firstPrintMedia = printMediaBlocks[0] ? printMediaBlocks[0][1] : '';
  assert('@media print strips body background', /background\s*:\s*transparent/i.test(firstPrintMedia));
  assert('@media print sets .a4-page margin: 0 !important', /\.a4-page[\s\S]*?margin\s*:\s*0\s*!important/i.test(firstPrintMedia));
  assert('@media print sets .a4-page box-shadow: none !important', /box-shadow\s*:\s*none\s*!important/i.test(firstPrintMedia));
  assert('@media print suppresses page-break-after on last-child', /\.a4-page:last-child[\s\S]*?page-break-after\s*:\s*auto/i.test(firstPrintMedia));

  // Check corporate color palette variables
  assert('CSS defines --color-galata-navy: #0B2545', /--color-galata-navy\s*:\s*#0B2545/i.test(cssContent));
  assert('CSS defines --color-rotary-blue: #17458F', /--color-rotary-blue\s*:\s*#17458F/i.test(cssContent));
  assert('CSS defines --color-rotary-gold: #F7A81B', /--color-rotary-gold\s*:\s*#F7A81B/i.test(cssContent));
  assert('CSS defines --color-paper-ivory: #FAF8F3', /--color-paper-ivory\s*:\s*#FAF8F3/i.test(cssContent));
  assert('CSS defines --color-polio-red: #E01E26', /--color-polio-red\s*:\s*#E01E26/i.test(cssContent));
  assert('CSS defines --color-text-main: #16243B', /--color-text-main\s*:\s*#16243B/i.test(cssContent));

  console.log('\n[SUITE 2] Turkish Character Crisp Rendering & Typography Conformance');
  console.log('────────────────────────────────────────────────────────────────────────');

  // Verify UTF-8 charset declaration in renderer output
  const sampleIssue = JSON.parse(fs.readFileSync(path.join(DATA_DIR, '2026-10-ekim.json'), 'utf8'));
  const renderedDoc = renderIssueToHTML(sampleIssue, { fullDoc: true });
  assert('Document declares <meta charset="UTF-8">', /<meta\s+charset=["']UTF-8["']/i.test(renderedDoc));
  assert('Document declares <html lang="tr">', /<html\s+lang=["']tr["']/i.test(renderedDoc));

  // Check font-family stack in CSS
  const fontMatch = cssContent.match(/font-family\s*:\s*([^;]+);/i);
  assert('font-family includes standard Turkish Unicode fonts', !!fontMatch);
  if (fontMatch) {
    const fonts = fontMatch[1];
    assert('font-family includes Segoe UI or Arial', /Segoe UI/i.test(fonts) || /Arial/i.test(fonts));
  }

  // Check text smoothing rules
  assert('CSS enables -webkit-font-smoothing: antialiased', /-webkit-font-smoothing\s*:\s*antialiased/i.test(cssContent));
  assert('CSS enables text-rendering: optimizeLegibility', /text-rendering\s*:\s*optimizeLegibility/i.test(cssContent));

  // Verify Turkish character integrity across all 4 issues
  let combinedRenderedHtml = '';
  for (const item of ISSUES) {
    const jsonRaw = fs.readFileSync(path.join(DATA_DIR, `${item.id}.json`), 'utf8');
    const issueData = JSON.parse(jsonRaw);
    const htmlOutput = renderIssueToHTML(issueData, { fullDoc: true });
    combinedRenderedHtml += '\n' + htmlOutput;

    // 1. Zero replacement characters \uFFFD
    assert(`${item.id}: Zero Unicode replacement characters (\\uFFFD)`, !htmlOutput.includes('\uFFFD'));

    // 2. Zero Mojibake sequences
    const mojibakePatterns = [/Ã§/, /Ã¼/, /ÄŸ/, /Ä°/, /Ã¶/, /ÅŸ/, /Ã‡/, /Ãœ/, /Äž/, /Ã–/, /Åž/, /Ä±/];
    const hasMojibake = mojibakePatterns.some(p => p.test(htmlOutput));
    assert(`${item.id}: Zero double-encoded UTF-8 mojibake patterns`, !hasMojibake);

    // 3. Zero question marks where Turkish characters should be in known words
    const brokenWordPatterns = [
      /\bB\?lten\b/i, /\bBa\?kan\b/i, /\bKul\?p\b/i, /\bB\?lge\b/i,
      /\bD\?nem\b/i, /\bK\?nye\b/i, /\b\?ocuk\b/i, /\bGe\?mi\?t\b/i
    ];
    const hasBrokenWord = brokenWordPatterns.some(p => p.test(htmlOutput));
    assert(`${item.id}: Zero broken question-mark glyph replacements in known Turkish words`, !hasBrokenWord);

    // 4. Presence of standard Turkish glyphs in each issue
    const commonTurkishChars = ['ç', 'Ç', 'ğ', 'ı', 'İ', 'ö', 'Ö', 'ş', 'Ş', 'ü', 'Ü'];
    const missingCommon = commonTurkishChars.filter(c => !htmlOutput.includes(c));
    assert(
      `${item.id}: Contains common Turkish characters (${commonTurkishChars.join(', ')})`,
      missingCommon.length === 0,
      `Missing: ${missingCommon.join(', ')}`
    );
  }

  // Verify all 12 Turkish characters (including uppercase Ğ) across combined HTML
  const missingFromCombined = TURKISH_CHARS.filter(c => !combinedRenderedHtml.includes(c));
  assert(
    'Combined 4-issue rendered HTML contains all 12 Turkish glyphs (ç, Ç, ğ, Ğ, ı, İ, ö, Ö, ş, Ş, ü, Ü)',
    missingFromCombined.length === 0,
    `Missing in combined HTML: ${missingFromCombined.join(', ')}`
  );

  // 5. Binary PDF Font CMap verification for all 4 output PDFs
  for (const item of ISSUES) {
    const pdfPath = path.join(OUTPUT_DIR, item.pdf);
    assert(`PDF exists in output: ${item.pdf}`, fs.existsSync(pdfPath));
    if (!fs.existsSync(pdfPath)) continue;

    const buf = fs.readFileSync(pdfPath);
    const latinStr = buf.toString('latin1');
    const streamRegex = /\bstream[\r\n]+/g;
    let match;
    let allCmaps = '';

    while ((match = streamRegex.exec(latinStr)) !== null) {
      const start = match.index + match[0].length;
      const end = latinStr.indexOf('endstream', start);
      if (end === -1) continue;
      try {
        const decompressed = zlib.inflateSync(buf.subarray(start, end)).toString('utf8');
        if (decompressed.includes('beginbfchar') || decompressed.includes('beginbfrange')) {
          allCmaps += decompressed + '\n';
        }
      } catch (e) {
        // Not a flate stream, ignore
      }
    }

    assert(`${item.pdf}: Embedded ToUnicode CMap streams extracted (> 0)`, allCmaps.length > 0);

    const missingInPdf = Object.entries(TURKISH_UNICODE_MAP)
      .filter(([_, code]) => !allCmaps.toLowerCase().includes(code))
      .map(([char]) => char);

    assert(
      `${item.pdf}: All 12 Turkish characters mapped in PDF ToUnicode CMaps`,
      missingInPdf.length === 0,
      `Missing codes for: ${missingInPdf.join(', ')}`
    );
  }

  console.log('\n[SUITE 3] Page 2 Rotary Calendar & Gold Border Conformance');
  console.log('────────────────────────────────────────────────────────────────────────');

  // Verify calendar CSS active month rule
  const activeMonthRule = cssContent.match(/\.calendar-month-item\.active-month\s*\{([^}]+)\}/i);
  assert('.calendar-month-item.active-month rule defined in CSS', !!activeMonthRule);
  if (activeMonthRule) {
    const body = activeMonthRule[1];
    assert('Active month specifies gold border #F7A81B', /border\s*:\s*2px\s+solid\s+#F7A81B/i.test(body));
  }

  // Split HTML into pages helper
  function extractPages(html) {
    const pageRegex = /<article class="a4-page([^"]*)"[^>]*>([\s\S]*?)<\/article>/g;
    const pages = [];
    let pMatch;
    while ((pMatch = pageRegex.exec(html)) !== null) {
      pages.push({
        classes: pMatch[1],
        content: pMatch[2]
      });
    }
    return pages;
  }

  for (const item of ISSUES) {
    const issueData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${item.id}.json`), 'utf8'));
    const html = renderIssueToHTML(issueData, { fullDoc: false });
    const pages = extractPages(html);

    assert(`${item.id}: Exactly ${item.pages} A4 pages generated`, pages.length === item.pages);

    // Page 2 verification
    const page2 = pages[1]; // 0-indexed: index 1 is Page 2
    assert(`${item.id}: Page 2 contains .calendar-col`, page2 && page2.content.includes('calendar-col'));
    assert(`${item.id}: Page 2 contains "Rotary Tanımlanmış Ayları" header`, page2 && page2.content.includes('Rotary Tanımlanmış Ayları'));
    assert(`${item.id}: Page 2 contains "Dönem Başkanı Mesajı" (Sevilay Aksel)`, page2 && page2.content.includes('Sevilay Aksel'));

    // Count calendar months on Page 2
    const monthItems = (page2.content.match(/<div class="calendar-month-item[^"]*">/g) || []).length;
    assert(`${item.id}: Page 2 contains exactly 12 month items`, monthItems === 12);

    // Check all 12 month names and themes in ROTARY_MONTHS
    let allMonthsPresent = true;
    for (const rm of ROTARY_MONTHS) {
      if (!page2.content.includes(rm.name) || !page2.content.includes(rm.theme)) {
        allMonthsPresent = false;
        break;
      }
    }
    assert(`${item.id}: Page 2 calendar lists all 12 standard Rotary months and themes`, allMonthsPresent);

    // Check active month on Page 2
    const activeItemMatches = page2.content.match(/<div class="calendar-month-item\s+active-month">/g) || [];
    assert(`${item.id}: Exactly ONE month is marked as active-month on Page 2`, activeItemMatches.length === 1);

    // Verify the active month is indeed the issue's month
    const activeBlockRegex = /<div class="calendar-month-item\s+active-month">([\s\S]*?)<\/div>/;
    const activeBlockMatch = page2.content.match(activeBlockRegex);
    assert(`${item.id}: Active month block exists`, !!activeBlockMatch);
    if (activeBlockMatch) {
      const activeText = activeBlockMatch[1];
      assert(`${item.id}: Active month name is "${item.month}"`, activeText.includes(item.month));
      assert(`${item.id}: Active month contains "BU AY" tag badge`, activeText.includes('BU AY'));
    }

    // NEGATIVE CHECK: Verify NO OTHER PAGE contains calendar elements
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      if (pIdx === 1) continue; // Skip Page 2
      const pageNum = pIdx + 1;
      const otherContent = pages[pIdx].content;
      assert(
        `${item.id}: Page ${pageNum} contains NO .calendar-col or calendar-month-item`,
        !otherContent.includes('calendar-col') &&
        !otherContent.includes('calendar-month-item') &&
        !otherContent.includes('Rotary Tanımlanmış Ayları')
      );
    }
  }

  console.log('\n[SUITE 4] Back Cover Crimson Page Conformance (#E01E26)');
  console.log('────────────────────────────────────────────────────────────────────────');

  // Verify back cover CSS rules
  const backcoverRule = cssContent.match(/\.page-backcover\s*\{([^}]+)\}/i);
  assert('.page-backcover rule defined in CSS', !!backcoverRule);
  if (backcoverRule) {
    const body = backcoverRule[1];
    assert('Back cover sets background: #E01E26 !important', /background\s*:\s*#E01E26\s*!important/i.test(body));
    assert('Back cover sets color: #FFFFFF !important', /color\s*:\s*#FFFFFF\s*!important/i.test(body));
    assert('Back cover sets width: 210mm', /width\s*:\s*210mm/i.test(body));
    assert('Back cover sets height: 297mm', /height\s*:\s*297mm/i.test(body));
  }

  // Check the second @media print block specifically for .page-backcover
  const backcoverPrintIdx = cssContent.indexOf('@media print', cssContent.indexOf('.page-backcover'));
  assert('@media print block exists for .page-backcover', backcoverPrintIdx !== -1);
  if (backcoverPrintIdx !== -1) {
    const backcoverPrintSnippet = cssContent.slice(backcoverPrintIdx, backcoverPrintIdx + 300);
    assert('@media print enforces background: #E01E26 !important on back cover', /background\s*:\s*#E01E26\s*!important/i.test(backcoverPrintSnippet));
    assert('@media print enforces print-color-adjust: exact on back cover', /print-color-adjust\s*:\s*exact\s*!important/i.test(backcoverPrintSnippet));
  }

  for (const item of ISSUES) {
    const issueData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${item.id}.json`), 'utf8'));
    const html = renderIssueToHTML(issueData, { fullDoc: false });
    const pages = extractPages(html);

    // Last page must be back cover
    const lastPage = pages[pages.length - 1];
    const lastPageNum = pages.length;

    assert(`${item.id}: Last page (Page ${lastPageNum}) has class "page-backcover"`, lastPage.classes.includes('page-backcover'));
    assert(`${item.id}: Back cover contains main title "ÇOCUK FELCİNE SON"`, lastPage.content.includes('ÇOCUK FELCİNE SON'));
    assert(`${item.id}: Back cover contains subtitle "END POLIO NOW"`, /END POLIO NOW/i.test(lastPage.content));
    assert(`${item.id}: Back cover references "end-polio-now.svg"`, lastPage.content.includes('end-polio-now.svg'));
    assert(`${item.id}: Back cover includes club Instagram handle`, lastPage.content.includes('@galatarotarykulubu'));
    assert(`${item.id}: Back cover includes corporate theme "KALICI ETKİ YARAT"`, lastPage.content.includes('KALICI ETKİ YARAT'));

    // NEGATIVE CHECK: No inner page is a back cover or contains "ÇOCUK FELCİNE SON"
    for (let pIdx = 0; pIdx < pages.length - 1; pIdx++) {
      const pageNum = pIdx + 1;
      const innerContent = pages[pIdx].content;
      const innerClasses = pages[pIdx].classes;
      assert(
        `${item.id}: Page ${pageNum} is NOT page-backcover`,
        !innerClasses.includes('page-backcover')
      );
      assert(
        `${item.id}: Page ${pageNum} does NOT contain "ÇOCUK FELCİNE SON"`,
        !innerContent.includes('ÇOCUK FELCİNE SON')
      );
    }
  }

  // ----------------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('  CHALLENGER 2 (M2) VERIFICATION SUMMARY');
  console.log('========================================================================');
  console.log(`  Total Evaluated Assertions : ${passed + failed}`);
  console.log(`  Passed                     : ${passed}`);
  console.log(`  Failed                     : ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    console.error('FAILURES:');
    for (const f of failures) {
      console.error(`  - ${f.name} (${f.details})`);
    }
    process.exit(1);
  } else {
    console.log('STATUS: VERIFIED & COMPLIANT (All layout, print styling, typography, calendar and backcover assertions passed 100%)');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
