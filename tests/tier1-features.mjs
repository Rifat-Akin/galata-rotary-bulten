/**
 * Tier 1: Feature Coverage Tests (Features 1–21 in isolation)
 * Verifies every feature from PROJECT.md Feature Inventory against contracts and specifications.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  CORPORATE_THEME,
  FORBIDDEN_THEME,
  POLIO_CRIMSON,
  ROTARY_GOLD,
  EXPECTED_OFFICERS,
  EXPECTED_BOOKS
} from './fixtures/mock-issues.mjs';

export function createTier1Suites(projectRoot) {
  const dataDir = path.join(projectRoot, 'data', 'issues');
  const scriptsDir = path.join(projectRoot, 'scripts');
  const publicDir = path.join(projectRoot, 'public');
  const outputDir = path.join(projectRoot, 'output');

  return [
    // Feature 1: Single-Command Server & Launcher
    {
      id: 'T1-F01',
      title: 'Feature 1: Single-Command Server & Launcher (baslat.bat / npm start)',
      milestone: 'M3',
      async run() {
        const batPath = path.join(projectRoot, 'baslat.bat');
        const pkgPath = path.join(projectRoot, 'package.json');
        if (!fs.existsSync(batPath) && !fs.existsSync(pkgPath)) {
          return { status: 'PENDING', milestone: 'M3', message: 'baslat.bat / package.json not yet created' };
        }
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (!pkg.scripts || !pkg.scripts.start) {
            throw new Error('package.json missing "scripts.start" command');
          }
        }
        if (fs.existsSync(batPath)) {
          const batContent = fs.readFileSync(batPath, 'utf8');
          if (!batContent.toLowerCase().includes('server') && !batContent.toLowerCase().includes('npm start')) {
            throw new Error('baslat.bat does not invoke server or npm start');
          }
        }
        return { status: 'PASS', message: 'Single-command server and launcher scripts configured correctly' };
      }
    },

    // Feature 2: Modular REST API
    {
      id: 'T1-F02',
      title: 'Feature 2: Modular REST API (server.mjs endpoints)',
      milestone: 'M3',
      async run() {
        const serverPath = path.join(projectRoot, 'server.mjs');
        if (!fs.existsSync(serverPath)) {
          return { status: 'PENDING', milestone: 'M3', message: 'server.mjs not yet created' };
        }
        const serverCode = fs.readFileSync(serverPath, 'utf8');
        const requiredEndpoints = ['/api/issues', '/api/upload', '/api/rotaclub'];
        for (const ep of requiredEndpoints) {
          if (!serverCode.includes(ep)) {
            throw new Error(`server.mjs does not declare expected endpoint: ${ep}`);
          }
        }
        return { status: 'PASS', message: 'server.mjs declares modular REST API endpoints' };
      }
    },

    // Feature 3: RotaClub Decoupled Renderer
    {
      id: 'T1-F03',
      title: 'Feature 3: RotaClub Decoupled Renderer (public/renderer.js)',
      milestone: 'M2',
      async run() {
        const rendererPath = path.join(publicDir, 'renderer.js');
        if (!fs.existsSync(rendererPath)) {
          return { status: 'PENDING', milestone: 'M2', message: 'public/renderer.js not yet created' };
        }
        const code = fs.readFileSync(rendererPath, 'utf8');
        if (!code.includes('renderIssue') && !code.includes('renderBulletin') && !code.includes('createPage')) {
          throw new Error('public/renderer.js must export or define an issue rendering function (e.g. renderIssue)');
        }
        return { status: 'PASS', message: 'public/renderer.js decoupled rendering module present' };
      }
    },

    // Feature 4: Split-Screen Studio Editor
    {
      id: 'T1-F04',
      title: 'Feature 4: Split-Screen Studio Editor (index.html & studio.js)',
      milestone: 'M3',
      async run() {
        const indexPath = path.join(publicDir, 'index.html');
        const studioJsPath = path.join(publicDir, 'studio.js');
        if (!fs.existsSync(indexPath) || !fs.existsSync(studioJsPath)) {
          return { status: 'PENDING', milestone: 'M3', message: 'Studio UI files not yet created' };
        }
        const html = fs.readFileSync(indexPath, 'utf8');
        if (!html.includes('preview') || (!html.includes('editor') && !html.includes('sidebar') && !html.includes('pane'))) {
          throw new Error('public/index.html missing split-pane studio layout elements');
        }
        return { status: 'PASS', message: 'Split-screen Studio UI components verified' };
      }
    },

    // Feature 5: Dynamic Photo Grid / Bento Selector
    {
      id: 'T1-F05',
      title: 'Feature 5: Dynamic Photo Grid / Bento Selector CSS (bulletin-print.css)',
      milestone: 'M2',
      async run() {
        const cssPath = path.join(publicDir, 'styles', 'bulletin-print.css');
        if (!fs.existsSync(cssPath)) {
          return { status: 'PENDING', milestone: 'M2', message: 'bulletin-print.css not yet created' };
        }
        const css = fs.readFileSync(cssPath, 'utf8');
        const bentoClasses = ['two-col', 'bento-3', 'bento-4'];
        for (const cls of bentoClasses) {
          if (!css.includes(cls)) {
            throw new Error(`bulletin-print.css missing Bento layout class: ${cls}`);
          }
        }
        return { status: 'PASS', message: 'Dynamic Bento layout CSS classes verified' };
      }
    },

    // Feature 6: A4 Overflow Detection
    {
      id: 'T1-F06',
      title: 'Feature 6: A4 Overflow Detection (visual threshold warning)',
      milestone: 'M3',
      async run() {
        const studioJsPath = path.join(publicDir, 'studio.js');
        if (!fs.existsSync(studioJsPath)) {
          return { status: 'PENDING', milestone: 'M3', message: 'public/studio.js not yet created' };
        }
        const code = fs.readFileSync(studioJsPath, 'utf8');
        if (!code.toLowerCase().includes('overflow') && !code.includes('scrollHeight') && !code.includes('297')) {
          throw new Error('public/studio.js missing height / overflow detection logic');
        }
        return { status: 'PASS', message: 'A4 overflow detection logic present in studio controller' };
      }
    },

    // Feature 7: New Month Initializer
    {
      id: 'T1-F07',
      title: 'Feature 7: New Month Initializer ("Yeni Ay Başlat")',
      milestone: 'M3',
      async run() {
        const serverPath = path.join(projectRoot, 'server.mjs');
        const studioJsPath = path.join(publicDir, 'studio.js');
        if (!fs.existsSync(serverPath) && !fs.existsSync(studioJsPath)) {
          return { status: 'PENDING', milestone: 'M3', message: 'server.mjs or studio.js not yet created' };
        }
        const code = (fs.existsSync(serverPath) ? fs.readFileSync(serverPath, 'utf8') : '') +
                     (fs.existsSync(studioJsPath) ? fs.readFileSync(studioJsPath, 'utf8') : '');
        if (!code.includes('new-issue') && !code.includes('initMonth') && !code.includes('createIssue') && !code.includes('yeni-ay') && !code.includes('newIssue')) {
          throw new Error('No template initialization mechanism found for new month in server or studio');
        }
        return { status: 'PASS', message: 'New month issue template creator verified' };
      }
    },

    // Feature 8: Headless Chrome PDF Generator
    {
      id: 'T1-F08',
      title: 'Feature 8: Headless Chrome PDF Generator (scripts/export-pdf.mjs)',
      milestone: 'M2',
      async run() {
        const scriptPath = path.join(scriptsDir, 'export-pdf.mjs');
        if (!fs.existsSync(scriptPath)) {
          return { status: 'PENDING', milestone: 'M2', message: 'scripts/export-pdf.mjs not yet created' };
        }
        const code = fs.readFileSync(scriptPath, 'utf8');
        if (!code.includes('--headless') || !code.includes('--print-to-pdf')) {
          throw new Error('scripts/export-pdf.mjs must use native Chrome headless CLI flags (--headless and --print-to-pdf)');
        }
        return { status: 'PASS', message: 'Headless Chrome PDF export script verified' };
      }
    },

    // Feature 9: Batch PDF CLI
    {
      id: 'T1-F09',
      title: 'Feature 9: Batch PDF CLI (--all flag support)',
      milestone: 'M2',
      async run() {
        const scriptPath = path.join(scriptsDir, 'export-pdf.mjs');
        if (!fs.existsSync(scriptPath)) {
          return { status: 'PENDING', milestone: 'M2', message: 'scripts/export-pdf.mjs not yet created' };
        }
        const code = fs.readFileSync(scriptPath, 'utf8');
        if (!code.includes('--all')) {
          throw new Error('scripts/export-pdf.mjs must support "--all" command line flag for batch exporting');
        }
        return { status: 'PASS', message: 'Batch PDF export CLI flag verified' };
      }
    },

    // Feature 10: Corporate Theme Enforcement
    {
      id: 'T1-F10',
      title: 'Feature 10: Corporate Theme Enforcement (KALICI ETKİ YARAT & 0 "Rotary Sihri")',
      milestone: 'M1',
      async run() {
        if (!fs.existsSync(dataDir)) {
          return { status: 'PENDING', milestone: 'M1', message: 'data/issues directory not yet created' };
        }
        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
        if (files.length === 0) {
          return { status: 'PENDING', milestone: 'M1', message: 'No issue JSON files found in data/issues' };
        }
        for (const file of files) {
          const content = fs.readFileSync(path.join(dataDir, file), 'utf8');
          if (content.includes(FORBIDDEN_THEME)) {
            throw new Error(`File ${file} contains forbidden theme token: "${FORBIDDEN_THEME}"`);
          }
          const issue = JSON.parse(content);
          if (issue.theme !== CORPORATE_THEME) {
            throw new Error(`File ${file} theme is "${issue.theme}", expected exact "${CORPORATE_THEME}"`);
          }
        }
        return { status: 'PASS', message: `All ${files.length} issues strictly adhere to "${CORPORATE_THEME}" with 0 "${FORBIDDEN_THEME}"` };
      }
    },

    // Feature 11: Page 1 Cover & Künye System
    {
      id: 'T1-F11',
      title: 'Feature 11: Page 1 Cover & Künye System (Officers, District 2420, Club 64336)',
      milestone: 'M1',
      async run() {
        if (!fs.existsSync(dataDir)) {
          return { status: 'PENDING', milestone: 'M1', message: 'data/issues directory not yet created' };
        }
        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
        if (files.length === 0) {
          return { status: 'PENDING', milestone: 'M1', message: 'No issue JSON files found' };
        }
        for (const file of files) {
          const issue = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
          if (!issue.club || !issue.officers) {
            throw new Error(`File ${file} missing club or officers metadata`);
          }
          if (!issue.club.district || !issue.club.district.includes('2420')) {
            throw new Error(`File ${file} district must be UR 2420. Bölge`);
          }
          if (issue.officers.president !== EXPECTED_OFFICERS.president) {
            throw new Error(`File ${file} president is "${issue.officers.president}", expected "${EXPECTED_OFFICERS.president}"`);
          }
          if (issue.officers.riPresident !== EXPECTED_OFFICERS.riPresident) {
            throw new Error(`File ${file} RI President is "${issue.officers.riPresident}", expected "${EXPECTED_OFFICERS.riPresident}"`);
          }
        }
        return { status: 'PASS', message: 'Page 1 Masthead & Künye metadata strictly compliant' };
      }
    },

    // Feature 12: Page 2 President Message & Calendar
    {
      id: 'T1-F12',
      title: 'Feature 12: Page 2 President Message & 12-Month Calendar Structure',
      milestone: 'M1',
      async run() {
        if (!fs.existsSync(dataDir)) {
          return { status: 'PENDING', milestone: 'M1', message: 'data/issues directory not yet created' };
        }
        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
        if (files.length === 0) {
          return { status: 'PENDING', milestone: 'M1', message: 'No issue JSON files found' };
        }
        for (const file of files) {
          const issue = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
          if (!issue.presidentMessage || !issue.presidentMessage.title || !issue.presidentMessage.body) {
            throw new Error(`File ${file} missing valid presidentMessage with title and body`);
          }
          if (!issue.rotaryMonthTheme) {
            throw new Error(`File ${file} missing rotaryMonthTheme for calendar synchronization`);
          }
        }
        return { status: 'PASS', message: 'Page 2 President message and monthly theme data verified' };
      }
    },

    // Feature 13: Full-Page Polio Back Cover
    {
      id: 'T1-F13',
      title: 'Feature 13: Full-Page Polio Back Cover ("ÇOCUK FELCİNE SON")',
      milestone: 'M1',
      async run() {
        if (!fs.existsSync(dataDir)) {
          return { status: 'PENDING', milestone: 'M1', message: 'data/issues directory not yet created' };
        }
        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
        if (files.length === 0) {
          return { status: 'PENDING', milestone: 'M1', message: 'No issue JSON files found' };
        }
        for (const file of files) {
          const issue = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
          if (!issue.backCover) {
            throw new Error(`File ${file} missing backCover object`);
          }
          if (issue.backCover.theme !== 'ÇOCUK FELCİNE SON') {
            throw new Error(`File ${file} backCover theme must be exact "ÇOCUK FELCİNE SON", found "${issue.backCover.theme}"`);
          }
          if (issue.backCover.color.toUpperCase() !== POLIO_CRIMSON.toUpperCase()) {
            throw new Error(`File ${file} backCover color must be ${POLIO_CRIMSON}, found "${issue.backCover.color}"`);
          }
        }
        return { status: 'PASS', message: 'Back cover Polio closing page specifications verified' };
      }
    },

    // Feature 14: July 2026 Issue (Sayı 1)
    {
      id: 'T1-F14',
      title: 'Feature 14: July 2026 Issue Model (2026-07-temmuz.json)',
      milestone: 'M1',
      async run() {
        const filePath = path.join(dataDir, '2026-07-temmuz.json');
        if (!fs.existsSync(filePath)) {
          return { status: 'PENDING', milestone: 'M1', message: '2026-07-temmuz.json not yet created' };
        }
        const issue = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (issue.issueNumber !== 1 || issue.month !== 'Temmuz') {
          throw new Error('2026-07-temmuz.json must be issueNumber 1 and month "Temmuz"');
        }
        if (!issue.culture || !issue.culture.book || !issue.culture.book.author.includes('İlhan Eksen')) {
          throw new Error('July issue book must be İlhan Eksen - Galata Köprüsü');
        }
        return { status: 'PASS', message: 'July 2026 (Sayı 1) issue model verified' };
      }
    },

    // Feature 15: August 2026 Issue (Sayı 2)
    {
      id: 'T1-F15',
      title: 'Feature 15: August 2026 Issue Model (2026-08-agustos.json)',
      milestone: 'M1',
      async run() {
        const filePath = path.join(dataDir, '2026-08-agustos.json');
        if (!fs.existsSync(filePath)) {
          return { status: 'PENDING', milestone: 'M1', message: '2026-08-agustos.json not yet created' };
        }
        const issue = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (issue.issueNumber !== 2 || issue.month !== 'Ağustos') {
          throw new Error('2026-08-agustos.json must be issueNumber 2 and month "Ağustos"');
        }
        return { status: 'PASS', message: 'August 2026 (Sayı 2) issue model verified' };
      }
    },

    // Feature 16: September 2026 Issue (Sayı 3 - Priority 1)
    {
      id: 'T1-F16',
      title: 'Feature 16: September 2026 Issue Model (2026-09-eylul.json)',
      milestone: 'M1',
      async run() {
        const filePath = path.join(dataDir, '2026-09-eylul.json');
        if (!fs.existsSync(filePath)) {
          return { status: 'PENDING', milestone: 'M1', message: '2026-09-eylul.json not yet created' };
        }
        const issue = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (issue.issueNumber !== 3 || issue.month !== 'Eylül') {
          throw new Error('2026-09-eylul.json must be issueNumber 3 and month "Eylül"');
        }
        if (!issue.culture || !issue.culture.book || !issue.culture.book.author.includes('Timurtaş Onan')) {
          throw new Error('September issue book must be Timurtaş Onan - Beyoğlu: Eski Yeni');
        }
        return { status: 'PASS', message: 'September 2026 (Sayı 3 - Priority 1) issue model verified' };
      }
    },

    // Feature 17: October 2026 Issue (Sayı 4 - Priority 1)
    {
      id: 'T1-F17',
      title: 'Feature 17: October 2026 Issue Model (2026-10-ekim.json)',
      milestone: 'M1',
      async run() {
        const filePath = path.join(dataDir, '2026-10-ekim.json');
        if (!fs.existsSync(filePath)) {
          return { status: 'PENDING', milestone: 'M1', message: '2026-10-ekim.json not yet created' };
        }
        const issue = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (issue.issueNumber !== 4 || issue.month !== 'Ekim') {
          throw new Error('2026-10-ekim.json must be issueNumber 4 and month "Ekim"');
        }
        if (!issue.culture || !issue.culture.book || !issue.culture.book.author.includes('Celali Yılmaz')) {
          throw new Error('October issue book must be Celali Yılmaz - Galata Hanları (1868–1945)');
        }
        return { status: 'PASS', message: 'October 2026 (Sayı 4 - Priority 1) issue model verified' };
      }
    },

    // Feature 18: WhatsApp Parser & Selective Extractor
    {
      id: 'T1-F18',
      title: 'Feature 18: WhatsApp Parser & Selective Extractor (scripts/extract-curated-photos.py)',
      milestone: 'M1',
      async run() {
        const scriptPath = path.join(scriptsDir, 'extract-curated-photos.py');
        if (!fs.existsSync(scriptPath)) {
          return { status: 'PENDING', milestone: 'M1', message: 'scripts/extract-curated-photos.py not yet created' };
        }
        const code = fs.readFileSync(scriptPath, 'utf8');
        if (!code.includes('zipfile')) {
          throw new Error('scripts/extract-curated-photos.py must use Python zipfile module for selective extraction');
        }
        return { status: 'PASS', message: 'Selective photo extraction script verified' };
      }
    },

    // Feature 19: Automated Verification Suite
    {
      id: 'T1-F19',
      title: 'Feature 19: Automated Verification Suite (scripts/validate-issues.mjs)',
      milestone: 'M1',
      async run() {
        const scriptPath = path.join(scriptsDir, 'validate-issues.mjs');
        if (!fs.existsSync(scriptPath)) {
          return { status: 'PENDING', milestone: 'M1', message: 'scripts/validate-issues.mjs not yet created' };
        }
        const code = fs.readFileSync(scriptPath, 'utf8');
        if (!code.includes('KALICI ETKİ YARAT') || !code.includes('Rotary Sihri')) {
          throw new Error('scripts/validate-issues.mjs must explicitly validate corporate theme and veto "Rotary Sihri"');
        }
        return { status: 'PASS', message: 'Issue validation script contract verified' };
      }
    },

    // Feature 20: Git Repo & Live GitHub Pages
    {
      id: 'T1-F20',
      title: 'Feature 20: Git Repo & Live GitHub Pages (.github/workflows/deploy.yml)',
      milestone: 'M5',
      async run() {
        const workflowPath = path.join(projectRoot, '.github', 'workflows', 'deploy.yml');
        if (!fs.existsSync(workflowPath)) {
          return { status: 'PENDING', milestone: 'M5', message: '.github/workflows/deploy.yml not yet created' };
        }
        const yml = fs.readFileSync(workflowPath, 'utf8');
        if (!yml.includes('deploy-pages') && !yml.includes('gh-pages')) {
          throw new Error('deploy.yml must configure GitHub Pages deployment');
        }
        return { status: 'PASS', message: 'GitHub Actions deployment workflow verified' };
      }
    },

    // Feature 21: Disk Hygiene & Temporary Cleanup
    {
      id: 'T1-F21',
      title: 'Feature 21: Disk Hygiene & Temporary Cleanup (.gitignore & zero loose zips)',
      milestone: 'M5',
      async run() {
        const gitignorePath = path.join(projectRoot, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          const content = fs.readFileSync(gitignorePath, 'utf8');
          if (!content.includes('*.zip')) {
            throw new Error('.gitignore must ignore *.zip to prevent accidental archive commits');
          }
        }
        // Check project root has no unzipped 900MB directories
        const files = fs.readdirSync(projectRoot);
        for (const f of files) {
          if (f.toLowerCase().includes('whatsapp chat') && fs.statSync(path.join(projectRoot, f)).isDirectory()) {
            throw new Error(`Disallowed unzipped WhatsApp directory in root: ${f}`);
          }
        }
        return { status: 'PASS', message: 'Disk hygiene and repository ignore rules verified' };
      }
    }
  ];
}
