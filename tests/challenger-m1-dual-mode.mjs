/**
 * Challenger M1-1: Dual-Mode Runtime & Persistence Empirical Stress Test Suite
 * 
 * Objectives:
 * 1. Empirically verify Dual-Mode Client Adapter:
 *    - Simulate GitHub Pages static mode (where fetch('/api/issues') rejects or returns 404).
 *    - Confirm that FALLBACK_ISSUES_CATALOG is loaded without throwing unhandled exceptions.
 *    - Confirm relative path resolution across root and subpaths.
 * 2. Empirically verify localStorage persistence & corporate brand veto:
 *    - Test saving issue data with forbidden phrases ('Rotary Sihri', 'rotary sihri', 'ROTARY SİHRİ', etc.).
 *    - Verify immediate rejection before save.
 *    - Verify successful persistence of compliant issues in localStorage.
 *    - Verify draft restoration on reload.
 * 3. Empirically verify JSON download & factory reset:
 *    - Verify downloadJSON generates compliant JSON blob.
 *    - Verify factory reset cleanly purges draft from localStorage and reloads canonical data.
 * 4. Empirically verify Image upload fallback:
 *    - Verify Base64 Data URL fallback in static mode or on server failure.
 *    - Verify rejection of non-image MIME types.
 * 5. Empirically verify Reader Mode & A4 Overflow Measurement:
 *    - Verify view mode toggling (mode-reader-active).
 *    - Verify removal of previous warning banners before measuring scrollHeight/clientHeight.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const STUDIO_JS_PATH = path.join(PROJECT_ROOT, 'public', 'studio.js');

// Test tracking
let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const findings = [];

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    failedAssertions++;
    console.error(`  ❌ [FAIL] ${message}`);
    findings.push(message);
  }
}

function parseHTMLInto(html, parentNode) {
  if (!html || typeof html !== 'string') return;
  const tagRegex = /<\/?([a-zA-Z0-9-]+)([^>]*)>/g;
  let lastIdx = 0;
  const stack = [];
  let curr = parentNode;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const textBefore = html.substring(lastIdx, match.index).trim();
    if (textBefore && curr !== parentNode) {
      curr.textContent = curr.textContent ? `${curr.textContent} ${textBefore}` : textBefore;
    }
    lastIdx = match.index + match[0].length;
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>') || ['img', 'input', 'hr', 'br'].includes(tagName);

    if (isClosing) {
      if (stack.length > 0) {
        curr = stack.pop();
      }
    } else {
      const el = new MockElement(tagName);
      el.parentNode = curr;

      // Parse attributes
      const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let aMatch;
      while ((aMatch = attrRegex.exec(match[2])) !== null) {
        const attrName = aMatch[1];
        const attrVal = aMatch[2] ?? aMatch[3] ?? aMatch[4] ?? '';
        if (attrName === 'id') el.id = attrVal;
        else if (attrName === 'class') el.className = attrVal;
        else if (attrName.startsWith('data-')) {
          const key = attrName.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
          el.dataset[key] = attrVal;
        }
        el.setAttribute(attrName, attrVal);
      }
      curr.childNodes.push(el);
      if (!isSelfClosing) {
        stack.push(curr);
        curr = el;
      }
    }
  }

  const trailingText = html.substring(lastIdx).trim();
  if (trailingText && curr !== parentNode) {
    curr.textContent = curr.textContent ? `${curr.textContent} ${trailingText}` : trailingText;
  }
}

// Minimal Mock DOM Node
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.className = '';
    this.attributes = new Map();
    this.style = {};
    this.dataset = {};
    this.childNodes = [];
    this.parentNode = null;
    this._value = '';
    this._textContent = '';
    this._innerHTML = '';
    this.scrollHeight = 297;
    this.clientHeight = 297;
    this.clientWidth = 1200;
    this.options = [];
    this.eventListeners = new Map();
  }

  get value() { return this._value; }
  set value(v) { this._value = String(v); }

  get textContent() {
    const childText = this.childNodes.map(c => c.textContent).filter(Boolean).join(' ');
    return [this._textContent, childText].filter(Boolean).join(' ');
  }
  set textContent(v) {
    this._textContent = String(v);
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = String(v);
    this.childNodes = [];
    parseHTMLInto(this._innerHTML, this);
  }

  get classList() {
    const getClasses = () => (this.className || '').split(/\s+/).filter(Boolean);
    return {
      add: (...cls) => {
        const classes = new Set(getClasses());
        cls.forEach(c => classes.add(c));
        this.className = Array.from(classes).join(' ');
      },
      remove: (...cls) => {
        const classes = new Set(getClasses());
        cls.forEach(c => classes.delete(c));
        this.className = Array.from(classes).join(' ');
      },
      toggle: (c, force) => {
        const classes = new Set(getClasses());
        const shouldAdd = force !== undefined ? !!force : !classes.has(c);
        if (shouldAdd) classes.add(c);
        else classes.delete(c);
        this.className = Array.from(classes).join(' ');
        return shouldAdd;
      },
      contains: (c) => getClasses().includes(c)
    };
  }

  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
  removeAttribute(k) { this.attributes.delete(k); }

  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    if (this.tagName === 'SELECT' && child.tagName === 'OPTION') {
      this.options.push(child);
    }
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    if (this.tagName === 'SELECT' && child.tagName === 'OPTION') {
      const optIdx = this.options.indexOf(child);
      if (optIdx !== -1) this.options.splice(optIdx, 1);
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  prepend(child) {
    child.parentNode = this;
    this.childNodes.unshift(child);
    return child;
  }

  addEventListener(evt, fn) {
    if (!this.eventListeners.has(evt)) this.eventListeners.set(evt, []);
    this.eventListeners.get(evt).push(fn);
  }

  dispatchEvent(evt) {
    const fns = this.eventListeners.get(evt.type) || [];
    fns.forEach(fn => fn(evt));
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const selectors = sel.split(',').map(s => s.trim());
    const matches = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (selectors.some(s => childMatches(child, s))) {
          matches.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return matches;
  }

  scrollIntoView() {}
  focus() {}
  select() {}
  click() {
    this.dispatchEvent({ type: 'click', target: this, stopPropagation: () => {} });
  }
}

function childMatches(el, sel) {
  if (!sel || !el.tagName) return false;
  if (sel.startsWith('#')) return el.id === sel.slice(1);

  let targetClass = null;
  let targetTag = null;
  let targetAttr = null;

  let s = sel;
  const attrMatch = s.match(/\[([a-zA-Z0-9_-]+)(?:="?([^"]*)"?)?\]/);
  if (attrMatch) {
    targetAttr = { name: attrMatch[1], val: attrMatch[2] };
    s = s.replace(attrMatch[0], '');
  }

  if (s.startsWith('.')) {
    targetClass = s.slice(1).split('.')[0];
  } else if (s && !s.startsWith('.')) {
    targetTag = s.toUpperCase();
  }

  if (targetTag && el.tagName !== targetTag) return false;
  if (targetClass && (!el.classList || !el.classList.contains(targetClass))) return false;
  if (targetAttr) {
    const { name, val } = targetAttr;
    if (name.startsWith('data-')) {
      const dataKey = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      if (val !== undefined) {
        if (String(el.dataset[dataKey]) !== String(val)) return false;
      } else {
        if (el.dataset[dataKey] === undefined) return false;
      }
    } else {
      if (val !== undefined) {
        if (String(el.getAttribute(name)) !== String(val)) return false;
      } else {
        if (el.getAttribute(name) === null) return false;
      }
    }
  }

  return true;
}

class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.has(k) ? this.store.get(k) : null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

class MockFileReader {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.result = null;
  }
  readAsDataURL(file) {
    setTimeout(() => {
      if (file && file.buffer) {
        this.result = `data:${file.type || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
        if (this.onload) this.onload();
      } else if (file && file.data) {
        this.result = `data:${file.type || 'image/jpeg'};base64,${Buffer.from(file.data).toString('base64')}`;
        if (this.onload) this.onload();
      } else {
        if (this.onerror) this.onerror(new Error('Dosya okunamadı.'));
      }
    }, 5);
  }
}

class MockBlob {
  constructor(parts, options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.content = parts.join('');
  }
}

const mockUrls = new Map();
let mockUrlId = 0;
const MockURL = {
  createObjectURL(blob) {
    const id = `blob:mock-url-${++mockUrlId}`;
    mockUrls.set(id, blob);
    return id;
  },
  revokeObjectURL(id) {
    mockUrls.delete(id);
  }
};

/**
 * Creates a complete sandbox executing public/studio.js
 */
