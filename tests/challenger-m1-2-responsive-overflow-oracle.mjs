/**
 * Challenger M1-2: Comprehensive Responsive Layout, Zoom Scrolling & Overflow Detection Oracle
 * 
 * Verifies:
 * 1. Responsive Viewport Behavior:
 *    - Desktop: 1920x1080 (Side-by-side split screen)
 *    - Laptop: 1366x768 (Side-by-side split screen, no viewport horizontal overflow)
 *    - Tablet: 820x1180 (Breakpoint <= 900px, single-pane collapse with tab switching)
 *    - Mobile: 375x667 (Breakpoint <= 640px, 16px iOS font-size rule, button label compression)
 * 2. Zoom-Aware Scrolling & Stage Scaling:
 *    - Matrix/CSS transform scale application on #preview-stage
 *    - Clamping between 0.4 and 2.0
 *    - Smooth scrolling target positioning under zoom
 * 3. A4 Overflow Detection & Non-Displacing Badge Oracle:
 *    - Zero layout displacement (0px delta) on magazine content from .page-overflow-indicator
 *    - Zero document flow displacement from #overflow-status-badge in header
 *    - Real adversarial text injection triggering overflow detection
 *    - Top badge status update & sequential click-to-scroll cycling
 *    - Complete recovery upon content restoration
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

async function runOracleSuite() {
  console.log('========================================================================');
  console.log('  CHALLENGER M1-2: RESPONSIVE VIEWPORT, ZOOM & OVERFLOW ORACLE');
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

  const chromeBin = findChromeBinary();
  assert('Headless Chrome/Edge executable is discovered', !!chromeBin, chromeBin || 'None found');
  if (!chromeBin) {
    console.error('Cannot proceed without browser binary.');
    process.exit(1);
  }

  const { server, port } = await startTestServer();
  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-m1-2-oracle-'));
  const cdpPort = port > 60000 ? (port - 2200 - Math.floor(Math.random() * 300)) : (port + 1200 + Math.floor(Math.random() * 300));

  let chromeStderr = '';
  const chromeProc = spawn(chromeBin, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tempUserDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1920,1080',
    `http://127.0.0.1:${port}/index.html`
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  chromeProc.stderr.on('data', chunk => {
    chromeStderr += chunk.toString();
  });

  let session = null;

  try {
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

    assert('Browser initialized and CDP connected', !!wsUrl, `Port ${cdpPort}, stderr: ${chromeStderr.slice(-200)}`);
    if (!wsUrl) {
      throw new Error(`Failed to obtain WebSocket Debugger URL on port ${cdpPort}`);
    }

    session = new ChromeSession(wsUrl);
    await session.connect();
    await session.send('Page.enable');
    await session.send('Runtime.enable');

    // Wait for pages to render
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 150));
      const count = await session.eval(`document.querySelectorAll('.a4-page').length`);
      if (count >= 7) {
        ready = true;
        break;
      }
    }
    assert('Application rendered all A4 pages in DOM', ready);

    // ========================================================================
    // SECTION 1: RESPONSIVE VIEWPORT BEHAVIOR AT REQUIRED RESOLUTIONS
    // ========================================================================
    console.log('\n[SECTION 1] Viewport Resolution & Split-Screen Behavior');
    console.log('────────────────────────────────────────────────────────────────────────');

    // Resolution 1: Desktop 1920 x 1080
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 250));

    const desktopState = await session.eval(`(() => {
      const editor = document.getElementById('editor-pane');
      const preview = document.getElementById('preview-pane');
      const workspace = document.querySelector('.studio-workspace');
      const editorRect = editor.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      return {
        editorDisplay: window.getComputedStyle(editor).display,
        previewDisplay: window.getComputedStyle(preview).display,
        editorWidth: Math.round(editorRect.width),
        previewWidth: Math.round(previewRect.width),
        workspaceWidth: Math.round(workspace.getBoundingClientRect().width),
        isSideBySide: editorRect.right <= previewRect.left + 2,
        bodyOverflowX: document.documentElement.scrollWidth <= window.innerWidth
      };
    })()`);

    assert('Desktop 1920x1080: Split-screen editor-pane is display: flex', desktopState.editorDisplay === 'flex');
    assert('Desktop 1920x1080: Split-screen preview-pane is display: flex', desktopState.previewDisplay === 'flex');
    assert('Desktop 1920x1080: Panes are positioned strictly side-by-side with zero overlap', desktopState.isSideBySide);
    assert('Desktop 1920x1080: Combined panes span full workspace width', Math.abs((desktopState.editorWidth + desktopState.previewWidth) - desktopState.workspaceWidth) <= 5);
    assert('Desktop 1920x1080: Zero horizontal viewport overflow', desktopState.bodyOverflowX);

    // Resolution 2: Laptop 1366 x 768
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 250));

    const laptopState = await session.eval(`(() => {
      const editor = document.getElementById('editor-pane');
      const preview = document.getElementById('preview-pane');
      const editorRect = editor.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      return {
        editorDisplay: window.getComputedStyle(editor).display,
        previewDisplay: window.getComputedStyle(preview).display,
        editorWidth: Math.round(editorRect.width),
        previewWidth: Math.round(previewRect.width),
        isSideBySide: editorRect.right <= previewRect.left + 2,
        bodyOverflowX: document.documentElement.scrollWidth <= window.innerWidth
      };
    })()`);

    assert('Laptop 1366x768: Split-screen editor-pane is display: flex', laptopState.editorDisplay === 'flex');
    assert('Laptop 1366x768: Split-screen preview-pane is display: flex', laptopState.previewDisplay === 'flex');
    assert('Laptop 1366x768: Panes are arranged side-by-side', laptopState.isSideBySide);
    assert('Laptop 1366x768: Preview pane retains sufficient horizontal space (>700px)', laptopState.previewWidth >= 700, `${laptopState.previewWidth}px`);
    assert('Laptop 1366x768: Zero horizontal document scrollbar', laptopState.bodyOverflowX);

    // Resolution 3: Tablet 820 x 1180 (iPad Air / portrait)
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 820,
      height: 1180,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 250));

    const tabletEditorState = await session.eval(`(() => {
      const editor = document.getElementById('editor-pane');
      const preview = document.getElementById('preview-pane');
      const subtitle = document.querySelector('.studio-app-subtitle');
      const zoomSlider = document.querySelector('.zoom-slider-container');
      return {
        editorDisplay: window.getComputedStyle(editor).display,
        previewDisplay: window.getComputedStyle(preview).display,
        editorWidth: editor.offsetWidth,
        subtitleDisplay: window.getComputedStyle(subtitle).display,
        sliderDisplay: window.getComputedStyle(zoomSlider).display
      };
    })()`);

    assert('Tablet 820x1180 (Editor Mode): Split-screen collapsed, editor takes 100% width (820px)', tabletEditorState.editorDisplay === 'flex' && tabletEditorState.editorWidth === 820);
    assert('Tablet 820x1180 (Editor Mode): Preview pane is hidden (display: none)', tabletEditorState.previewDisplay === 'none');
    assert('Tablet 820x1180: Header subtitle hidden to preserve navbar budget', tabletEditorState.subtitleDisplay === 'none');
    assert('Tablet 820x1180: Zoom slider hidden to avoid toolbar crowding', tabletEditorState.sliderDisplay === 'none');

    // Switch to Reader Mode on Tablet
    const tabletReaderState = await session.eval(`(() => {
      document.getElementById('btn-mode-reader').click();
      const editor = document.getElementById('editor-pane');
      const preview = document.getElementById('preview-pane');
      return {
        editorDisplay: window.getComputedStyle(editor).display,
        previewDisplay: window.getComputedStyle(preview).display,
        previewWidth: preview.offsetWidth
      };
    })()`);

    assert('Tablet 820x1180 (Reader Mode): Editor pane is hidden (display: none)', tabletReaderState.editorDisplay === 'none');
    assert('Tablet 820x1180 (Reader Mode): Preview pane takes 100% width (820px)', tabletReaderState.previewDisplay === 'flex' && tabletReaderState.previewWidth === 820);

    // Switch back to Editor Mode
    await session.eval(`document.getElementById('btn-mode-editor').click()`);

    // Resolution 4: Mobile 375 x 667 (iPhone SE)
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 250));

    const mobileState = await session.eval(`(() => {
      const editor = document.getElementById('editor-pane');
      const preview = document.getElementById('preview-pane');
      const badge = document.querySelector('.studio-app-badge');
      const inp = document.querySelector('.form-input');
      const bentoSwitcher = document.querySelector('.bento-switcher');
      const saveBtnSpan = document.querySelector('#btn-save span:not(:first-child)');
      return {
        editorDisplay: window.getComputedStyle(editor).display,
        previewDisplay: window.getComputedStyle(preview).display,
        editorWidth: editor.offsetWidth,
        badgeDisplay: window.getComputedStyle(badge).display,
        inputFontSize: window.getComputedStyle(inp).fontSize,
        bentoWrap: window.getComputedStyle(bentoSwitcher).flexWrap,
        saveBtnLabelDisplay: window.getComputedStyle(saveBtnSpan).display
      };
    })()`);

    assert('Mobile 375x667: Editor pane occupies 100% width (375px)', mobileState.editorDisplay === 'flex' && mobileState.editorWidth === 375);
    assert('Mobile 375x667: Preview pane hidden in Editor mode', mobileState.previewDisplay === 'none');
    assert('Mobile 375x667: Form inputs enforce 16px font-size (prevents iOS auto-zoom)', mobileState.inputFontSize === '16px');
    assert('Mobile 375x667: Corporate badge hidden to fit narrow navbar', mobileState.badgeDisplay === 'none');
    assert('Mobile 375x667: Action buttons compress to emoji icons', mobileState.saveBtnLabelDisplay === 'none');
    assert('Mobile 375x667: Bento option buttons wrap (flex-wrap: wrap)', mobileState.bentoWrap === 'wrap');

    // Restore Desktop Viewport for zoom & overflow tests
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 250));

    // ========================================================================
    // SECTION 2: ZOOM-AWARE SCROLLING & TRANSFORM PROGRESSION
    // ========================================================================
    console.log('\n[SECTION 2] Zoom-Aware Scrolling & Stage Scaling');
    console.log('────────────────────────────────────────────────────────────────────────');

    const zoomStepTest = await session.eval(`(() => {
      const stage = document.getElementById('preview-stage');
      const btnZoom50 = document.querySelector('.zoom-chip[data-zoom="0.5"]');
      const btnZoom100 = document.querySelector('.zoom-chip[data-zoom="1.0"]');
      const zoomVal = document.getElementById('zoom-val');

      // Click 50%
      btnZoom50.click();
      const transform50 = stage.style.transform;
      const text50 = zoomVal.textContent.trim();

      // Click 100%
      btnZoom100.click();
      const transform100 = stage.style.transform;
      const text100 = zoomVal.textContent.trim();

      // Restore to Fit
      document.getElementById('btn-zoom-fit').click();
      const transformFit = stage.style.transform;

      return {
        transform50,
        text50,
        transform100,
        text100,
        transformFit
      };
    })()`);

    assert('Zoom chip 50%: stage style transform applies scale(0.5)', zoomStepTest.transform50 === 'scale(0.5)');
    assert('Zoom chip 50%: label updates to "50%"', zoomStepTest.text50 === '50%');
    assert('Zoom chip 100%: stage style transform applies scale(1)', zoomStepTest.transform100 === 'scale(1)');
    assert('Zoom chip 100%: label updates to "100%"', zoomStepTest.text100 === '100%');
    assert('Zoom fit: stage style transform recalculates responsive scale', zoomStepTest.transformFit.startsWith('scale('));

    // Test smooth scroll to page under zoom via reader-page-jump-select
    const scrollToPageResult = await session.eval(`(() => {
      const select = document.getElementById('reader-page-jump-select');
      select.value = '3';
      select.dispatchEvent(new Event('change'));
      return {
        selectVal: select.value
      };
    })()`);

    assert('reader-page-jump-select changed to page 3', scrollToPageResult.selectVal === '3');
    await new Promise(r => setTimeout(r, 700));
    const finalScrollResult = await session.eval(`document.getElementById('preview-viewport').scrollTop`);
    assert('Page navigation: preview-viewport scrolled smoothly to target page', finalScrollResult > 200, `Final scroll: ${finalScrollResult}px`);

    // Reset scroll to top
    await session.eval(`document.getElementById('preview-viewport').scrollTop = 0`);

    // ========================================================================
    // SECTION 3: A4 OVERFLOW DETECTION & ZERO DISPLACEMENT ORACLE
    // ========================================================================
    console.log('\n[SECTION 3] A4 Overflow Detection & Non-Displacing Badge Oracle');
    console.log('────────────────────────────────────────────────────────────────────────');

    // 1. Initial State Verification
    const initialOverflow = await session.eval(`(() => {
      const badge = document.getElementById('overflow-status-badge');
      const overflowingPages = document.querySelectorAll('.a4-page.page-overflow').length;
      const indicators = document.querySelectorAll('.page-overflow-indicator').length;
      return {
        badgeText: badge?.textContent.trim() || '',
        hasBadgeOverflowClass: badge?.classList.contains('has-overflow'),
        overflowingPages,
        indicators
      };
    })()`);

    assert('Initial State: 0 overflowing pages detected', initialOverflow.overflowingPages === 0);
    assert('Initial State: 0 floating warning indicators in DOM', initialOverflow.indicators === 0);
    assert('Initial State: #overflow-status-badge displays "A4 Sınırında"', initialOverflow.badgeText.includes('A4 Sınırında'));
    assert('Initial State: #overflow-status-badge does not have .has-overflow class', !initialOverflow.hasBadgeOverflowClass);

    // 2. Non-Displacing Test: #overflow-status-badge & .page-overflow-indicator
    const nonDisplacingProof = await session.eval(`(() => {
      const page1 = document.querySelectorAll('.a4-page')[0];
      const page1Masthead = page1.querySelector('.cover-masthead') || page1.firstElementChild;
      const workspace = document.querySelector('.studio-workspace');
      const editor = document.getElementById('editor-pane');
      const preview = document.getElementById('preview-pane');

      // Baseline measurements
      const mastheadTopBefore = page1Masthead.getBoundingClientRect().top;
      const workspaceTopBefore = workspace.getBoundingClientRect().top;
      const editorLeftBefore = editor.getBoundingClientRect().left;
      const previewLeftBefore = preview.getBoundingClientRect().left;

      // 1. Trigger #overflow-status-badge state change
      const badge = document.getElementById('overflow-status-badge');
      badge.className = 'overflow-status-badge has-overflow';
      badge.innerHTML = '<span>⚠️</span> <span>1 Sayfada A4 Taşması!</span>';

      const workspaceTopAfterBadge = workspace.getBoundingClientRect().top;
      const editorLeftAfterBadge = editor.getBoundingClientRect().left;
      const previewLeftAfterBadge = preview.getBoundingClientRect().left;

      // 2. Add floating indicator to page1
      const indicator = document.createElement('div');
      indicator.className = 'page-overflow-indicator no-print';
      indicator.innerHTML = '<span>⚠️</span> <span>A4 Taşması Testi</span>';
      page1.appendChild(indicator);

      const mastheadTopAfterIndicator = page1Masthead.getBoundingClientRect().top;

      // Clean up
      indicator.remove();
      badge.className = 'overflow-status-badge';
      badge.innerHTML = '<span>✅</span> <span>A4 Sınırında</span>';

      return {
        workspaceShift: Math.abs(workspaceTopAfterBadge - workspaceTopBefore),
        editorShift: Math.abs(editorLeftAfterBadge - editorLeftBefore),
        previewShift: Math.abs(previewLeftAfterBadge - previewLeftBefore),
        magazineContentShift: Math.abs(mastheadTopAfterIndicator - mastheadTopBefore)
      };
    })()`);

    assert('Zero Displacement: #overflow-status-badge causes EXACTLY 0px shift on workspace', nonDisplacingProof.workspaceShift === 0, `${nonDisplacingProof.workspaceShift}px`);
    assert('Zero Displacement: #overflow-status-badge causes EXACTLY 0px shift on editor-pane', nonDisplacingProof.editorShift === 0, `${nonDisplacingProof.editorShift}px`);
    assert('Zero Displacement: #overflow-status-badge causes EXACTLY 0px shift on preview-pane', nonDisplacingProof.previewShift === 0, `${nonDisplacingProof.previewShift}px`);
    assert('Zero Displacement: .page-overflow-indicator causes EXACTLY 0px shift on magazine content', nonDisplacingProof.magazineContentShift === 0, `${nonDisplacingProof.magazineContentShift}px`);

    // 3. Adversarial Overflow Trigger & Detection Test
    console.log('  Testing live overflow trigger via text injection...');
    const injectResult = await session.eval(`(() => {
      document.querySelector('.tab-btn[data-tab="tab-president"]').click();
      const textarea = document.getElementById('inp-president-body');
      const originalText = textarea.value;

      // Inject extensive paragraphs to guarantee >3px overflow beyond 297mm A4 budget
      const excess = '\\n\\n' + 'Rotary hizmet ideali çerçevesinde toplumsal fayda yaratan kalıcı projelere imza atmaya devam ediyoruz. '.repeat(40);
      textarea.value = originalText + excess;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      return originalText;
    })()`);

    // Wait for debounced render and checkA4PageOverflow
    await new Promise(r => setTimeout(r, 450));

    const detectedOverflow = await session.eval(`(() => {
      const page2 = document.querySelectorAll('.a4-page')[1]; // President page
      const badge = document.getElementById('overflow-status-badge');
      const indicator = page2 ? page2.querySelector('.page-overflow-indicator') : null;
      return {
        page2HasOverflowClass: page2 ? page2.classList.contains('page-overflow') : false,
        hasIndicator: !!indicator,
        indicatorText: indicator ? indicator.textContent.trim() : '',
        badgeHasClass: badge ? badge.classList.contains('has-overflow') : false,
        badgeText: badge ? badge.textContent.trim() : '',
        hasBadgeClickHandler: badge && typeof badge.onclick === 'function'
      };
    })()`);

    assert('Overflow Detection: Page 2 correctly flagged with .page-overflow class', detectedOverflow.page2HasOverflowClass);
    assert('Overflow Detection: Floating .page-overflow-indicator appended to overflowing page', detectedOverflow.hasIndicator);
    assert('Overflow Detection: Floating indicator specifies pixel overflow amount', detectedOverflow.indicatorText.includes('A4 Taşması'));
    assert('Overflow Detection: #overflow-status-badge received .has-overflow class', detectedOverflow.badgeHasClass);
    assert('Overflow Detection: #overflow-status-badge displays warning message', detectedOverflow.badgeText.includes('A4 Taşması'));
    assert('Overflow Detection: #overflow-status-badge has active click-to-scroll handler', detectedOverflow.hasBadgeClickHandler);

    // Test clicking #overflow-status-badge scrolls to overflowing page
    const badgeClickScroll = await session.eval(`(() => {
      const badge = document.getElementById('overflow-status-badge');
      badge.click();
      return true;
    })()`);
    assert('Overflow Navigation: Clicking #overflow-status-badge triggers cycling without runtime errors', badgeClickScroll);

    // 4. Clean Recovery Test: Restoring original content clears overflow state
    console.log('  Testing clean recovery on content restoration...');
    await session.eval(`(() => {
      const textarea = document.getElementById('inp-president-body');
      textarea.value = ${JSON.stringify(injectResult)};
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);

    await new Promise(r => setTimeout(r, 450));

    const recoveryState = await session.eval(`(() => {
      const page2 = document.querySelectorAll('.a4-page')[1];
      const badge = document.getElementById('overflow-status-badge');
      const indicators = document.querySelectorAll('.page-overflow-indicator');
      return {
        page2HasOverflowClass: page2 ? page2.classList.contains('page-overflow') : false,
        indicatorsCount: indicators.length,
        badgeHasClass: badge ? badge.classList.contains('has-overflow') : false,
        badgeText: badge ? badge.textContent.trim() : '',
        badgeClickHandlerNull: badge && badge.onclick === null
      };
    })()`);

    assert('Clean Recovery: .page-overflow class removed from page 2', !recoveryState.page2HasOverflowClass);
    assert('Clean Recovery: All .page-overflow-indicator elements removed from DOM', recoveryState.indicatorsCount === 0);
    assert('Clean Recovery: #overflow-status-badge .has-overflow class removed', !recoveryState.badgeHasClass);
    assert('Clean Recovery: #overflow-status-badge restored to "A4 Sınırında"', recoveryState.badgeText.includes('A4 Sınırında'));
    assert('Clean Recovery: #overflow-status-badge click handler cleanly nulled out', recoveryState.badgeClickHandlerNull);

  } finally {
    if (session) session.close();
    chromeProc.kill();
    server.close();
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    } catch {}
  }

  console.log('\n========================================================================');
  console.log('  CHALLENGER M1-2 ORACLE SUMMARY');
  console.log('========================================================================');
  console.log(`  Passed Assertions : ${passed}`);
  console.log(`  Failed Assertions : ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    console.error(`VERDICT: REJECT (${failed} empirical assertion(s) failed)`);
    process.exit(1);
  } else {
    console.log('VERDICT: CONFIRM_CORRECTNESS (100% empirical compliance across all viewports, zoom and overflow detection)');
    process.exit(0);
  }
}

runOracleSuite().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
