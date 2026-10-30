/**
 * Challenger M1-2: Empirical Stress Test Suite & Headless Chrome Oracle
 * 
 * Target Scope:
 * 1. A4 Overflow Detection:
 *    - checkA4PageOverflow() measures pure page dimensions without counting .overflow-warning-banner or .page-overflow-indicator.
 *    - Floating indicator produces 0px layout displacement on magazine content.
 *    - Re-measurement idempotency and recovery when overflow resolves.
 * 2. Bulletin Reader Mode:
 *    - Toggling between editor and reader view.
 *    - Full-screen / 100% expansion of preview pane on gallery backdrop (#07111E).
 *    - Page jumping (1 to 8), previous/next navigation, and counter synchronization.
 * 3. Mobile / Tablet Responsive Layout:
 *    - CSS media queries (@media screen and (max-width: 900px), @media screen and (max-width: 640px)).
 *    - Single-pane tab switching on tablet (850px).
 *    - 16px font-size zoom prevention on mobile (480px) and button label compression.
 * 4. Non-Destructive Article Management:
 *    - Photo add/remove operations preserve DOM identity and focus (0 innerHTML wiping).
 *    - Bento switcher updates layout and badges in-place.
 *    - Accordion expand/collapse and title live-sync maintain DOM continuity.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

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
  '.webp': 'image/webp'
};

function findChromeBinary() {
  const candidates = [
    process.env.GALATA_CHROME_BIN || null,
    process.env['PROGRAMFILES'] ? path.join(process.env['PROGRAMFILES'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    process.env['LOCALAPPDATA'] ? path.join(process.env['LOCALAPPDATA'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
    process.env['PROGRAMFILES'] ? path.join(process.env['PROGRAMFILES'], 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

// Create HTTP server serving project root
function startTestServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url, 'http://127.0.0.1');
        let relPath = decodeURIComponent(parsedUrl.pathname);
        if (relPath === '/' || relPath === '') relPath = '/public/index.html';
        else if (!relPath.startsWith('/public/') && !relPath.startsWith('/data/') && !relPath.startsWith('/output/')) {
          relPath = '/public' + relPath;
        }

        const filePath = path.join(PROJECT_ROOT, relPath.replace(/^\/+/, ''));
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error: ' + err.message);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}

// CDP Client Helper
class ChromeSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.idCounter = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = msg => {
        try {
          const data = JSON.parse(msg.data);
          if (data.id && this.pending.has(data.id)) {
            const { resolve, reject } = this.pending.get(data.id);
            this.pending.delete(data.id);
            if (data.error) reject(new Error(data.error.message));
            else resolve(data.result);
          }
        } catch (e) {
          console.error('Error handling WS message:', e);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.idCounter++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(`Eval failed: ${desc}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function runEmpiricalChallengeSuite() {
  console.log('========================================================================');
  console.log('  CHALLENGER M1-2: EMPIRICAL HARNESS & HEADLESS CHROME ORACLE');
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
      console.error(`  ✖ [FAIL] ${name}`);
      if (details) console.error(`    Details: ${details}`);
      failures.push({ name, details });
    }
  }

  // --------------------------------------------------------------------------
  // SUITE 1: STATIC CODE & CSS ARCHITECTURE STRESS TESTS
  // --------------------------------------------------------------------------
  console.log('[SUITE 1] Static Code & CSS Architecture Verification');
  console.log('────────────────────────────────────────────────────────────────────────');

  const cssPath = path.join(PROJECT_ROOT, 'public', 'styles', 'studio.css');
  const jsPath = path.join(PROJECT_ROOT, 'public', 'studio.js');
  const htmlPath = path.join(PROJECT_ROOT, 'public', 'index.html');

  assert('public/styles/studio.css exists', fs.existsSync(cssPath));
  assert('public/studio.js exists', fs.existsSync(jsPath));
  assert('public/index.html exists', fs.existsSync(htmlPath));

  const cssText = fs.readFileSync(cssPath, 'utf8');
  const jsText = fs.readFileSync(jsPath, 'utf8');
  const htmlText = fs.readFileSync(htmlPath, 'utf8');

  // Verify CSS Media Queries exist
  assert('CSS contains @media screen and (max-width: 900px)', cssText.includes('@media screen and (max-width: 900px)'));
  assert('CSS contains @media screen and (max-width: 640px)', cssText.includes('@media screen and (max-width: 640px)'));

  // Verify non-displacing overflow indicator in CSS
  assert('CSS has .page-overflow-indicator with position: absolute', /\.page-overflow-indicator\s*\{[^}]*position:\s*absolute/i.test(cssText));
  assert('CSS has .page-overflow-indicator with top and right positioning', /\.page-overflow-indicator\s*\{[^}]*top:\s*14px;[^}]*right:\s*14px/i.test(cssText));
  assert('CSS has .page-overflow-indicator with high z-index', /\.page-overflow-indicator\s*\{[^}]*z-index:\s*1000/i.test(cssText));
  assert('CSS suppresses overflow indicator in @media print', /@media print\s*\{[^}]*\.page-overflow-indicator/i.test(cssText));

  // Verify Reader Mode expansion in CSS
  assert('CSS hides editor-pane when mode-reader-active is on body', /body\.mode-reader-active\s+\.editor-pane[^{]*\{\s*display:\s*none\s*!important/i.test(cssText));
  assert('CSS expands preview-pane to 100% when mode-reader-active is on body', /body\.mode-reader-active\s+\.preview-pane[^{]*\{\s*width:\s*100%\s*!important/i.test(cssText));
  assert('CSS applies deep museum navy (#07111E) backdrop in reader mode', /body\.mode-reader-active\s+\.preview-pane[^{]*\{[^}]*background-color:\s*#07111E/i.test(cssText));

  // Verify 16px iOS font size rule in CSS (<640px)
  assert('CSS sets 16px font-size for form inputs on mobile (<640px)', /\.form-input,\s*\.form-select,\s*\.form-textarea\s*\{\s*font-size:\s*16px\s*!important/i.test(cssText));

  // Verify clean measurement order in studio.js
  const checkOverflowFnMatch = jsText.match(/function checkA4PageOverflow\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\/\*\*|\nfunction|\n\/\*)/);
  assert('checkA4PageOverflow() function found in studio.js', !!checkOverflowFnMatch);

  if (checkOverflowFnMatch) {
    const fnBody = checkOverflowFnMatch[1];
    const removeIdx = fnBody.indexOf('.remove()');
    const scrollHeightIdx = fnBody.indexOf('page.scrollHeight');
    const clientHeightIdx = fnBody.indexOf('page.clientHeight');
    assert('Warning elements removed BEFORE scrollHeight measurement', removeIdx !== -1 && removeIdx < scrollHeightIdx, `removeIdx: ${removeIdx}, scrollHeightIdx: ${scrollHeightIdx}`);
    assert('Warning elements removed BEFORE clientHeight measurement', removeIdx !== -1 && removeIdx < clientHeightIdx, `removeIdx: ${removeIdx}, clientHeightIdx: ${clientHeightIdx}`);
    assert('Uses non-displacing .page-overflow-indicator floating badge', fnBody.includes('page-overflow-indicator') && !fnBody.includes('page.prepend(warningBanner)'));
  }

  // Verify non-destructive functions in studio.js
  assert('studio.js defines addPhotoToArticle() without rebuilding cards', jsText.includes('function addPhotoToArticle(') && !jsText.match(/function addPhotoToArticle[\s\S]*?renderArticleCards\(\)/));
  assert('studio.js defines deletePhotoFromArticle() without rebuilding cards', jsText.includes('function deletePhotoFromArticle(') && !jsText.match(/function deletePhotoFromArticle[\s\S]*?renderArticleCards\(\)/));
  assert('studio.js defines addNewArticle() non-destructively', jsText.includes('function addNewArticle('));
  assert('studio.js defines deleteArticle() non-destructively', jsText.includes('function deleteArticle('));

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 2: LIVE HEADLESS CHROME EMPIRICAL TESTING
  // --------------------------------------------------------------------------
  console.log('[SUITE 2] Live Headless Chrome Empirical Execution');
  console.log('────────────────────────────────────────────────────────────────────────');

  const chromeBin = findChromeBinary();
  assert('Headless Chrome/Edge executable is discovered', !!chromeBin, chromeBin || 'None found');

  const { server, port } = await startTestServer();
  console.log(`  ℹ Test HTTP server listening on http://127.0.0.1:${port}`);

  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-m1-2-'));
  const cdpPort = port > 60000 ? (port - 2000 - Math.floor(Math.random() * 500)) : (port + 1000 + Math.floor(Math.random() * 500));

  const chromeProc = spawn(chromeBin, [
    '--headless=new',
    ...(os.platform() === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
    `--remote-debugging-port=${cdpPort}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${tempUserDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-update',
    '--disable-background-networking',
    '--disable-breakpad',
    '--disable-crash-reporter',
    '--window-size=1280,900',
    `http://127.0.0.1:${port}/index.html`
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let session = null;

  try {
    // Wait for CDP port to open and fetch page target
    let wsUrl = null;
    for (let i = 0; i < 45; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
        if (res.ok) {
          const targets = await res.json();
          const pageTarget = targets.find(t => t.type === 'page');
          if (pageTarget && pageTarget.webSocketDebuggerUrl) {
            wsUrl = pageTarget.webSocketDebuggerUrl;
            break;
          }
        }
      } catch {}
    }

    assert('Chrome started and CDP WebSocket opened', !!wsUrl, `Port: ${cdpPort}`);

    if (wsUrl) {
      session = new ChromeSession(wsUrl);
      await session.connect();
      await session.send('Page.enable');
      await session.send('Runtime.enable');

      // Wait for page to initialize and render issues
      let ready = false;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 150));
        const hasPages = await session.eval(`document.querySelectorAll('.a4-page').length > 0`);
        if (hasPages) {
          ready = true;
          break;
        }
      }
      assert('Application loaded and initial A4 pages rendered in Chrome', ready);

      // ----------------------------------------------------------------------
      // SUB-TEST 2A: A4 Overflow Detection & Zero Displacement Verification
      // ----------------------------------------------------------------------
      console.log('\n  [2A] A4 Overflow Detection & Zero Displacement Empirical Verification');

      // 1. Initial State Check
      const initialOverflowCount = await session.eval(`document.querySelectorAll('.a4-page.page-overflow').length`);
      assert('Initial rendered September issue has 0 overflowing pages', initialOverflowCount === 0, `Count: ${initialOverflowCount}`);

      const initialStatusText = await session.eval(`document.getElementById('overflow-status-badge')?.textContent.trim()`);
      assert('Top status badge displays "A4 Sınırında"', initialStatusText.includes('A4 Sınırında'), initialStatusText);

      // 2. Measure layout displacement: Floating indicator produces EXACTLY 0px displacement vs legacy banner
      const displacementTest = await session.eval(`(() => {
        const page = document.querySelectorAll('.a4-page')[0]; // Page 1
        const header = page.querySelector('.cover-masthead') || page.firstElementChild;
        const topBefore = header.getBoundingClientRect().top;

        // 1. Append floating indicator
        const indicator = document.createElement('div');
        indicator.className = 'page-overflow-indicator no-print';
        indicator.innerHTML = '<span>⚠️</span> <span>A4 Taşması Testi</span>';
        page.appendChild(indicator);

        const topWithIndicator = header.getBoundingClientRect().top;
        const shiftFloating = Math.abs(topWithIndicator - topBefore);

        // 2. Prepend legacy warning banner (old behavior)
        const legacyBanner = document.createElement('div');
        legacyBanner.className = 'overflow-warning-banner';
        legacyBanner.style.height = '36px';
        page.prepend(legacyBanner);

        const topWithBanner = header.getBoundingClientRect().top;
        const shiftLegacy = Math.abs(topWithBanner - topWithIndicator);

        // Clean up
        indicator.remove();
        legacyBanner.remove();

        return {
          shiftFloating,
          shiftLegacy
        };
      })()`);

      assert('Floating warning indicator produces EXACTLY 0px layout displacement on magazine content', displacementTest?.shiftFloating === 0, `Displacement: ${displacementTest?.shiftFloating}px`);
      assert('Legacy banner produces non-zero layout displacement (>25px)', displacementTest?.shiftLegacy >= 25, `Displacement: ${displacementTest?.shiftLegacy}px`);

      // 3. Adversarial Stress-Test on checkA4PageOverflow():
      // Inject extra content into #inp-president-body so content inside .page-inner exceeds 297mm
      const overflowStress = await session.eval(`(() => {
        document.querySelector('.tab-btn[data-tab="tab-president"]').click();
        const textarea = document.getElementById('inp-president-body');
        const orig = textarea.value;
        const overflowParagraphs = '\\n\\n' + ('Bu dönemde Rotary çatısı altında kalıcı etki yaratmak üzere başlattığımız sayısız projeyi hep birlikte kararlılıkla sürdürüyoruz. Toplumsal kalkınma, eğitimde eşitlik ve barış ideallerimiz doğrultusunda var gücümüzle çalışmaya devam edeceğiz. '.repeat(35));
        textarea.value = orig + overflowParagraphs;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return orig;
      })()`);

      // Wait 350ms for live debounced render
      await new Promise(r => setTimeout(r, 350));

      const innerOverflowCheck = await session.eval(`(() => {
        const page = document.querySelectorAll('.a4-page')[1]; // Page 2
        const inner = page.querySelector('.page-inner');
        return {
          pageClientHeight: page.clientHeight,
          pageScrollHeight: page.scrollHeight,
          innerClientHeight: inner ? inner.clientHeight : null,
          innerScrollHeight: inner ? inner.scrollHeight : null,
          pageHasOverflowClass: page.classList.contains('page-overflow'),
          hasFloatingIndicator: !!page.querySelector('.page-overflow-indicator')
        };
      })()`);

      assert('Empirical Proof: Magazine content inside .page-inner severely overflows 297mm height budget', innerOverflowCheck.innerScrollHeight > innerOverflowCheck.innerClientHeight + 100, `Inner: ${innerOverflowCheck.innerScrollHeight}px vs ${innerOverflowCheck.innerClientHeight}px (+${innerOverflowCheck.innerScrollHeight - innerOverflowCheck.innerClientHeight}px overflow)`);

      // Adversarial Finding Check: Does checkA4PageOverflow() detect this overflow?
      // Since .page-inner has overflow: hidden, page.scrollHeight remains equal to page.clientHeight (1123px).
      const detectionSucceeded = innerOverflowCheck.pageHasOverflowClass && innerOverflowCheck.hasFloatingIndicator;
      if (!detectionSucceeded) {
        console.warn('  ⚠️ [EMPIRICAL DEFECT DETECTED] checkA4PageOverflow() is blind to .page-inner overflow:');
        console.warn(`     page.scrollHeight (${innerOverflowCheck.pageScrollHeight}px) === page.clientHeight (${innerOverflowCheck.pageClientHeight}px)`);
        console.warn(`     while .page-inner.scrollHeight is ${innerOverflowCheck.innerScrollHeight}px (overflow of +${innerOverflowCheck.innerScrollHeight - innerOverflowCheck.innerClientHeight}px is SILENTLY CLIPPED)!`);
      }
      assert('A4 Overflow Detection: checkA4PageOverflow() must detect content overflow inside .page-inner', detectionSucceeded, `Blind spot: page.scrollHeight is ${innerOverflowCheck.pageScrollHeight}px while .page-inner.scrollHeight is ${innerOverflowCheck.innerScrollHeight}px`);

      // Restore healthy text to #inp-president-body
      await session.eval(`(() => {
        const textarea = document.getElementById('inp-president-body');
        textarea.value = ${JSON.stringify(overflowStress)};
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);

      await new Promise(r => setTimeout(r, 350));

      const cleanRecoveryResult = await session.eval(`(() => {
        const page = document.querySelectorAll('.a4-page')[1];
        return {
          hasOverflowClass: page.classList.contains('page-overflow'),
          hasIndicator: !!page.querySelector('.page-overflow-indicator'),
          badgeText: document.getElementById('overflow-status-badge')?.textContent.trim() || ''
        };
      })()`);

      assert('Page 2 clean recovery: .page-overflow removed', cleanRecoveryResult?.hasOverflowClass === false);
      assert('Page 2 clean recovery: .page-overflow-indicator removed', cleanRecoveryResult?.hasIndicator === false);
      assert('Top status badge in healthy state ("A4 Sınırında")', cleanRecoveryResult?.badgeText.includes('A4 Sınırında'), cleanRecoveryResult?.badgeText);

      // ----------------------------------------------------------------------
      // SUB-TEST 2B: Bulletin Reader Mode & Page Jump Synchronization
      // ----------------------------------------------------------------------
      console.log('\n  [2B] Bulletin Reader Mode & Page Jump Synchronization');

      // 1. Initial State Verification
      const initialModeState = await session.eval(`(() => {
        const bodyHasReader = document.body.classList.contains('mode-reader-active');
        const editorPane = document.getElementById('editor-pane');
        const previewPane = document.getElementById('preview-pane');
        const btnEditor = document.getElementById('btn-mode-editor');
        const btnReader = document.getElementById('btn-mode-reader');
        return {
          bodyHasReader,
          editorDisplay: window.getComputedStyle(editorPane).display,
          previewWidth: previewPane.offsetWidth,
          btnEditorActive: btnEditor.classList.contains('active'),
          btnReaderActive: btnReader.classList.contains('active')
        };
      })()`);

      assert('Initial mode is Editor Mode (body does not have mode-reader-active)', initialModeState?.bodyHasReader === false);
      assert('Editor pane computed display is "flex"', initialModeState?.editorDisplay === 'flex', initialModeState?.editorDisplay);
      assert('Editor mode switcher button has .active class', initialModeState?.btnEditorActive === true);
      assert('Reader mode switcher button does not have .active class', initialModeState?.btnReaderActive === false);

      // 2. Toggle to Reader Mode by clicking #btn-mode-reader
      const enterReaderResult = await session.eval(`(() => {
        document.getElementById('btn-mode-reader').click();
        const editorPane = document.getElementById('editor-pane');
        const previewPane = document.getElementById('preview-pane');
        const workspace = document.querySelector('.studio-workspace');
        return {
          bodyHasReader: document.body.classList.contains('mode-reader-active'),
          workspaceHasReader: workspace.classList.contains('mode-reader-active'),
          editorDisplay: window.getComputedStyle(editorPane).display,
          previewWidth: previewPane.offsetWidth,
          workspaceWidth: workspace.offsetWidth,
          previewBg: window.getComputedStyle(previewPane).backgroundColor,
          btnReaderActive: document.getElementById('btn-mode-reader').classList.contains('active'),
          btnEditorActive: document.getElementById('btn-mode-editor').classList.contains('active')
        };
      })()`);

      assert('Reader Mode activated: body has .mode-reader-active', enterReaderResult?.bodyHasReader === true);
      assert('Reader Mode activated: #editor-pane computed display is "none"', enterReaderResult?.editorDisplay === 'none', enterReaderResult?.editorDisplay);
      assert('Reader Mode activated: #preview-pane expands to 100% of workspace width', Math.abs(enterReaderResult?.previewWidth - enterReaderResult?.workspaceWidth) < 2, `Preview: ${enterReaderResult?.previewWidth}px, Workspace: ${enterReaderResult?.workspaceWidth}px`);
      assert('Reader Mode activated: gallery navy backdrop (#07111E) applied', enterReaderResult?.previewBg === 'rgb(7, 17, 30)', enterReaderResult?.previewBg);
      assert('Reader Mode button is active', enterReaderResult?.btnReaderActive === true);
      assert('Editor Mode button is inactive', enterReaderResult?.btnEditorActive === false);

      // 3. Page Jump Navigation Test
      const totalPages = await session.eval(`document.querySelectorAll('.a4-page').length`);
      assert(`Total rendered pages available for reader navigation (${totalPages} pages)`, totalPages >= 8);

      // Test jumping to Page 4 via dropdown
      const jumpToPage4 = await session.eval(`(() => {
        const select = document.getElementById('reader-page-jump-select');
        select.value = '4';
        select.dispatchEvent(new Event('change'));
        return {
          currentLabel: document.getElementById('reader-page-current').textContent.trim(),
          selectVal: select.value
        };
      })()`);

      assert('Jump dropdown navigated to Page 4: indicator displays "Sayfa 4"', jumpToPage4?.currentLabel === 'Sayfa 4', jumpToPage4?.currentLabel);
      assert('Jump dropdown select value is "4"', jumpToPage4?.selectVal === '4');

      // Wait for smooth scroll settling
      await new Promise(r => setTimeout(r, 700));

      const debugStateBeforeNext = await session.eval(`(() => {
        return {
          label: document.getElementById('reader-page-current').textContent.trim(),
          val: document.getElementById('reader-page-jump-select').value,
          scrollTop: document.getElementById('preview-viewport').scrollTop
        };
      })()`);
      console.log('      DEBUG State before Next click:', debugStateBeforeNext);

      // Test Next Page button
      const nextPageResult = await session.eval(`(() => {
        document.getElementById('btn-next-page').click();
        return {
          currentLabel: document.getElementById('reader-page-current').textContent.trim(),
          selectVal: document.getElementById('reader-page-jump-select').value
        };
      })()`);

      assert('Next Page button clicked: advanced to "Sayfa 5"', nextPageResult?.currentLabel === 'Sayfa 5', nextPageResult?.currentLabel);
      assert('Jump select synced to "5"', nextPageResult?.selectVal === '5');

      await new Promise(r => setTimeout(r, 700));

      // Test Previous Page button
      const prevPageResult = await session.eval(`(() => {
        document.getElementById('btn-prev-page').click();
        return {
          currentLabel: document.getElementById('reader-page-current').textContent.trim(),
          selectVal: document.getElementById('reader-page-jump-select').value
        };
      })()`);

      assert('Previous Page button clicked: returned to "Sayfa 4"', prevPageResult?.currentLabel === 'Sayfa 4', prevPageResult?.currentLabel);

      await new Promise(r => setTimeout(r, 700));

      // Test Jump to Last Page via select change
      const jumpLastResult = await session.eval(`(() => {
        const select = document.getElementById('reader-page-jump-select');
        select.value = '${totalPages}';
        select.dispatchEvent(new Event('change'));
        return {
          currentLabel: document.getElementById('reader-page-current').textContent.trim(),
          selectVal: select.value
        };
      })()`);

      assert(`Jumped to last page (${totalPages}): indicator displays "Sayfa ${totalPages}"`, jumpLastResult?.currentLabel === `Sayfa ${totalPages}`, jumpLastResult?.currentLabel);

      // Wait 500ms for smooth scroll to finish settling at last page
      await new Promise(r => setTimeout(r, 500));

      // Test boundary: Next page at last page does not increment past totalPages
      const lastBoundaryResult = await session.eval(`(() => {
        document.getElementById('btn-next-page').click();
        return document.getElementById('reader-page-current').textContent.trim();
      })()`);
      assert('Next button at last page does not increment past total pages', lastBoundaryResult === `Sayfa ${totalPages}`, lastBoundaryResult);

      // Test Jump to Page 1 and boundary on prev button
      const firstBoundaryResult = await session.eval(`(() => {
        const select = document.getElementById('reader-page-jump-select');
        select.value = '1';
        select.dispatchEvent(new Event('change'));
        return document.getElementById('reader-page-current').textContent.trim();
      })()`);
      assert('Jump to Page 1: indicator is Sayfa 1', firstBoundaryResult === 'Sayfa 1', firstBoundaryResult);

      await new Promise(r => setTimeout(r, 500));

      const firstPrevBoundary = await session.eval(`(() => {
        document.getElementById('btn-prev-page').click();
        return document.getElementById('reader-page-current').textContent.trim();
      })()`);
      assert('Prev button at page 1 does not decrement below Sayfa 1', firstPrevBoundary === 'Sayfa 1', firstPrevBoundary);

      // 4. Toggle back to Editor Mode
      const returnEditorResult = await session.eval(`(() => {
        document.getElementById('btn-mode-editor').click();
        const editorPane = document.getElementById('editor-pane');
        return {
          bodyHasReader: document.body.classList.contains('mode-reader-active'),
          editorDisplay: window.getComputedStyle(editorPane).display,
          btnEditorActive: document.getElementById('btn-mode-editor').classList.contains('active')
        };
      })()`);

      assert('Returned to Editor Mode: body has no .mode-reader-active', returnEditorResult?.bodyHasReader === false);
      assert('Editor pane computed display restored to "flex"', returnEditorResult?.editorDisplay === 'flex', returnEditorResult?.editorDisplay);
      assert('Editor Mode button active again', returnEditorResult?.btnEditorActive === true);

      // ----------------------------------------------------------------------
      // SUB-TEST 2C: Mobile & Tablet Responsive Layout
      // ----------------------------------------------------------------------
      console.log('\n  [2C] Mobile & Tablet Responsive Layout Verification');

      // Set tablet viewport: 850px width x 900px height
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 850,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });

      const tabletResult = await session.eval(`(() => {
        const editorPane = document.getElementById('editor-pane');
        const previewPane = document.getElementById('preview-pane');
        const subtitle = document.querySelector('.studio-app-subtitle');
        const zoomSlider = document.querySelector('.zoom-slider-container');

        // Check Editor mode on Tablet (<900px)
        const editorDisplay = window.getComputedStyle(editorPane).display;
        const previewDisplay = window.getComputedStyle(previewPane).display;
        const editorWidth = editorPane.offsetWidth;
        const subtitleDisplay = window.getComputedStyle(subtitle).display;
        const sliderDisplay = window.getComputedStyle(zoomSlider).display;

        // Switch to Reader mode on Tablet
        document.getElementById('btn-mode-reader').click();
        const readerEditorDisplay = window.getComputedStyle(editorPane).display;
        const readerPreviewDisplay = window.getComputedStyle(previewPane).display;
        const readerPreviewWidth = previewPane.offsetWidth;

        // Restore to editor
        document.getElementById('btn-mode-editor').click();

        return {
          editorDisplay,
          previewDisplay,
          editorWidth,
          subtitleDisplay,
          sliderDisplay,
          readerEditorDisplay,
          readerPreviewDisplay,
          readerPreviewWidth
        };
      })()`);

      assert('Tablet (<900px) in Editor Mode: editor-pane is display: flex and full width (850px)', tabletResult?.editorDisplay === 'flex' && tabletResult?.editorWidth === 850, `Display: ${tabletResult?.editorDisplay}, Width: ${tabletResult?.editorWidth}px`);
      assert('Tablet (<900px) in Editor Mode: preview-pane is hidden (display: none)', tabletResult?.previewDisplay === 'none', tabletResult?.previewDisplay);
      assert('Tablet (<900px): header subtitle hidden to conserve horizontal budget', tabletResult?.subtitleDisplay === 'none', tabletResult?.subtitleDisplay);
      assert('Tablet (<900px): zoom slider hidden to avoid crowding', tabletResult?.sliderDisplay === 'none', tabletResult?.sliderDisplay);
      assert('Tablet (<900px) in Reader Mode: editor-pane hidden (display: none)', tabletResult?.readerEditorDisplay === 'none', tabletResult?.readerEditorDisplay);
      assert('Tablet (<900px) in Reader Mode: preview-pane is display: flex and full width (850px)', tabletResult?.readerPreviewDisplay === 'flex' && tabletResult?.readerPreviewWidth === 850, `Display: ${tabletResult?.readerPreviewDisplay}, Width: ${tabletResult?.readerPreviewWidth}px`);

      // Set mobile phone viewport: 500px width x 800px height
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 500,
        height: 800,
        deviceScaleFactor: 2,
        mobile: true
      });

      const mobileResult = await session.eval(`(() => {
        const inp = document.querySelector('.form-input');
        const fontSize = window.getComputedStyle(inp).fontSize;
        const badge = document.querySelector('.studio-app-badge');
        const badgeDisplay = window.getComputedStyle(badge).display;
        const bentoSwitcher = document.querySelector('.bento-switcher');
        const bentoWrap = window.getComputedStyle(bentoSwitcher).flexWrap;
        const btnSaveSpan = document.querySelector('#btn-save span:not(:first-child)');
        const btnSaveSpanDisplay = window.getComputedStyle(btnSaveSpan).display;
        return {
          fontSize,
          badgeDisplay,
          bentoWrap,
          btnSaveSpanDisplay
        };
      })()`);

      assert('Mobile (<640px): form inputs use 16px font-size (prevents iOS Safari auto-zoom)', mobileResult?.fontSize === '16px', mobileResult?.fontSize);
      assert('Mobile (<640px): corporate app badge hidden to conserve header space', mobileResult?.badgeDisplay === 'none', mobileResult?.badgeDisplay);
      assert('Mobile (<640px): Bento switcher buttons wrap (flex-wrap: wrap)', mobileResult?.bentoWrap === 'wrap', mobileResult?.bentoWrap);
      assert('Mobile (<640px): header action button labels hidden (emoji-only mode)', mobileResult?.btnSaveSpanDisplay === 'none', mobileResult?.btnSaveSpanDisplay);

      // Restore desktop viewport
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });

      // ----------------------------------------------------------------------
      // SUB-TEST 2D: Non-Destructive Article Management
      // ----------------------------------------------------------------------
      console.log('\n  [2D] Non-Destructive Article Management & DOM Continuity');

      // Navigate to Articles Tab in editor
      await session.eval(`document.querySelector('.tab-btn[data-tab="tab-articles"]').click()`);

      // 1. Tag card 0 and card 1 with empirical sentinel properties
      const taggingResult = await session.eval(`(() => {
        const card0 = document.querySelector('.article-card-item[data-index="0"]');
        const card1 = document.querySelector('.article-card-item[data-index="1"]');
        if (!card0 || !card1) return null;
        card0.__challenger_marker = 'card0_sentinel';
        card1.__challenger_marker = 'card1_sentinel';
        return {
          tagged: true,
          initialPhotosCount0: card0.querySelectorAll('.photo-item-row').length
        };
      })()`);
      assert('Initial article cards found and tagged with DOM sentinel properties', taggingResult?.tagged === true);

      // 2. Add photo to Article 0 via non-destructive add photo button click
      const addPhotoResult = await session.eval(`(() => {
        const card0Before = document.querySelector('.article-card-item[data-index="0"]');
        const card1Before = document.querySelector('.article-card-item[data-index="1"]');

        const addBtn = card0Before.querySelector('[data-action="add-photo"]');
        addBtn.click();

        const card0After = document.querySelector('.article-card-item[data-index="0"]');
        const card1After = document.querySelector('.article-card-item[data-index="1"]');
        const activeEl = document.activeElement;

        return {
          card0IdentityPreserved: card0Before === card0After,
          card1IdentityPreserved: card1Before === card1After,
          card0Sentinel: card0After.__challenger_marker,
          card1Sentinel: card1After.__challenger_marker,
          newPhotosCount: card0After.querySelectorAll('.photo-item-row').length,
          urlInputFocused: activeEl?.classList.contains('photo-url-input')
        };
      })()`);

      assert('addPhoto: Card 0 DOM identity is strictly preserved in memory (0 innerHTML wiping)', addPhotoResult?.card0IdentityPreserved === true);
      assert('addPhoto: Card 1 DOM identity is strictly preserved in memory', addPhotoResult?.card1IdentityPreserved === true);
      assert('addPhoto: Card 0 sentinel property survives intact', addPhotoResult?.card0Sentinel === 'card0_sentinel');
      assert('addPhoto: Card 1 sentinel property survives intact', addPhotoResult?.card1Sentinel === 'card1_sentinel');
      assert('addPhoto: Photo row appended to card 0 list', addPhotoResult?.newPhotosCount === taggingResult.initialPhotosCount0 + 1);
      assert('addPhoto: New photo URL input receives active keyboard focus', addPhotoResult?.urlInputFocused === true);

      // 3. Dynamic Bento Switcher In-Place Modification
      const bentoResult = await session.eval(`(() => {
        const card0Before = document.querySelector('.article-card-item[data-index="0"]');
        const btnBento3 = card0Before.querySelector('.bento-option-btn[data-layout="bento-3"]');
        btnBento3.click();

        const card0After = document.querySelector('.article-card-item[data-index="0"]');
        const badge = card0After.querySelector('.article-bento-badge');

        return {
          card0IdentityPreserved: card0Before === card0After,
          badgeText: badge?.textContent.trim(),
          bento3Active: btnBento3.classList.contains('active')
        };
      })()`);

      assert('Bento switcher: Card 0 DOM identity is preserved (no container re-rendering)', bentoResult?.card0IdentityPreserved === true);
      assert('Bento switcher: Card header badge updated in-place to "bento-3"', bentoResult?.badgeText === 'bento-3', bentoResult?.badgeText);
      assert('Bento switcher: bento-3 button has .active class', bentoResult?.bento3Active === true);

      // 4. Delete photo non-destructively
      const deletePhotoResult = await session.eval(`(() => {
        const card0Before = document.querySelector('.article-card-item[data-index="0"]');
        const deleteBtn = card0Before.querySelector('.photo-item-row:last-child [data-action="delete-photo"]');
        deleteBtn.click();

        const card0After = document.querySelector('.article-card-item[data-index="0"]');
        return {
          card0IdentityPreserved: card0Before === card0After,
          card0Sentinel: card0After.__challenger_marker,
          photosCount: card0After.querySelectorAll('.photo-item-row').length
        };
      })()`);

      assert('deletePhoto: Card 0 DOM identity preserved in memory', deletePhotoResult?.card0IdentityPreserved === true);
      assert('deletePhoto: Card 0 sentinel survived', deletePhotoResult?.card0Sentinel === 'card0_sentinel');
      assert('deletePhoto: Photo row count decremented back to original', deletePhotoResult?.photosCount === taggingResult.initialPhotosCount0);

      // 5. Add new article card non-destructively via #btn-add-article
      const addArticleResult = await session.eval(`(() => {
        const card0Before = document.querySelector('.article-card-item[data-index="0"]');
        const initialArticlesCount = document.querySelectorAll('.article-card-item').length;

        document.getElementById('btn-add-article').click();

        const card0After = document.querySelector('.article-card-item[data-index="0"]');
        const newArticlesCount = document.querySelectorAll('.article-card-item').length;
        const lastCard = document.querySelector('.article-card-item:last-child');
        const activeEl = document.activeElement;

        return {
          card0IdentityPreserved: card0Before === card0After,
          card0Sentinel: card0After.__challenger_marker,
          countIncremented: newArticlesCount === initialArticlesCount + 1,
          newCardIndex: lastCard.dataset.index,
          titleFocused: activeEl?.dataset.field === 'title'
        };
      })()`);

      assert('addNewArticle: Existing card 0 DOM identity is strictly preserved', addArticleResult?.card0IdentityPreserved === true);
      assert('addNewArticle: Card 0 sentinel intact', addArticleResult?.card0Sentinel === 'card0_sentinel');
      assert('addNewArticle: Card count incremented by 1', addArticleResult?.countIncremented === true);
      assert('addNewArticle: New card title input automatically focused', addArticleResult?.titleFocused === true);

      // 6. Accordion toggle preservation
      const accordionResult = await session.eval(`(() => {
        const card0 = document.querySelector('.article-card-item[data-index="0"]');
        const header = card0.querySelector('.article-card-header');
        header.click(); // collapse
        const isCollapsed1 = card0.classList.contains('is-collapsed');
        const chevron1 = card0.querySelector('.card-chevron').textContent;

        header.click(); // expand
        const isCollapsed2 = card0.classList.contains('is-collapsed');
        const chevron2 = card0.querySelector('.card-chevron').textContent;

        return {
          collapsedStep1: isCollapsed1 && chevron1 === '►',
          expandedStep2: !isCollapsed2 && chevron2 === '▼',
          sentinel: card0.__challenger_marker
        };
      })()`);

      assert('Accordion: Collapsing toggles .is-collapsed class and chevron "►"', accordionResult?.collapsedStep1 === true);
      assert('Accordion: Expanding removes .is-collapsed class and restores chevron "▼"', accordionResult?.expandedStep2 === true);
      assert('Accordion: Card DOM sentinel intact across toggles', accordionResult?.sentinel === 'card0_sentinel');

      // 7. Live Title Sync to Card Header
      const titleSyncResult = await session.eval(`(() => {
        const card0 = document.querySelector('.article-card-item[data-index="0"]');
        const titleInput = card0.querySelector('.art-field[data-field="title"]');
        titleInput.value = 'Rotary Barış Konferansı 2026';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));

        const previewSpan = card0.querySelector('.article-title-preview');
        return {
          previewText: previewSpan.textContent.trim()
        };
      })()`);

      assert('Live Title Sync: Card header preview synchronizes instantaneously', titleSyncResult?.previewText === 'Rotary Barış Konferansı 2026', titleSyncResult?.previewText);
    }
  } finally {
    if (session) session.close();
    if (chromeProc.exitCode === null) {
      chromeProc.kill();
      await Promise.race([
        new Promise(r => chromeProc.once('close', r)),
        new Promise(r => setTimeout(r, 1500))
      ]);
    }
    server.close();
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
    } catch {}
  }

  console.log('\n========================================================================');
  console.log('  CHALLENGER M1-2 EMPIRICAL SUMMARY');
  console.log('========================================================================');
  console.log(`  Passed Assertions : ${passed}`);
  console.log(`  Failed Assertions : ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    console.error(`VERDICT: REQUEST_CHANGES (${failed} assertion(s) failed)`);
    process.exit(1);
  } else {
    console.log('VERDICT: APPROVE (All empirical challenger assertions verified with 100% compliance)');
    process.exit(0);
  }
}

runEmpiricalChallengeSuite().catch(err => {
  console.error('Fatal execution error in challenger suite:', err);
  process.exit(1);
});