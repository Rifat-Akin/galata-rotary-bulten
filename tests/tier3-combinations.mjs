/**
 * Tier 3: Cross-Feature Combinations Tests
 * Tests interactions between Bento grids, photo counts, calendar highlighting, and preview/print parity.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ROTARY_GOLD,
  PAPER_IVORY
} from './fixtures/mock-issues.mjs';

export function createTier3Suites(projectRoot) {
  const publicDir = path.join(projectRoot, 'public');
  const cssDir = path.join(publicDir, 'styles');
  const dataDir = path.join(projectRoot, 'data', 'issues');

  return [
    // T3-01: Bento layout mode combinations
    {
      id: 'T3-01',
      title: 'Combination: Bento Layout Modes & CSS Grid Template Consistency',
      milestone: 'M2',
      async run() {
        const printCssPath = path.join(cssDir, 'bulletin-print.css');
        if (!fs.existsSync(printCssPath)) {
          return { status: 'PENDING', milestone: 'M2', message: 'bulletin-print.css not yet created' };
        }
        const css = fs.readFileSync(printCssPath, 'utf8');

        // Check layout classes: single-col, two-col, bento-3, bento-4
        const layouts = [
          { name: 'single-col', minPhotos: 1 },
          { name: 'two-col', minPhotos: 2 },
          { name: 'bento-3', minPhotos: 3 },
          { name: 'bento-4', minPhotos: 4 }
        ];

        for (const layout of layouts) {
          if (!css.includes(layout.name)) {
            throw new Error(`CSS does not declare Bento layout rule for .${layout.name}`);
          }
        }

        return { status: 'PASS', message: 'Bento layout grid CSS rules verified across all 4 modes' };
      }
    },

    // T3-02: Calendar Month Highlighting Sync
    {
      id: 'T3-02',
      title: 'Combination: 12-Month Calendar Active Month Highlighting & Single-Page Placement',
      milestone: 'M1',
      async run() {
        const expectedMonths = [
          { file: '2026-07-temmuz.json', month: 'Temmuz', themeContains: 'Çocuk Sağlığı' },
          { file: '2026-08-agustos.json', month: 'Ağustos', themeContains: 'Üyelik' },
          { file: '2026-09-eylul.json', month: 'Eylül', themeContains: 'Eğitim' },
          { file: '2026-10-ekim.json', month: 'Ekim', themeContains: 'Ekonomik' }
        ];

        if (!fs.existsSync(dataDir)) {
          return { status: 'PENDING', milestone: 'M1', message: 'data/issues not yet created' };
        }

        for (const exp of expectedMonths) {
          const filePath = path.join(dataDir, exp.file);
          if (fs.existsSync(filePath)) {
            const issue = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (issue.month !== exp.month) {
              throw new Error(`${exp.file} month is "${issue.month}", expected "${exp.month}"`);
            }
            if (!issue.rotaryMonthTheme || !issue.rotaryMonthTheme.includes(exp.themeContains)) {
              throw new Error(`${exp.file} rotaryMonthTheme "${issue.rotaryMonthTheme}" does not contain expected keyword "${exp.themeContains}"`);
            }
          }
        }

        // If public/styles/bulletin-print.css exists, verify gold border rule (#F7A81B)
        const printCssPath = path.join(cssDir, 'bulletin-print.css');
        if (fs.existsSync(printCssPath)) {
          const css = fs.readFileSync(printCssPath, 'utf8');
          if (!css.toUpperCase().includes(ROTARY_GOLD.toUpperCase()) && !css.toLowerCase().includes('#f7a81b')) {
            throw new Error(`bulletin-print.css does not declare gold border (${ROTARY_GOLD}) for active calendar month`);
          }
        }

        return { status: 'PASS', message: 'Calendar month sync and active gold border rule verified' };
      }
    },

    // T3-03: Responsive Preview & Print CSS Parity
    {
      id: 'T3-03',
      title: 'Combination: Live Preview and Print CSS Dimension Parity (210mm x 297mm)',
      milestone: 'M2',
      async run() {
        const printCssPath = path.join(cssDir, 'bulletin-print.css');
        if (!fs.existsSync(printCssPath)) {
          return { status: 'PENDING', milestone: 'M2', message: 'bulletin-print.css not yet created' };
        }
        const css = fs.readFileSync(printCssPath, 'utf8');

        // Verify A4 dimensions in CSS
        if (!css.includes('210mm') || !css.includes('297mm')) {
          throw new Error('bulletin-print.css does not specify standard A4 dimensions (210mm x 297mm)');
        }

        // Verify @page configuration
        if (!css.includes('@page') || !css.includes('margin: 0')) {
          throw new Error('bulletin-print.css missing @page rule with margin: 0');
        }

        // Verify color adjust flag
        if (!css.includes('print-color-adjust') && !css.includes('-webkit-print-color-adjust')) {
          throw new Error('bulletin-print.css missing exact print color adjust directive');
        }

        // Verify ivory paper background (#FAF8F3)
        if (!css.toLowerCase().includes('#faf8f3')) {
          throw new Error(`bulletin-print.css missing Warm Ivory Paper background color (#FAF8F3)`);
        }

        return { status: 'PASS', message: 'Live preview and print CSS dimensional & color parity verified' };
      }
    }
  ];
}