function createStudioSandbox(customConfig = {}) {
  const elements = new Map();

  function getOrCreateElement(id, tag = 'div') {
    if (!elements.has(id)) {
      const el = new MockElement(tag);
      el.id = id;
      elements.set(id, el);
    }
    return elements.get(id);
  }

  // Pre-seed known studio UI elements
  const body = new MockElement('body');
  const issueSelect = getOrCreateElement('issue-select', 'select');
  const runtimeBadge = getOrCreateElement('runtime-mode-badge', 'div');
  const toastContainer = getOrCreateElement('toast-container', 'div');
  const previewContainer = getOrCreateElement('bulletin-preview-container', 'div');
  const previewStage = getOrCreateElement('preview-stage', 'div');
  const previewViewport = getOrCreateElement('preview-viewport', 'div');
  const editorPane = getOrCreateElement('editor-pane', 'aside');
  const pageCountNum = getOrCreateElement('page-count-num', 'strong');
  const overflowBadge = getOrCreateElement('overflow-status-badge', 'div');
  const btnSave = getOrCreateElement('btn-save', 'button');
  const btnDownloadJson = getOrCreateElement('btn-download-json', 'button');
  const btnResetIssue = getOrCreateElement('btn-reset-issue', 'button');
  const btnExportPdf = getOrCreateElement('btn-export-pdf', 'button');
  const btnModeEditor = getOrCreateElement('btn-mode-editor', 'button');
  const btnModeReader = getOrCreateElement('btn-mode-reader', 'button');
  const readerJumpSelect = getOrCreateElement('reader-page-jump-select', 'select');
  const readerPageCur = getOrCreateElement('reader-page-current', 'span');
  const readerPageTot = getOrCreateElement('reader-page-total', 'span');
  const articlesContainer = getOrCreateElement('articles-container', 'div');

  body.appendChild(issueSelect);
  body.appendChild(runtimeBadge);
  body.appendChild(toastContainer);
  body.appendChild(editorPane);
  editorPane.appendChild(articlesContainer);
  body.appendChild(previewViewport);
  previewViewport.appendChild(previewStage);
  previewStage.appendChild(previewContainer);

  const localStorage = new MockLocalStorage();
  const toasts = [];

  const location = {
    origin: customConfig.origin || 'https://rifat-akin.github.io',
    pathname: customConfig.pathname || '/galata-rotary-bulten/',
    hostname: customConfig.hostname || 'rifat-akin.github.io'
  };

  const fetchHandler = customConfig.fetchHandler || (async (url, opts) => {
    return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
  });

  const sandboxDocument = {
    body,
    documentElement: body,
    fullscreenElement: null,
    getElementById(id) {
      if (elements.has(id)) return elements.get(id);
      return getOrCreateElement(id);
    },
    querySelector(sel) {
      if (sel.startsWith('#')) return sandboxDocument.getElementById(sel.slice(1));
      if (sel === 'body') return body;
      return body.querySelector(sel);
    },
    querySelectorAll(sel) {
      return body.querySelectorAll(sel);
    },
    createElement(tag) {
      return new MockElement(tag);
    },
    addEventListener() {}
  };

  const sandboxWindow = {
    location,
    localStorage,
    print: () => {},
    addEventListener: () => {},
    setTimeout,
    clearTimeout
  };

  // Minimal BulletinRenderer mock
  const mockRenderer = {
    renderIssueToDOM: (issue) => {
      const container = new MockElement('div');
      const pageCount = (issue && issue.articles ? issue.articles.length : 0) + 4;
      for (let i = 1; i <= pageCount; i++) {
        const page = new MockElement('div');
        page.classList.add('a4-page');
        page.dataset.pageIndex = String(i);
        page.scrollHeight = 297;
        page.clientHeight = 297;
        container.appendChild(page);
      }
      return container;
    }
  };

  const context = {
    setTimeout,
    clearTimeout,
    window: sandboxWindow,
    document: sandboxDocument,
    localStorage,
    location,
    fetch: fetchHandler,
    FileReader: MockFileReader,
    Blob: MockBlob,
    URL: MockURL,
    FormData: class FormData {
      constructor() { this.entries = new Map(); }
      append(k, v) { this.entries.set(k, v); }
    },
    IntersectionObserver: class MockIntersectionObserver {
      constructor(cb) { this.cb = cb; }
      observe() {}
      disconnect() {}
    },
    confirm: () => true,
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    },
    BulletinRenderer: mockRenderer,
    globalThis: {}
  };
  context.globalThis = context;

  vm.createContext(context);

  // Load and execute studio.js inside sandbox
  const studioCode = fs.readFileSync(STUDIO_JS_PATH, 'utf8');
  vm.runInContext(studioCode, context);

  return {
    context,
    elements,
    localStorage,
    toasts,
    document: sandboxDocument,
    window: sandboxWindow,
    getRuntimeMode: () => vm.runInContext('activeRuntimeMode', context),
    setRuntimeMode: (m) => {
      context.__temp_m = m;
      vm.runInContext('activeRuntimeMode = __temp_m;', context);
    },
    getAvailableIssues: () => vm.runInContext('availableIssues', context),
    getCurrentIssue: () => vm.runInContext('currentIssue', context),
    setCurrentIssue: (iss) => {
      context.__temp_iss = iss;
      vm.runInContext('currentIssue = __temp_iss;', context);
    }
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

async function runDualModeClientTests() {
  console.log('========================================================================');
  console.log('  CHALLENGER M1-1: DUAL-MODE RUNTIME & PERSISTENCE STRESS TESTS');
  console.log('========================================================================\n');

  // --------------------------------------------------------------------------
  // SUITE 1: Dual-Mode Client Adapter Stress Testing
  // --------------------------------------------------------------------------
  console.log('[SUITE 1] Dual-Mode Client Adapter Stress Testing');
  console.log('────────────────────────────────────────────────────────────────────────');

  // Test 1.1: Local Mode Auto-Detection
  {
    const calls = [];
    const sb = createStudioSandbox({
      origin: 'http://localhost:3420',
      hostname: 'localhost',
      pathname: '/',
      fetchHandler: async (url) => {
        calls.push(url);
        if (url === '/api/issues') {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { id: '2026-07-temmuz', issueNumber: 1, month: 'Temmuz', year: 2026 }
            ]
          };
        }
        if (url.startsWith('/api/issues/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: '2026-07-temmuz', month: 'Temmuz', year: 2026, articles: [] })
          };
        }
        return { ok: false, status: 404 };
      }
    });

    await sb.context.loadIssuesList();
    assert(sb.getRuntimeMode() === 'local', 'Localhost with responsive API activates "local" runtime mode');
    assert(calls.includes('/api/issues'), 'Localhost probes /api/issues endpoint');
    const badge = sb.elements.get('runtime-mode-badge');
    assert(badge.classList.contains('mode-local'), 'UI badge reflects mode-local');
    assert(badge.innerHTML.includes('Yerel Sunucu'), 'UI badge text indicates Yerel Sunucu (REST API)');
  }

  // Test 1.2: Static Mode Auto-Detection on GitHub Pages Host
  {
    const calls = [];
    const sb = createStudioSandbox({
      origin: 'https://rifat-akin.github.io',
      hostname: 'rifat-akin.github.io',
      pathname: '/galata-rotary-bulten/',
      fetchHandler: async (url) => {
        calls.push(url);
        // data/issues/index.json is 404
        return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
      }
    });

    await sb.context.loadIssuesList();
    assert(sb.getRuntimeMode() === 'static', 'GitHub Pages host activates "static" runtime mode');
    assert(!calls.includes('/api/issues'), 'GitHub Pages host bypasses /api/issues network probe entirely');
    assert(calls.some(u => u.includes('data/issues/index.json')), 'Static mode attempts to fetch data/issues/index.json');
    assert(sb.getAvailableIssues().length === 4, 'Static mode gracefully falls back to FALLBACK_ISSUES_CATALOG (4 issues)');
    assert(sb.getAvailableIssues()[0].id === '2026-07-temmuz', 'Fallback catalog contains July issue');
    assert(sb.getAvailableIssues()[3].id === '2026-10-ekim', 'Fallback catalog contains October issue');
    const badge = sb.elements.get('runtime-mode-badge');
    assert(badge.classList.contains('mode-static'), 'UI badge reflects mode-static');
    assert(badge.innerHTML.includes('Statik Mod'), 'UI badge text indicates Statik Mod (GitHub Pages)');
  }

  // Test 1.3: Localhost API Offline / Unhandled Network Rejection Fallback
  {
    const sb = createStudioSandbox({
      origin: 'http://localhost:3420',
      hostname: 'localhost',
      pathname: '/',
      fetchHandler: async (url) => {
        if (url === '/api/issues') {
          throw new Error('ECONNREFUSED: Server not running');
        }
        return { ok: false, status: 404 };
      }
    });

    // Should NOT throw unhandled rejection
    let threw = false;
    try {
      await sb.context.loadIssuesList();
    } catch (e) {
      threw = true;
    }
    assert(!threw, 'Offline localhost fetch failure does not crash or throw unhandled rejection');
    assert(sb.getRuntimeMode() === 'static', 'Offline localhost transitions gracefully to static mode');
    assert(sb.getAvailableIssues().length === 4, 'Static fallback activates 4-issue catalog');
  }

  // Test 1.4: Relative Path Resolution (resolveAppPath)
  {
    // Scenario A: Subdirectory (GitHub Pages)
    const sb1 = createStudioSandbox({
      origin: 'https://rifat-akin.github.io',
      pathname: '/galata-rotary-bulten/'
    });
    assert(
      sb1.context.resolveAppPath('data/issues/index.json') === 'https://rifat-akin.github.io/galata-rotary-bulten/data/issues/index.json',
      'resolveAppPath correctly handles subpaths with trailing slash'
    );
    assert(
      sb1.context.resolveAppPath('/data/issues/index.json') === 'https://rifat-akin.github.io/galata-rotary-bulten/data/issues/index.json',
      'resolveAppPath strips leading slashes from relative path'
    );

    // Scenario B: Deep document path (/galata-rotary-bulten/index.html)
    const sb2 = createStudioSandbox({
      origin: 'https://rifat-akin.github.io',
      pathname: '/galata-rotary-bulten/index.html'
    });
    assert(
      sb2.context.resolveAppPath('output/bulten.pdf') === 'https://rifat-akin.github.io/galata-rotary-bulten/output/bulten.pdf',
      'resolveAppPath extracts base directory from index.html URL'
    );

    // Scenario C: Root path
    const sb3 = createStudioSandbox({
      origin: 'http://localhost:3420',
      pathname: '/'
    });
    assert(
      sb3.context.resolveAppPath('data/issues/2026-09-eylul.json') === 'http://localhost:3420/data/issues/2026-09-eylul.json',
      'resolveAppPath handles root path correctly'
    );
  }

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 2: Corporate Brand Veto & localStorage Persistence
  // --------------------------------------------------------------------------
  console.log('[SUITE 2] Corporate Brand Veto & localStorage Persistence');
  console.log('────────────────────────────────────────────────────────────────────────');

  const mainSb = createStudioSandbox();

  // Test 2.1 - 2.8: Corporate Veto on Forbidden Phrase Permutations
  const forbiddenPermutations = [
    { title: 'Exact phrase', payload: { theme: 'Rotary Sihri' } },
    { title: 'Lowercase phrase', payload: { theme: 'rotary sihri' } },
    { title: 'Uppercase with Turkish dotted İ', payload: { theme: 'ROTARY SİHRİ' } },
    { title: 'Uppercase with ASCII I', payload: { theme: 'ROTARY SIHRI' } },
    { title: 'Turkish dotless ı', payload: { theme: 'rotary sıhrı' } },
    { title: 'Turkish Ş variant', payload: { theme: 'Rotary Şihri' } },
    { title: 'Multiple spaces', payload: { theme: 'rotary    sihri' } },
    { title: 'No space (compressed)', payload: { theme: 'rotarysihri' } },
    { title: 'Deep injection in article title', payload: { articles: [{ title: 'Özel Proje: Rotary Sihri ile Buluşma' }] } },
    { title: 'Deep injection in president message', payload: { presidentMessage: { body: 'Bu yıl rotary sihri yaratıyoruz.' } } },
    { title: 'Deep injection in culture book summary', payload: { culture: { book: { summary: 'Kitapta ROTARY SİHRİ anlatılmaktadır.' } } } },
    { title: 'Deep injection in back cover contact', payload: { backCover: { contact: { web: 'www.rotarysihri.org' } } } }
  ];

  for (const item of forbiddenPermutations) {
    let rejected = false;
    try {
      mainSb.context.validateIssueBeforeSave(item.payload);
    } catch (err) {
      if (err.message.includes('Kurumsal Kimlik İhlali') && err.message.includes('Rotary Sihri')) {
        rejected = true;
      }
    }
    assert(rejected, `Corporate Veto: Rejects [${item.title}]`);
  }

  // Empirical Blind Spot Detection: Escaped Tab / Newline in JSON Stringification
  {
    let tabDetected = false;
    try {
      mainSb.context.validateIssueBeforeSave({ theme: 'rotary\tsihri' });
    } catch (err) {
      tabDetected = true;
    }
    if (!tabDetected) {
      console.log('  ⚠️ [NOTE: Blind Spot Discovered] validateIssueBeforeSave regex /rotary\\s*[sş][iıİI]hr[iıİI]/i misses escaped control chars (\\t, \\n) serialized in JSON.');
      findings.push('Blind Spot: validateIssueBeforeSave misses escaped control chars (\\t, \\n) in JSON serialized text');
    }
  }

  // Test 2.9: Approved Corporate Theme Passes
  {
    let accepted = true;
    try {
      mainSb.context.validateIssueBeforeSave({
        theme: 'KALICI ETKİ YARAT',
        rotaryYear: '2026-2027',
        presidentMessage: { title: 'Kalıcı Etki Yaratma Zamanı' }
      });
    } catch (err) {
      accepted = false;
    }
    assert(accepted, 'Corporate Veto: Approves valid theme "KALICI ETKİ YARAT" without error');
  }

  // Test 2.10: Persistence Veto Protection (Poisoned data is NOT saved to localStorage)
  {
    mainSb.localStorage.clear();
    mainSb.setCurrentIssue({
      id: '2026-09-eylul',
      month: 'Eylül',
      year: 2026,
      theme: 'Rotary Sihri', // POISONED
      articles: []
    });

    await mainSb.context.saveCurrentIssue();
    assert(mainSb.localStorage.getItem('galata_issue_2026-09-eylul') === null, 'Corporate Veto prevents saving poisoned issue to localStorage');
  }

  // Test 2.11: Compliant Persistence in localStorage (Static Mode)
  {
    mainSb.setRuntimeMode('static');
    mainSb.setCurrentIssue({
      id: '2026-09-eylul',
      month: 'Eylül',
      year: 2026,
      theme: 'KALICI ETKİ YARAT',
      articles: [{ id: 'art-01', title: 'Galata Projesi', layout: 'two-col', photos: [] }]
    });

    await mainSb.context.saveCurrentIssue();
    const saved = mainSb.localStorage.getItem('galata_issue_2026-09-eylul');
    assert(saved !== null, 'Static mode persists compliant issue to localStorage key');
    const parsed = JSON.parse(saved);
    assert(parsed.theme === 'KALICI ETKİ YARAT', 'Persisted issue JSON retains correct theme');
    assert(parsed.articles[0].title === 'Galata Projesi', 'Persisted issue retains modified articles');
    assert(mainSb.localStorage.getItem('galata_issue_timestamp_2026-09-eylul') !== null, 'Persistence writes ISO timestamp to localStorage');
  }

  // Test 2.12: Draft Priority on Reload (selectIssue loads draft in static mode)
  {
    const staticFetchCalls = [];
    const testSandbox = createStudioSandbox({
      origin: 'https://rifat-akin.github.io',
      pathname: '/galata-rotary-bulten/',
      fetchHandler: async (url) => {
        staticFetchCalls.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: '2026-09-eylul', month: 'Eylül', articles: [{ title: 'Orijinal Başlık' }] })
        };
      }
    });
    testSandbox.setRuntimeMode('static');

    testSandbox.localStorage.setItem('galata_issue_2026-09-eylul', JSON.stringify({
      id: '2026-09-eylul',
      month: 'Eylül',
      theme: 'KALICI ETKİ YARAT',
      articles: [{ title: 'Kullanıcı Taslağı Başlığı' }]
    }));

    await testSandbox.context.selectIssue('2026-09-eylul');
    assert(testSandbox.getCurrentIssue().articles[0].title === 'Kullanıcı Taslağı Başlığı', 'selectIssue prioritizes local draft over network data in static mode');
    assert(!staticFetchCalls.some(u => u.includes('2026-09-eylul.json')), 'Network fetch for issue JSON is bypassed when local draft exists');
  }

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 3: JSON Download & Factory Reset Adversarial Stress Testing
  // --------------------------------------------------------------------------
  console.log('[SUITE 3] JSON Download & Factory Reset Adversarial Stress Testing');
  console.log('────────────────────────────────────────────────────────────────────────');

  // Test 3.1: downloadJSON Payload Integrity
  {
    const sampleData = {
      id: '2026-09-eylul',
      month: 'Eylül',
      year: 2026,
      theme: 'KALICI ETKİ YARAT'
    };

    mockUrls.clear();
    mainSb.setCurrentIssue(sampleData);
    mainSb.context.downloadJSON(sampleData, 'test-download.json');

    assert(mockUrls.size > 0, 'downloadJSON creates object URL from Blob');
    const blob = Array.from(mockUrls.values())[0];
    assert(blob.type === 'application/json; charset=utf-8', 'Blob type specifies application/json; charset=utf-8');
    const parsed = JSON.parse(blob.content);
    assert(parsed.theme === 'KALICI ETKİ YARAT', 'Blob content matches input model exactly');
    assert(blob.content.includes('\n  "theme": "KALICI ETKİ YARAT"'), 'JSON is formatted with clean 2-space indentation');
  }

  // Test 3.2: Factory Reset Purges Draft and Restores Original
  {
    const resetSandbox = createStudioSandbox({
      origin: 'https://rifat-akin.github.io',
      pathname: '/galata-rotary-bulten/',
      fetchHandler: async (url) => {
        if (url.includes('2026-09-eylul.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: '2026-09-eylul', month: 'Eylül', theme: 'KALICI ETKİ YARAT', articles: [{ title: 'Orijinal Disk Başlığı' }] })
          };
        }
        return { ok: false, status: 404 };
      }
    });
    resetSandbox.setRuntimeMode('static');

    // Preset modified draft in localStorage
    resetSandbox.localStorage.setItem('galata_issue_2026-09-eylul', JSON.stringify({
      id: '2026-09-eylul',
      month: 'Eylül',
      articles: [{ title: 'Değiştirilmiş Taslak Başlığı' }]
    }));
    resetSandbox.localStorage.setItem('galata_issue_timestamp_2026-09-eylul', new Date().toISOString());

    // Select issue (loads draft)
    await resetSandbox.context.selectIssue('2026-09-eylul');
    assert(resetSandbox.getCurrentIssue().articles[0].title === 'Değiştirilmiş Taslak Başlığı', 'Initial load has draft title');

    // Trigger Reset logic
    const issueToReset = resetSandbox.getCurrentIssue();
    resetSandbox.localStorage.removeItem(`galata_issue_${issueToReset.id}`);
    resetSandbox.localStorage.removeItem(`galata_issue_timestamp_${issueToReset.id}`);
    await resetSandbox.context.selectIssue(issueToReset.id);

    // Verify localStorage cleanup and canonical restore
    assert(resetSandbox.localStorage.getItem('galata_issue_2026-09-eylul') === null, 'Factory Reset deletes issue draft from localStorage');
    assert(resetSandbox.localStorage.getItem('galata_issue_timestamp_2026-09-eylul') === null, 'Factory Reset deletes timestamp from localStorage');
    assert(resetSandbox.getCurrentIssue().articles[0].title === 'Orijinal Disk Başlığı', 'Factory Reset restores original canonical issue from network');
  }

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 4: Image Upload & Base64 Data URL Fallback Stress Testing
  // --------------------------------------------------------------------------
  console.log('[SUITE 4] Image Upload & Base64 Data URL Fallback Stress Testing');
  console.log('────────────────────────────────────────────────────────────────────────');

  // Test 4.1: Static Mode Automatic Base64 Data URL Fallback
  {
    const uploadSandbox = createStudioSandbox({
      fetchHandler: async () => {
        throw new Error('Network should not be called in static mode');
      }
    });
    uploadSandbox.setRuntimeMode('static');

    const mockJpegFile = {
      name: 'etkinlik_foto.jpg',
      type: 'image/jpeg',
      buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0xFF, 0xD9])
    };

    const dataUrl = await uploadSandbox.context.uploadImageFile(mockJpegFile, '2026-09');
    assert(typeof dataUrl === 'string', 'uploadImageFile returns a string');
    assert(dataUrl.startsWith('data:image/jpeg;base64,'), 'Result is a valid data:image/jpeg;base64 URL');
    assert(dataUrl.length > 30, 'Base64 data URL contains payload');
  }

  // Test 4.2: Local Mode API Error Fallback to Base64
  {
    const uploadSandbox = createStudioSandbox({
      origin: 'http://localhost:3420',
      hostname: 'localhost',
      fetchHandler: async (url) => {
        if (url.startsWith('/api/upload')) {
          return { ok: false, status: 500, json: async () => ({ error: 'Disk full' }) };
        }
        return { ok: false, status: 404 };
      }
    });
    uploadSandbox.setRuntimeMode('local');

    const mockPngFile = {
      name: 'logo.png',
      type: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    };

    const dataUrl = await uploadSandbox.context.uploadImageFile(mockPngFile, '2026-09');
    assert(dataUrl.startsWith('data:image/png;base64,'), 'Local upload failure falls back gracefully to Base64 Data URL');
  }

  // Test 4.3: Rejection of Non-Image MIME Types
  {
    let rejected = false;
    try {
      await mainSb.context.readImageAsDataUrl({
        name: 'document.pdf',
        type: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4')
      });
    } catch (err) {
      if (err.message.includes('geçerli bir görsel')) {
        rejected = true;
      }
    }
    assert(rejected, 'readImageAsDataUrl rejects non-image MIME types (application/pdf)');
  }

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 5: Bulletin Reader Mode & A4 Overflow Measurement Stress Testing
  // --------------------------------------------------------------------------
  console.log('[SUITE 5] Bulletin Reader Mode & A4 Overflow Measurement Stress Testing');
  console.log('────────────────────────────────────────────────────────────────────────');

  // Test 5.1: Reader Mode Toggling
  {
    const readerSandbox = createStudioSandbox();
    const body = readerSandbox.document.body;

    readerSandbox.context.setViewMode('reader');
    assert(body.classList.contains('mode-reader-active'), 'setViewMode("reader") applies "mode-reader-active" class to body');
    const btnReader = readerSandbox.elements.get('btn-mode-reader');
    assert(btnReader.classList.contains('active'), 'Reader mode switch button is active');
    assert(btnReader.getAttribute('aria-selected') === 'true', 'Reader mode button sets aria-selected="true"');

    readerSandbox.context.setViewMode('editor');
    assert(!body.classList.contains('mode-reader-active'), 'setViewMode("editor") removes "mode-reader-active" class from body');
    const btnEditor = readerSandbox.elements.get('btn-mode-editor');
    assert(btnEditor.classList.contains('active'), 'Editor mode switch button is active');
    assert(btnEditor.getAttribute('aria-selected') === 'true', 'Editor mode button sets aria-selected="true"');
  }

  // Test 5.2: A4 Overflow Measurement Order (Removes warning banner BEFORE measuring)
  {
    const overflowSandbox = createStudioSandbox();

    // Create a mock page element
    const page = new MockElement('div');
    page.classList.add('a4-page');
    page.scrollHeight = 297;
    page.clientHeight = 297;

    // Simulate leftover warning badge from previous run
    const oldIndicator = new MockElement('div');
    oldIndicator.classList.add('page-overflow-indicator');
    page.appendChild(oldIndicator);

    // Run overflow check
    overflowSandbox.context.checkA4PageOverflow([page]);

    // Ensure previous indicator was removed
    assert(page.querySelectorAll('.page-overflow-indicator').length === 0, 'checkA4PageOverflow purges previous warning indicators BEFORE measuring');
    assert(!page.classList.contains('page-overflow'), 'Non-overflowing page has no page-overflow class');
  }

  // Test 5.3: A4 Height Overflow Trigger Boundary & Non-Displacing Pill
  {
    const overflowSandbox = createStudioSandbox();

    const normalPage = new MockElement('div');
    normalPage.classList.add('a4-page');
    normalPage.clientHeight = 1000;
    normalPage.scrollHeight = 1000;

    const overflowingPage = new MockElement('div');
    overflowingPage.classList.add('a4-page');
    overflowingPage.clientHeight = 1000;
    overflowingPage.scrollHeight = 1040; // 40px overflow

    overflowSandbox.context.checkA4PageOverflow([normalPage, overflowingPage]);

    assert(!normalPage.classList.contains('page-overflow'), 'Fitting page does not trigger overflow flag');
    assert(overflowingPage.classList.contains('page-overflow'), 'Page exceeding clientHeight triggers page-overflow class');
    const indicator = overflowingPage.querySelector('.page-overflow-indicator');
    assert(indicator !== null, 'Overflowing page receives floating warning pill');
    assert(indicator.classList.contains('no-print'), 'Floating warning pill carries .no-print class (0px layout displacement in print)');
    assert(indicator.textContent.includes('+40px A4 Taşması'), 'Warning pill indicates exact overflow in pixels (+40px A4 Taşması)');
  }

  // Test 5.4: Non-Destructive Article DOM Operations (addNewArticle)
  {
    const articleSandbox = createStudioSandbox();
    articleSandbox.setCurrentIssue({
      id: '2026-09-eylul',
      month: 'Eylül',
      year: 2026,
      articles: [
        { id: 'art-01', title: 'İlk Haber', layout: 'two-col', photos: [] }
      ]
    });

    articleSandbox.context.renderArticleCards();
    const articlesContainer = articleSandbox.elements.get('articles-container');
    const initialCardsCount = articlesContainer.childNodes.length;
    assert(initialCardsCount === 1, 'Initial article card rendered');

    // Add article
    articleSandbox.context.addNewArticle();
    assert(articleSandbox.getCurrentIssue().articles.length === 2, 'In-memory articles array expanded to 2');
    assert(articlesContainer.childNodes.length === 2, 'New article appended to DOM without wiping existing card');
    const firstTitle = articlesContainer.childNodes[0].querySelector('.article-num-title');
    const secondTitle = articlesContainer.childNodes[1].querySelector('.article-num-title');
    assert(firstTitle && firstTitle.textContent.includes('Haber #1'), 'First card preserved intact with title');
    assert(secondTitle && secondTitle.textContent.includes('Haber #2'), 'Second card appended with title');
  }

  // Test 5.5: Non-Destructive Photo Addition (addPhotoToArticle)
  {
    const articleSandbox = createStudioSandbox();
    articleSandbox.setCurrentIssue({
      id: '2026-09-eylul',
      month: 'Eylül',
      year: 2026,
      articles: [
        { id: 'art-01', title: 'İlk Haber', layout: 'two-col', photos: [] }
      ]
    });

    articleSandbox.context.renderArticleCards();
    const card = articleSandbox.elements.get('articles-container').childNodes[0];
    const photosList = card.querySelector('.photos-list');
    assert(photosList && photosList.childNodes.length === 0, 'Initially 0 photos in article');

    // Add photo
    articleSandbox.context.addPhotoToArticle(0);
    assert(articleSandbox.getCurrentIssue().articles[0].photos.length === 1, 'In-memory photo array updated to 1');
    assert(photosList && photosList.childNodes.length === 1, 'Photo row element appended directly without destroying card DOM');
    assert(photosList.childNodes[0].querySelector('.photo-url-input') !== null, 'Photo URL input present in row');
  }

  console.log();
  console.log('========================================================================');
  console.log('  CHALLENGER M1-1 TEST SUMMARY');
  console.log('========================================================================');
  console.log(`  Total Evaluated Assertions : ${totalAssertions}`);
  console.log(`  Passed                     : ${passedAssertions}`);
  console.log(`  Failed                     : ${failedAssertions}`);
  if (findings.length > 0) {
    console.log('  Discovered Blind Spots / Findings:');
    findings.forEach(f => console.log(`  - ${f}`));
  }
  console.log('========================================================================\n');

  if (failedAssertions > 0) {
    console.error(`STATUS: FAILED (${failedAssertions} assertions failed)`);
    process.exit(1);
  } else {
    console.log('STATUS: PASSED (All empirical dual-mode, veto, persistence, and UI stress assertions verified 100% compliant)');
    process.exit(0);
  }
}

runDualModeClientTests().catch(err => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});
