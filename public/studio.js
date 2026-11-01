/**
 * Galata Rotary Bülten Stüdyosu — Official Interactive Studio Controller
 * Handles split-screen state sync, REST API communication, dynamic Bento switcher,
 * live A4 preview scaling, and real-time 297mm height boundary overflow detection.
 */

// State Management & Dual Runtime Mode
let currentIssue = null;
let hasUnsavedChanges = false;
let availableIssues = [];
let renderDebounceTimer = null;
let currentZoom = 0.75; // Default 75% zoom
let isFitMode = true;
let activeRuntimeMode = 'local'; // 'local' or 'static'
let currentReaderPage = 1;
let readerPageObserver = null;
let isNavigating = false;
let navigationTimer = null;
let overflowCycleIndex = 0;

// Asset release token: PDF downloads must not reuse a stale browser cache
// after a new GitHub Pages publish. Keep synced with the module URLs in index.html.
const PUBLIC_RELEASE_TAG = '20261101-editorial7';

// Official Pre-Rendered PDF Mapping
const ISSUE_PDF_MAP = {
  '2026-07-temmuz': 'Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf',
  '2026-08-agustos': 'Galata_Rotary_Bulten_2026_08_Agustos_Sayi_2.pdf',
  '2026-09-eylul': 'Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf',
  '2026-10-ekim': 'Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf'
};

// Resilient Hardcoded Fallback Catalog (Used when index.json is absent or offline)
const FALLBACK_ISSUES_CATALOG = [
  { id: '2026-07-temmuz', issueNumber: 1, month: 'Temmuz', year: 2026, rotaryMonthTheme: 'Anne ve Çocuk Sağlığı Ayı', pageCount: 8, pdfFile: 'Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf' },
  { id: '2026-08-agustos', issueNumber: 2, month: 'Ağustos', year: 2026, rotaryMonthTheme: 'Üyelik ve Yeni Kulüp Geliştirme Ayı', pageCount: 8, pdfFile: 'Galata_Rotary_Bulten_2026_08_Agustos_Sayi_2.pdf' },
  { id: '2026-09-eylul', issueNumber: 3, month: 'Eylül', year: 2026, rotaryMonthTheme: 'Temel Eğitim ve Okuryazarlık Ayı', pageCount: 9, pdfFile: 'Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf' },
  { id: '2026-10-ekim', issueNumber: 4, month: 'Ekim', year: 2026, rotaryMonthTheme: 'Toplumsal ve Ekonomik Kalkınma Ayı', pageCount: 9, pdfFile: 'Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf' }
];

// Corporate Theme Validation (Turkish-resilient regex)
const FORBIDDEN_THEME_REGEX = /rotary(?:\s|[\-_.]|\\[tnr])*[sş][iıİI]hr[iıİI]/i;

function checkStringForForbiddenBrand(str) {
  if (typeof str !== 'string' || !str) return false;
  if (FORBIDDEN_THEME_REGEX.test(str)) return true;

  let unescaped = str;
  try {
    if (unescaped.includes('%')) {
      unescaped = decodeURIComponent(unescaped);
    }
  } catch {}

  unescaped = unescaped
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));

  unescaped = unescaped
    .replace(/\\+u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\+u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\+x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  unescaped = unescaped.replace(/\\+[tnr]/g, ' ');
  unescaped = unescaped.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, '');
  unescaped = unescaped.normalize('NFC');

  if (FORBIDDEN_THEME_REGEX.test(unescaped)) return true;

  const folded = unescaped
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[iıİI]/g, 'i')
    .replace(/[sşŞS]/g, 's')
    .replace(/[hH]/g, 'h')
    .replace(/[rR]/g, 'r')
    .toLowerCase();

  return /rotary[\s_\-.]*sihri/.test(folded);
}

function hasForbiddenBrandDeep(target, visited = new WeakSet()) {
  if (target == null) return false;
  if (typeof target === 'string') return checkStringForForbiddenBrand(target);
  if (typeof target === 'number' || typeof target === 'boolean') return false;

  if (typeof target === 'object') {
    if (visited.has(target)) return false;
    visited.add(target);

    if (Array.isArray(target)) {
      for (const item of target) {
        if (hasForbiddenBrandDeep(item, visited)) return true;
      }
      return false;
    }

    for (const [key, value] of Object.entries(target)) {
      if (checkStringForForbiddenBrand(key)) return true;
      if (hasForbiddenBrandDeep(value, visited)) return true;
    }
  }

  return false;
}


/**
 * Resolves relative file paths safely across root or nested subpaths (e.g. GitHub Pages)
 */
function resolveAppPath(relPath) {
  const cleanRel = relPath.replace(/^\/+/, '');
  const path = window.location.pathname;
  const dir = path.substring(0, path.lastIndexOf('/') + 1) || '/';
  return `${window.location.origin}${dir}${cleanRel}`;
}

/**
 * Updates UI badge indicating active runtime mode
 */
function updateRuntimeModeBadge() {
  let badge = document.getElementById('runtime-mode-badge');
  if (!badge) {
    const centerGroup = document.querySelector('.studio-header-center');
    if (centerGroup) {
      badge = document.createElement('div');
      badge.id = 'runtime-mode-badge';
      badge.className = 'runtime-mode-badge';
      centerGroup.appendChild(badge);
    }
  }

  if (badge) {
    if (activeRuntimeMode === 'local') {
      badge.className = 'runtime-mode-badge mode-local';
      badge.innerHTML = `<span>🟢</span> <span>Yerel Sunucu (REST API)</span>`;
      badge.title = 'Aktif Mod: Yerel Node.js API (Değişiklikler diske kaydedilir, Chrome Headless PDF aktiftir)';
    } else {
      badge.className = 'runtime-mode-badge mode-static';
      badge.innerHTML = `<span>🌐</span> <span>Statik Mod (GitHub Pages)</span>`;
      badge.title = 'Aktif Mod: Statik Tarayıcı Modu (Değişiklikler localStorage\'a kaydedilir, JSON ve PDF doğrudan indirilir)';
    }
  }

  // No real RotaClub API contract has been configured. Never imply sync success.
  const syncButton = document.getElementById('btn-rotaclub-sync');
  if (syncButton) {
    syncButton.disabled = true;
    syncButton.title = 'RotaClub entegrasyonu bağlı değil; sahte senkronizasyon yapılmaz.';
    syncButton.setAttribute('aria-label', 'RotaClub senkronizasyonu henüz kullanılabilir değil');
  }
}

/**
 * Shows an animated toast notification
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type === 'success' || type === 'error' ? type : 'info'}`;
  const icon = document.createElement('span');
  icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  const content = document.createElement('span');
  content.textContent = String(message || '');
  toast.appendChild(icon);
  toast.appendChild(content);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

/**
 * Resilient Issue List Loader:
 * Automatically probes environment, falls back to static catalog / hardcoded registry,
 * and handles offline or GitHub Pages execution seamlessly.
 */
async function loadIssuesList(selectedId = null) {
  const selector = document.getElementById('issue-select');
  if (selector && availableIssues.length === 0) {
    selector.innerHTML = '<option value="" disabled selected>Sayılar yükleniyor...</option>';
  }

  let issues = null;
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // 1. Probe Local Server API if running on localhost
  if (isLocalHost) {
    try {
      const res = await fetch('/api/issues', { method: 'GET' });
      if (res.ok) {
        issues = await res.json();
        activeRuntimeMode = 'local';
      }
    } catch (err) {
      console.warn('Yerel REST API erişilemedi, statik moda geçiliyor:', err.message);
    }
  }

  // 2. Static Mode Fallback
  if (!issues) {
    activeRuntimeMode = 'static';
    try {
      const catalogUrl = resolveAppPath('data/issues/index.json');
      const res = await fetch(catalogUrl);
      if (res.ok) {
        issues = await res.json();
      }
    } catch (err) {
      console.warn('data/issues/index.json bulunamadı, yerleşik katalog kullanılıyor:', err.message);
    }

    // 3. Built-in hardcoded fallback if static index is missing
    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      issues = FALLBACK_ISSUES_CATALOG;
    }
  }

  if (activeRuntimeMode === 'static') {
    // New local drafts survive a reload, but are never presented as published issues.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^galata_issue_[0-9]{4}-[0-9]{2}-[a-z0-9-]+$/.test(key)) continue;
      try {
        const draft = JSON.parse(localStorage.getItem(key));
        if (!draft || key !== 'galata_issue_' + draft.id ||
            issues.some(existing => existing.id === draft.id)) continue;
        issues.push({ id: draft.id, month: draft.month, year: draft.year,
          issueNumber: draft.issueNumber, title: draft.month + ' ' + draft.year,
          totalArticles: (draft.articles || []).length, localDraft: true });
      } catch (err) {
        console.warn('Geçersiz yerel taslak atlandı:', key, err.message);
      }
    }
    issues.sort((a, b) => (a.issueNumber || 0) - (b.issueNumber || 0));
  }
  availableIssues = issues;
  updateRuntimeModeBadge();

  // Populate Dropdown Selector
  if (selector) {
    selector.innerHTML = '';
    availableIssues.forEach(issue => {
      const option = document.createElement('option');
      option.value = issue.id;
      // Mark if modified in localStorage
      const hasLocalChanges = !!localStorage.getItem(`galata_issue_${issue.id}`);
      option.textContent = `${issue.month} ${issue.year} (Sayı ${issue.issueNumber})${hasLocalChanges ? ' ✏️' : ''}`;
      selector.appendChild(option);
    });

    let targetId = selectedId;
    if (!targetId) {
      const priorityIssue = availableIssues.find(i => i.id === '2026-09-eylul');
      targetId = priorityIssue ? priorityIssue.id : (availableIssues[0] ? availableIssues[0].id : null);
    }

    if (targetId) {
      selector.value = targetId;
      await selectIssue(targetId);
    }
  }
}

/**
 * Loads a specific issue JSON by ID into memory and updates forms.
 * In static mode: checks localStorage first, then fetches data/issues/${id}.json.
 */
async function selectIssue(issueId) {
  try {
    let issueData = null;

    // Browser drafts are authoritative until successfully saved to the local API.
    // In particular, a previous offline PUT failure must not be hidden by a
    // later successful GET returning the older server copy.
    const localDraft = localStorage.getItem(`galata_issue_${issueId}`);
    if (localDraft) {
      try {
        const parsed = JSON.parse(localDraft);
        if (parsed && parsed.id === issueId && Array.isArray(parsed.articles)) {
          issueData = parsed;
          showToast('Tarayıcı taslağı kurtarıldı. Sunucu/GitHub henüz bu değişiklikleri içermeyebilir; JSON yedeği alıp kaydedin.', 'info');
        } else {
          console.warn('Taslak kimliği veya yapısı geçersiz:', issueId);
        }
      } catch (err) {
        console.error('Tarayıcı taslağı okunamadı:', err.message);
      }
    }

    if (!issueData && activeRuntimeMode === 'local') {
      try {
        const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}`);
        if (!res.ok) throw new Error(`API Hatası (${res.status})`);
        issueData = await res.json();
      } catch (err) {
        console.warn('Yerel API başarısız, statik dosya deneniyor:', err.message);
      }
    }

    if (!issueData) {
      const staticUrl = resolveAppPath(`data/issues/${issueId}.json`);
      const res = await fetch(staticUrl);
      if (!res.ok) throw new Error(`Bülten verisi (${issueId}.json) yüklenemedi: HTTP ${res.status}`);
      issueData = await res.json();
    }

    currentReaderPage = 1;
    updateReaderPageIndicator(1);
    const jumpSelect = document.getElementById('reader-page-jump-select');
    if (jumpSelect) jumpSelect.value = '1';
    const viewport = document.getElementById('preview-viewport');
    if (viewport) viewport.scrollTop = 0;

    currentIssue = issueData;
    hasUnsavedChanges = false;
    populateFormsFromModel();
    renderLivePreview();
  } catch (err) {
    showToast(`Bülten verisi yüklenirken hata oluştu: ${err.message}`, 'error');
  }
}

/**
 * Populates all sidebar editor form fields from the in-memory currentIssue model
 */
function populateFormsFromModel() {
  if (!currentIssue) return;

  // 1. Kapak & Künye
  setInputValue('inp-issue-number', currentIssue.issueNumber || 1);
  setInputValue('inp-month', currentIssue.month || '');
  setInputValue('inp-year', currentIssue.year || 2026);
  setInputValue('inp-rotary-month-theme', currentIssue.rotaryMonthTheme || '');
  setInputValue('inp-club-meeting', currentIssue.club ? currentIssue.club.meeting : '');

  if (currentIssue.officers) {
    setInputValue('inp-ri-president', currentIssue.officers.riPresident || '');
    setInputValue('inp-district-governor', currentIssue.officers.districtGovernor || '');
    setInputValue('inp-assistant-governor', currentIssue.officers.assistantGovernor || '');
    setInputValue('inp-president', currentIssue.officers.president || '');
    setInputValue('inp-secretary', currentIssue.officers.secretary || '');
    setInputValue('inp-treasurer', currentIssue.officers.treasurer || '');
    setInputValue('inp-bulletin-committee', Array.isArray(currentIssue.officers.bulletinCommittee)
      ? currentIssue.officers.bulletinCommittee.join(', ')
      : currentIssue.officers.bulletinCommittee || '');
  }

  // 2. Başkan Mesajı
  if (currentIssue.presidentMessage) {
    setInputValue('inp-president-title', currentIssue.presidentMessage.title || '');
    setInputValue('inp-president-photo', currentIssue.presidentMessage.photo || '');
    setInputValue('inp-president-body', currentIssue.presidentMessage.body || '');
  }

  // 3. Kulüpten Haberler & Makaleler
  renderArticleCards();

  // 4. Kültür & Kitap
  if (currentIssue.culture) {
    setInputValue('inp-culture-title', currentIssue.culture.title || 'Galata Kültür Köşesi');
    if (currentIssue.culture.book) {
      setInputValue('inp-book-title', currentIssue.culture.book.title || '');
      setInputValue('inp-book-author', currentIssue.culture.book.author || '');
      setInputValue('inp-book-cover', currentIssue.culture.book.cover || '');
      setInputValue('inp-book-summary', currentIssue.culture.book.summary || '');
    }
  }

  // 5. Arka Kapak
  if (currentIssue.backCover) {
    setInputValue('inp-backcover-theme', currentIssue.backCover.theme || 'ÇOCUK FELCİNE SON');
    setInputValue('inp-backcover-subtheme', currentIssue.backCover.subTheme || 'End Polio Now');
    setInputValue('inp-backcover-color', currentIssue.backCover.color || '#E01E26');
    if (currentIssue.backCover.contact) {
      setInputValue('inp-contact-instagram', currentIssue.backCover.contact.instagram || '@galatarotarykulubu');
      setInputValue('inp-contact-web', currentIssue.backCover.contact.web || 'www.galatarotary.org');
    }
  }
}

/**
 * Helper to safely set an input value if element exists
 */
function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

/**
 * Reads form fields and synchronizes into currentIssue model
 */
function syncModelFromForms() {
  if (!currentIssue) return;

  // 1. Kapak & Künye
  currentIssue.issueNumber = parseInt(document.getElementById('inp-issue-number')?.value || '1', 10);
  currentIssue.month = document.getElementById('inp-month')?.value || '';
  currentIssue.year = parseInt(document.getElementById('inp-year')?.value || '2026', 10);
  currentIssue.rotaryMonthTheme = document.getElementById('inp-rotary-month-theme')?.value || '';

  if (!currentIssue.club) currentIssue.club = {};
  currentIssue.club.meeting = document.getElementById('inp-club-meeting')?.value || '';

  if (!currentIssue.officers) currentIssue.officers = {};
  currentIssue.officers.riPresident = document.getElementById('inp-ri-president')?.value || '';
  currentIssue.officers.districtGovernor = document.getElementById('inp-district-governor')?.value || '';
  currentIssue.officers.assistantGovernor = document.getElementById('inp-assistant-governor')?.value || '';
  currentIssue.officers.president = document.getElementById('inp-president')?.value || '';
  currentIssue.officers.secretary = document.getElementById('inp-secretary')?.value || '';
  currentIssue.officers.treasurer = document.getElementById('inp-treasurer')?.value || '';

  const committeeRaw = document.getElementById('inp-bulletin-committee')?.value || '';
  currentIssue.officers.bulletinCommittee = committeeRaw.split(',').map(s => s.trim()).filter(Boolean);

  // 2. Başkan Mesajı
  if (!currentIssue.presidentMessage) currentIssue.presidentMessage = {};
  currentIssue.presidentMessage.title = document.getElementById('inp-president-title')?.value || '';
  currentIssue.presidentMessage.photo = document.getElementById('inp-president-photo')?.value || '';
  currentIssue.presidentMessage.body = document.getElementById('inp-president-body')?.value || '';

  // 4. Kültür & Kitap
  if (!currentIssue.culture) currentIssue.culture = {};
  currentIssue.culture.title = document.getElementById('inp-culture-title')?.value || 'Galata Kültür Köşesi';
  if (!currentIssue.culture.book) currentIssue.culture.book = {};
  currentIssue.culture.book.title = document.getElementById('inp-book-title')?.value || '';
  currentIssue.culture.book.author = document.getElementById('inp-book-author')?.value || '';
  currentIssue.culture.book.cover = document.getElementById('inp-book-cover')?.value || '';
  currentIssue.culture.book.summary = document.getElementById('inp-book-summary')?.value || '';

  // 5. Arka Kapak
  if (!currentIssue.backCover) currentIssue.backCover = {};
  currentIssue.backCover.theme = 'ÇOCUK FELCİNE SON';
  currentIssue.backCover.subTheme = 'End Polio Now';
  currentIssue.backCover.color = '#E01E26';
  if (!currentIssue.backCover.contact) currentIssue.backCover.contact = {};
  currentIssue.backCover.contact.instagram = document.getElementById('inp-contact-instagram')?.value || '@galatarotarykulubu';
  currentIssue.backCover.contact.web = document.getElementById('inp-contact-web')?.value || 'www.galatarotary.org';
}

/**
 * Generates DOM for a single photo row
 */
function createPhotoRowElement(photo, artIndex, photoIndex) {
  const row = document.createElement('div');
  row.className = 'photo-item-row';
  row.dataset.photoIndex = photoIndex;

  row.innerHTML = `
    <img src="${escapeAttr(photo.url || 'assets/brand/galata-silhouette.svg')}" class="photo-preview-thumb" alt="Thumb" onerror="this.src='assets/brand/galata-silhouette.svg'">
    <div class="photo-inputs">
      <input type="text" class="photo-url-input" value="${escapeAttr(photo.url || '')}" placeholder="Görsel Yolu (assets/photos/...)" data-pindex="${photoIndex}" data-art-index="${artIndex}">
      <input type="text" class="photo-caption-input" value="${escapeAttr(photo.caption || '')}" placeholder="Fotoğraf Açıklaması" data-pindex="${photoIndex}" data-art-index="${artIndex}">
    </div>
    <label class="file-upload-label" style="padding:4px 8px; margin:0;" title="Yeni Fotoğraf Yükle">
      <span>📁</span>
      <input type="file" class="hidden-file-input" data-art-index="${artIndex}" data-photo-index="${photoIndex}" accept="image/*">
    </label>
    <button type="button" class="article-delete-btn" style="padding:2px 6px;" data-action="delete-photo" data-art-index="${artIndex}" data-photo-index="${photoIndex}" title="Fotoğrafı Kaldır">
      ✕
    </button>
  `;
  return row;
}

/**
 * Generates DOM for a single article card (accordion enabled)
 */
function createArticleCardElement(art, index, isCollapsed = false) {
  const card = document.createElement('div');
  card.className = `article-card-item ${isCollapsed ? 'is-collapsed' : ''}`;
  card.dataset.index = index;

  const bentoLayout = art.layout || 'two-col';
  const displayTitle = art.title ? (art.title.length > 28 ? art.title.substring(0, 28) + '...' : art.title) : 'Başlıksız Haber';

  card.innerHTML = `
    <div class="article-card-header" data-action="toggle-card" data-index="${index}" title="Genişlet / Daralt">
      <div class="article-header-left">
        <span class="card-chevron">${isCollapsed ? '►' : '▼'}</span>
        <span class="article-num-title">
          <span>📄</span> Haber #${index + 1}: <span class="article-title-preview">${escapeHtml(displayTitle)}</span>
        </span>
      </div>
      <div class="article-header-right">
        <span class="article-bento-badge">${escapeHtml(bentoLayout)}</span>
        <button type="button" class="article-delete-btn" data-action="delete-article" data-index="${index}" title="Bu haberi bültenden sil">
          ✕ Sil
        </button>
      </div>
    </div>

    <div class="article-card-body">
      <div class="form-group">
        <label class="form-label">Başlık</label>
        <input type="text" class="form-input art-field" data-field="title" value="${escapeAttr(art.title || '')}" placeholder="Haber Başlığı">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Kategori</label>
          <input type="text" class="form-input art-field" data-field="category" value="${escapeAttr(art.category || 'Kulüpten Haberler')}" placeholder="Kategori">
        </div>
        <div class="form-group">
          <label class="form-label">Tarih</label>
          <input type="text" class="form-input art-field" data-field="date" value="${escapeAttr(art.date || '')}" placeholder="14 Eylül 2026">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Mekân / Yer</label>
        <input type="text" class="form-input art-field" data-field="venue" value="${escapeAttr(art.venue || '')}" placeholder="Grand Hyatt İstanbul Taksim">
      </div>

      <div class="form-group">
        <label class="form-label">Özet / Haber Metni</label>
        <textarea class="form-textarea art-field" data-field="summary" rows="4" placeholder="Haber metni veya özet...">${escapeHtml(art.summary || '')}</textarea>
      </div>

      <!-- Dynamic Bento Layout Selector -->
      <div class="form-group">
        <label class="form-label">Fotoğraf Izgara Düzeni (Bento Mizanpaj)</label>
        <div class="bento-switcher" data-art-index="${index}">
          <button type="button" class="bento-option-btn ${bentoLayout === 'single-col' ? 'active' : ''}" data-layout="single-col" title="Tek Görsel veya Dikey Kolon">
            <span class="bento-icon">▮</span>
            <span>Tek Kolon</span>
          </button>
          <button type="button" class="bento-option-btn ${bentoLayout === 'two-col' ? 'active' : ''}" data-layout="two-col" title="İki Eşit Fotoğraf Kolonu">
            <span class="bento-icon">▮▮</span>
            <span>İki Kolon</span>
          </button>
          <button type="button" class="bento-option-btn ${bentoLayout === 'bento-3' ? 'active' : ''}" data-layout="bento-3" title="3 Fotoğraflı Asimetrik Bento Izgara">
            <span class="bento-icon">▤</span>
            <span>Bento-3</span>
          </button>
          <button type="button" class="bento-option-btn ${bentoLayout === 'bento-4' ? 'active' : ''}" data-layout="bento-4" title="4 Fotoğraflı 2x2 Bento Izgara">
            <span class="bento-icon">⚏</span>
            <span>Bento-4</span>
          </button>
        </div>
      </div>

      <!-- Photos Management -->
      <div class="form-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label class="form-label photos-count-label" style="margin-bottom:0;">Fotoğraflar (${(art.photos || []).length})</label>
          <button type="button" class="btn btn-secondary" style="font-size:11px; padding:3px 8px;" data-action="add-photo" data-art-index="${index}">
            + Fotoğraf Ekle
          </button>
        </div>

        <div class="photos-list" data-art-index="${index}">
        </div>
      </div>
    </div>
  `;

  // Append photo items to list
  const photosList = card.querySelector('.photos-list');
  (art.photos || []).forEach((photo, pIdx) => {
    photosList.appendChild(createPhotoRowElement(photo, index, pIdx));
  });

  return card;
}

/**
 * Initial or full render of article cards (used only on issue select)
 * Restores scroll position smoothly
 */
function renderArticleCards() {
  const container = document.getElementById('articles-container');
  if (!container || !currentIssue) return;

  const scrollArea = document.querySelector('.editor-scroll-area');
  const prevScrollTop = scrollArea ? scrollArea.scrollTop : 0;

  container.innerHTML = '';
  const articles = currentIssue.articles || [];

  articles.forEach((art, index) => {
    // Keep first card expanded, subsequent collapsed by default for clean UX
    const isCollapsed = index > 0;
    container.appendChild(createArticleCardElement(art, index, isCollapsed));
  });

  if (scrollArea && prevScrollTop > 0) {
    scrollArea.scrollTop = prevScrollTop;
  }
}

/**
 * Non-destructive: Adds a photo to a specific article without rebuilding other cards
 */
function addPhotoToArticle(artIdx) {
  if (!currentIssue.articles || !currentIssue.articles[artIdx]) return;
  if (!currentIssue.articles[artIdx].photos) currentIssue.articles[artIdx].photos = [];

  const newPhoto = {
    url: 'assets/brand/galata-silhouette.svg',
    caption: 'Yeni Fotoğraf Açıklaması'
  };
  currentIssue.articles[artIdx].photos.push(newPhoto);
  const photoIndex = currentIssue.articles[artIdx].photos.length - 1;

  const card = document.querySelector(`.article-card-item[data-index="${artIdx}"]`);
  if (card) {
    // Ensure card is expanded so user sees the new photo
    if (card.classList.contains('is-collapsed')) {
      card.classList.remove('is-collapsed');
      const chevron = card.querySelector('.card-chevron');
      if (chevron) chevron.textContent = '▼';
    }

    const photosList = card.querySelector(`.photos-list[data-art-index="${artIdx}"]`);
    const countLabel = card.querySelector('.photos-count-label');

    if (photosList) {
      const newRow = createPhotoRowElement(newPhoto, artIdx, photoIndex);
      photosList.appendChild(newRow);

      if (countLabel) {
        countLabel.textContent = `Fotoğraflar (${currentIssue.articles[artIdx].photos.length})`;
      }

      // Automatically focus and select the new URL input
      const urlInput = newRow.querySelector('.photo-url-input');
      if (urlInput) {
        urlInput.focus();
        urlInput.select();
      }
    }
  }

  queuePreviewRender();
}

/**
 * Non-destructive: Removes a specific photo from an article without rebuilding cards
 */
function deletePhotoFromArticle(artIdx, photoIndex) {
  if (!currentIssue.articles || !currentIssue.articles[artIdx] || !currentIssue.articles[artIdx].photos) return;

  currentIssue.articles[artIdx].photos.splice(photoIndex, 1);

  const card = document.querySelector(`.article-card-item[data-index="${artIdx}"]`);
  if (card) {
    const photosList = card.querySelector(`.photos-list[data-art-index="${artIdx}"]`);
    const countLabel = card.querySelector('.photos-count-label');

    if (photosList) {
      const rowToRemove = photosList.querySelector(`.photo-item-row[data-photo-index="${photoIndex}"]`);
      if (rowToRemove) {
        rowToRemove.remove();
      }

      // Re-index remaining photo rows in this card
      const remainingRows = photosList.querySelectorAll('.photo-item-row');
      remainingRows.forEach((row, newPIdx) => {
        row.dataset.photoIndex = newPIdx;
        const urlInp = row.querySelector('.photo-url-input');
        const capInp = row.querySelector('.photo-caption-input');
        const fileInp = row.querySelector('.hidden-file-input');
        const delBtn = row.querySelector('[data-action="delete-photo"]');

        if (urlInp) {
          urlInp.dataset.pindex = newPIdx;
          urlInp.dataset.artIndex = artIdx;
        }
        if (capInp) {
          capInp.dataset.pindex = newPIdx;
          capInp.dataset.artIndex = artIdx;
        }
        if (fileInp) {
          fileInp.dataset.photoIndex = newPIdx;
          fileInp.dataset.artIndex = artIdx;
        }
        if (delBtn) {
          delBtn.dataset.photoIndex = newPIdx;
          delBtn.dataset.artIndex = artIdx;
        }
      });

      if (countLabel) {
        countLabel.textContent = `Fotoğraflar (${currentIssue.articles[artIdx].photos.length})`;
      }
    }
  }

  queuePreviewRender();
}

/**
 * Non-destructive: Appends a new article card without destroying existing ones
 */
function addNewArticle() {
  if (!currentIssue.articles) currentIssue.articles = [];

  const newIndex = currentIssue.articles.length;
  const newArtId = `art-${String(newIndex + 1).padStart(2, '0')}`;
  const newArticle = {
    id: newArtId,
    category: 'Kulüpten Haberler',
    date: `1 ${currentIssue.month || 'Eylül'} ${currentIssue.year || 2026}`,
    title: 'Yeni Etkinlik & Toplantı',
    venue: 'Grand Hyatt İstanbul Taksim',
    summary: 'Yeni etkinliğin veya projenin açıklaması buraya yazılacaktır.',
    layout: 'two-col',
    photos: []
  };

  currentIssue.articles.push(newArticle);

  const container = document.getElementById('articles-container');
  if (container) {
    const newCard = createArticleCardElement(newArticle, newIndex, false);
    container.appendChild(newCard);

    // Smooth scroll to new card
    newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Focus title input immediately
    const titleInput = newCard.querySelector('.art-field[data-field="title"]');
    if (titleInput) {
      titleInput.focus();
      titleInput.select();
    }
  }

  queuePreviewRender();
}

/**
 * Non-destructive: Deletes an article card and re-indexes remaining cards
 */
function deleteArticle(idx) {
  if (!confirm(`Haber #${idx + 1} bültenden silinsin mi?`)) return;

  currentIssue.articles.splice(idx, 1);

  const container = document.getElementById('articles-container');
  if (!container) return;

  const cardToRemove = container.querySelector(`.article-card-item[data-index="${idx}"]`);
  if (cardToRemove) {
    cardToRemove.remove();
  }

  // Re-index remaining article cards
  const remainingCards = container.querySelectorAll('.article-card-item');
  remainingCards.forEach((card, newIdx) => {
    card.dataset.index = newIdx;
    const art = currentIssue.articles[newIdx];
    const displayTitle = art.title ? (art.title.length > 28 ? art.title.substring(0, 28) + '...' : art.title) : 'Başlıksız Haber';

    // Update header index and title
    const headerTitleSpan = card.querySelector('.article-num-title');
    if (headerTitleSpan) {
      headerTitleSpan.innerHTML = `<span>📄</span> Haber #${newIdx + 1}: <span class="article-title-preview">${escapeHtml(displayTitle)}</span>`;
    }

    // Update delete button index
    const delBtn = card.querySelector('[data-action="delete-article"]');
    if (delBtn) delBtn.dataset.index = newIdx;

    // Update header toggle index
    const header = card.querySelector('.article-card-header');
    if (header) header.dataset.index = newIdx;

    // Update Bento switcher
    const switcher = card.querySelector('.bento-switcher');
    if (switcher) switcher.dataset.artIndex = newIdx;

    // Update add photo button
    const addPhotoBtn = card.querySelector('[data-action="add-photo"]');
    if (addPhotoBtn) addPhotoBtn.dataset.artIndex = newIdx;

    // Update photos list
    const photosList = card.querySelector('.photos-list');
    if (photosList) photosList.dataset.artIndex = newIdx;

    // Update photo inputs
    const photoRows = card.querySelectorAll('.photo-item-row');
    photoRows.forEach(row => {
      const urlInp = row.querySelector('.photo-url-input');
      const capInp = row.querySelector('.photo-caption-input');
      const fileInp = row.querySelector('.hidden-file-input');
      const photoDelBtn = row.querySelector('[data-action="delete-photo"]');

      if (urlInp) urlInp.dataset.artIndex = newIdx;
      if (capInp) capInp.dataset.artIndex = newIdx;
      if (fileInp) fileInp.dataset.artIndex = newIdx;
      if (photoDelBtn) photoDelBtn.dataset.artIndex = newIdx;
    });
  });

  queuePreviewRender();
}

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

/**
 * Triggers live A4 preview rendering with debouncing
 */
function queuePreviewRender() {
  hasUnsavedChanges = true;
  syncModelFromForms();
  if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
  renderDebounceTimer = setTimeout(renderLivePreview, 120);
}

/**
 * Renders the full issue into the preview viewport using BulletinRenderer
 * and executes real-time 297mm height boundary overflow detection.
 */
function renderLivePreview() {
  const mountContainer = document.getElementById('bulletin-preview-container');
  if (!mountContainer || !currentIssue) return;

  if (typeof globalThis.BulletinRenderer === 'undefined' || !globalThis.BulletinRenderer.renderIssueToDOM) {
    mountContainer.innerHTML = '<div style="padding:40px; color:#EF4444;">Hata: BulletinRenderer modülü bulunamadı.</div>';
    return;
  }

  try {
    mountContainer.innerHTML = '';
    const domPages = globalThis.BulletinRenderer.renderIssueToDOM(currentIssue);
    mountContainer.appendChild(domPages);

    // Update Page Count Badge
    const renderedPages = mountContainer.querySelectorAll('.a4-page');
    const pageCountEl = document.getElementById('page-count-num');
    if (pageCountEl) {
      pageCountEl.textContent = renderedPages.length;
    }

    // Run Real-Time A4 Height Boundary Overflow Detection (297mm threshold)
    checkA4PageOverflow(renderedPages);

    // Asynchronously re-check overflow when slow-loading images finish loading
    const images = mountContainer.querySelectorAll('img');
    images.forEach(img => {
      if (!img.complete) {
        const onImgDone = () => checkA4PageOverflow();
        img.addEventListener('load', onImgDone, { once: true });
        img.addEventListener('error', onImgDone, { once: true });
      }
    });

    // Update Reader Mode Navigation dropdown and observer
    updateReaderPageDropdown(renderedPages.length, currentIssue);
    setupReaderObserver();

    // Reapply current zoom
    applyZoom();
  } catch (err) {
    mountContainer.replaceChildren();
    const errorBox = document.createElement('div');
    errorBox.style.cssText = 'padding:40px; color:#EF4444;';
    errorBox.textContent = 'Mizanpaj oluşturma hatası: ' + err.message;
    mountContainer.appendChild(errorBox);
  }
}

/**
 * Real-Time A4 Overflow Detection:
 * Validates that each rendered page DOM element strictly fits within the 297mm height boundary.
 * CRITICAL FIX: Removes previous warning banners and indicators BEFORE measuring scrollHeight and clientHeight
 * to prevent persistent false-positive measurements.
 * Displays floating non-displacing warning pill and clickable top-bar alert badge if content exceeds A4 limits.
 */
function checkA4PageOverflow(pages) {
  if (!pages || pages.length === 0) pages = document.querySelectorAll('.a4-page');
  if (!pages || pages.length === 0) return;

  let totalOverflows = 0;
  const overflowStatusBadge = document.getElementById('overflow-status-badge');

  pages.forEach((page, idx) => {
    const pageNumber = idx + 1;

    // 1. CRITICAL: Clean up previous overflow classes and warning elements FIRST
    page.classList.remove('page-overflow');
    const existingIndicators = page.querySelectorAll('.overflow-warning-banner, .page-overflow-indicator');
    existingIndicators.forEach(el => el.remove());

    // 2. Measure genuine magazine content dimensions without any UI injection artifacts
    // In CSS, .a4-page is 210mm x 297mm with overflow: hidden, and internal pages wrap content in .page-inner (also overflow: hidden).
    // We inspect both .a4-page and .page-inner to catch clipped content.
    const inner = page.querySelector ? page.querySelector('.page-inner') : null;
    const pageOverflow = page.scrollHeight - page.clientHeight;
    const innerOverflow = inner ? (inner.scrollHeight - inner.clientHeight) : 0;
    const maxOverflow = Math.max(pageOverflow, innerOverflow);

    // 297mm height check with 3px sub-pixel tolerance across both outer page and inner container
    const isOverflowing = maxOverflow > 3;

    if (isOverflowing) {
      totalOverflows++;
      page.classList.add('page-overflow');

      const overflowPx = maxOverflow;

      // Refined warning presentation: Floating, absolutely positioned badge (non-displacing)
      // Never shifts magazine header, articles, or footer; hidden in print via .no-print
      const indicator = document.createElement('div');
      indicator.className = 'page-overflow-indicator no-print';
      indicator.title = `Sayfa ${pageNumber} A4 sınırını (297mm) aşıyor (+${overflowPx}px). Metni kısaltın veya Bento düzenini değiştirin.`;
      indicator.innerHTML = `<span>⚠️</span> <span>Sayfa ${pageNumber}: +${overflowPx}px A4 Taşması</span>`;
      page.appendChild(indicator);
    }
  });

  // 3. Update Top Navigation Bar Overflow Status Badge with Click-to-Scroll UX
  if (overflowStatusBadge) {
    if (totalOverflows > 0) {
      overflowStatusBadge.className = 'overflow-status-badge has-overflow';
      overflowStatusBadge.innerHTML = `<span>⚠️</span> <span>${totalOverflows} Sayfada A4 Taşması!</span>`;
      overflowStatusBadge.title = 'Taşan sayfaya gitmek için tıklayın.';
      overflowStatusBadge.style.cursor = 'pointer';
      overflowStatusBadge.onclick = () => {
        const overflowPages = Array.from(document.querySelectorAll('.a4-page.page-overflow'));
        if (overflowPages.length === 0) return;
        overflowCycleIndex = overflowCycleIndex % overflowPages.length;
        const targetPage = overflowPages[overflowCycleIndex];
        if (targetPage && typeof targetPage.scrollIntoView === 'function') {
          targetPage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        overflowCycleIndex = (overflowCycleIndex + 1) % overflowPages.length;
      };
    } else {
      overflowCycleIndex = 0;
      overflowStatusBadge.className = 'overflow-status-badge';
      overflowStatusBadge.innerHTML = `<span>✅</span> <span>A4 Sınırında</span>`;
      overflowStatusBadge.title = 'Tüm bülten sayfaları A4 (210mm x 297mm) sınırına uygundur.';
      overflowStatusBadge.style.cursor = 'default';
      overflowStatusBadge.onclick = null;
    }
  }
}

/**
 * Calculates and applies zoom scale to the preview stage
 */
function applyZoom() {
  const stage = document.getElementById('preview-stage');
  const viewport = document.getElementById('preview-viewport');
  const zoomText = document.getElementById('zoom-val');
  const slider = document.getElementById('zoom-slider');
  if (!stage || !viewport) return;

  let scale = currentZoom;

  if (isFitMode) {
    // Fit to viewport width: A4 width is 210mm (~794px at 96 DPI)
    const viewportWidth = viewport.clientWidth - 80;
    const a4WidthPx = 794;
    scale = Math.min(Math.max(viewportWidth / a4WidthPx, 0.35), 1.3);
    scale = Math.round(scale * 100) / 100;
  }

  stage.style.transform = `scale(${scale})`;
  const percentStr = `${Math.round(scale * 100)}%`;
  if (zoomText) zoomText.textContent = percentStr;
  if (slider) slider.value = Math.round(scale * 100);

  // Sync zoom chip buttons
  document.querySelectorAll('.zoom-chip').forEach(chip => {
    if (isFitMode && chip.id === 'btn-zoom-fit') {
      chip.classList.add('active');
    } else if (!isFitMode && chip.dataset.zoom && parseFloat(chip.dataset.zoom) === scale) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
}

/* =============================================================
 * Bulletin Reader Mode & Navigation Controller Functions
 * ============================================================= */

/**
 * Toggles between Editor Mode and Reader Mode
 */
function setViewMode(mode) {
  const isReader = mode === 'reader';
  document.body.classList.toggle('mode-reader-active', isReader);
  document.querySelector('.studio-workspace')?.classList.toggle('mode-reader-active', isReader);

  const btnEditor = document.getElementById('btn-mode-editor');
  const btnReader = document.getElementById('btn-mode-reader');
  if (btnEditor) {
    btnEditor.classList.toggle('active', !isReader);
    btnEditor.setAttribute('aria-selected', String(!isReader));
  }
  if (btnReader) {
    btnReader.classList.toggle('active', isReader);
    btnReader.setAttribute('aria-selected', String(isReader));
  }

  // Recalculate zoom scale to fit the expanded or restored viewport width
  setTimeout(() => {
    applyZoom();
  }, 100);
}

/**
 * Scrolls the preview smoothly to a specified 1-indexed A4 page
 * Guarded by isNavigating flag to prevent intermediate observer triggers during smooth scrolling
 */
function scrollToPage(pageIndex) {
  const pages = document.querySelectorAll('.a4-page');
  if (!pages || pages.length === 0) return;
  const targetIndex = Math.max(1, Math.min(pageIndex, pages.length)) - 1;
  const targetPage = pages[targetIndex];
  if (targetPage) {
    isNavigating = true;
    if (navigationTimer) clearTimeout(navigationTimer);
    if (typeof targetPage.scrollIntoView === 'function') {
      targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    updateReaderPageIndicator(targetIndex + 1, pages.length);
    navigationTimer = setTimeout(() => {
      isNavigating = false;
    }, 600);
  }
}

/**
 * Updates page counter indicator and jump dropdown value
 */
function updateReaderPageIndicator(current, total = null) {
  currentReaderPage = current;
  const curEl = document.getElementById('reader-page-current');
  const totalEl = document.getElementById('reader-page-total');
  const jumpSelect = document.getElementById('reader-page-jump-select');

  if (curEl) curEl.textContent = `Sayfa ${current}`;
  if (totalEl && total) totalEl.textContent = total;
  if (jumpSelect && jumpSelect.value !== String(current)) {
    jumpSelect.value = String(current);
  }
}

/**
 * Populates page jump select options dynamically from rendered pages
 */
function updateReaderPageDropdown(pagesCount, issue) {
  const jumpSelect = document.getElementById('reader-page-jump-select');
  if (!jumpSelect) return;
  jumpSelect.innerHTML = '';

  for (let i = 1; i <= pagesCount; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    let label = `Sayfa ${i}`;
    if (i === 1) {
      label = '1. Kapak & Resmî Künye';
    } else if (i === 2) {
      label = '2. Başkan Mesajı & Takvim';
    } else if (i === pagesCount - 1) {
      label = `${i}. Galata Kültür & Kitap`;
    } else if (i === pagesCount) {
      label = `${i}. Arka Kapak (Polio)`;
    } else {
      const artIdx = i - 3;
      if (issue?.articles && issue.articles[artIdx]) {
        const title = issue.articles[artIdx].title || 'Kulüpten Haberler';
        label = `${i}. ${title.length > 22 ? title.slice(0, 22) + '…' : title}`;
      } else {
        label = `${i}. Kulüpten Haberler`;
      }
    }
    opt.textContent = label;
    jumpSelect.appendChild(opt);
  }
  updateReaderPageIndicator(currentReaderPage, pagesCount);
}

/**
 * Sets up IntersectionObserver for automatic scroll-synced page detection
 */
function setupReaderObserver() {
  if (readerPageObserver) {
    readerPageObserver.disconnect();
  }
  const pages = document.querySelectorAll('.a4-page');
  const viewport = document.getElementById('preview-viewport');
  if (!pages || pages.length === 0 || !viewport) return;

  readerPageObserver = new IntersectionObserver((entries) => {
    if (isNavigating) return;

    let bestEntry = null;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
          bestEntry = entry;
        }
      }
    });

    if (bestEntry && bestEntry.isIntersecting) {
      const pageNum = parseInt(bestEntry.target.dataset.pageIndex, 10);
      if (pageNum) {
        updateReaderPageIndicator(pageNum, pages.length);
      }
    }
  }, {
    root: viewport,
    threshold: 0.4
  });

  pages.forEach(page => readerPageObserver.observe(page));
}

/**
 * Fullscreen API toggle
 */
function toggleFullScreen() {
  const fsBtn = document.getElementById('btn-fullscreen-toggle');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      if (fsBtn) {
        fsBtn.classList.add('fullscreen-active');
        const icon = fsBtn.querySelector('.fullscreen-icon');
        const txt = fsBtn.querySelector('.fullscreen-text');
        if (icon) icon.textContent = '🗗';
        if (txt) txt.textContent = 'Tam Ekrandan Çık';
      }
    }).catch(err => console.warn('Fullscreen error:', err));
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().then(() => {
        if (fsBtn) {
          fsBtn.classList.remove('fullscreen-active');
          const icon = fsBtn.querySelector('.fullscreen-icon');
          const txt = fsBtn.querySelector('.fullscreen-text');
          if (icon) icon.textContent = '⛶';
          if (txt) txt.textContent = 'Tam Ekran';
        }
      }).catch(err => console.warn('Fullscreen error:', err));
    }
  }
}

/**
 * Generates and triggers a direct browser file download for JSON content
 */
function downloadJSON(data, filename) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${(currentIssue && currentIssue.id) || 'bulten'}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

/**
 * Validates corporate rules prior to persistence (Turkish-resilient regex)
 */
function validateIssueBeforeSave(data) {
  const serialized = JSON.stringify(data);
  if (FORBIDDEN_THEME_REGEX.test(serialized) || hasForbiddenBrandDeep(data)) {
    throw new Error('Kurumsal Kimlik İhlali: "Rotary Sihri" ifadesi kesinlikle kullanılamaz! Tema "KALICI ETKİ YARAT" olmalıdır.');
  }
}

/**
 * Saves current issue:
 * - Local Mode: Sends PUT /api/issues/:id to write to filesystem.
 * - Static Mode: Persists in localStorage and offers direct "JSON İndir".
 */
async function saveCurrentIssue() {
  if (!currentIssue || !currentIssue.id) return null;
  syncModelFromForms();
  try {
    validateIssueBeforeSave(currentIssue);
  } catch (err) {
    showToast(err.message, 'error');
    return null;
  }

  let serverSaveFailed = false;
  if (activeRuntimeMode === 'local') {
    try {
      const res = await fetch('/api/issues/' + encodeURIComponent(currentIssue.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(currentIssue, null, 2)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kaydetme işlemi başarısız.');
      hasUnsavedChanges = false;
      // A recovered offline draft is no longer pending after a verified server save.
      try {
        localStorage.removeItem('galata_issue_' + currentIssue.id);
        localStorage.removeItem('galata_issue_timestamp_' + currentIssue.id);
      } catch (storageErr) {
        console.warn('Eski tarayıcı taslağı temizlenemedi:', storageErr.message);
      }
      showToast('Bülten yerel sunucudaki JSON dosyasına kaydedildi.', 'success');
      renderLivePreview();
      return 'server';
    } catch (err) {
      serverSaveFailed = true;
      console.warn('Sunucu kaydı başarısız; yalnız tarayıcı taslağı korunacak:', err.message);
    }
  }

  try {
    localStorage.setItem('galata_issue_' + currentIssue.id, JSON.stringify(currentIssue, null, 2));
    localStorage.setItem('galata_issue_timestamp_' + currentIssue.id, new Date().toISOString());
    hasUnsavedChanges = false;
    showToast(serverSaveFailed
      ? 'Sunucuya kaydedilemedi! Yalnız tarayıcıda taslak var. JSON dosyasını indirin.'
      : 'Tarayıcı taslağı kaydedildi. GitHub ve resmî PDF güncellenmedi.',
      serverSaveFailed ? 'error' : 'info');
    renderLivePreview();
    updateIssueSelectOption(currentIssue.id, true);
    return 'draft';
  } catch (err) {
    showToast('Kaydetme Hatası: ' + err.message + ' — JSON İndir ile yedek almayı deneyin.', 'error');
    return null;
  }
}

function updateIssueSelectOption(issueId, isModified) {
  const selector = document.getElementById('issue-select');
  if (!selector) return;
  const opt = Array.from(selector.options).find(o => o.value === issueId);
  if (opt && isModified && !opt.textContent.includes('✏️')) {
    opt.textContent += ' ✏️';
  }
}

/**
 * Dual-Mode PDF Export:
 * - Local Mode: Calls POST /api/export-pdf/:id to execute headless Chrome CLI.
 * - Static Mode: Opens or downloads the pre-rendered official PDF from output/*.pdf.
 *   Provides window.print() as an additional interactive fallback for custom changes.
 */
function printCurrentIssue() {
  if (!currentIssue) return;
  syncModelFromForms();
  renderLivePreview();
  window.print();
}

async function exportPdf() {
  if (!currentIssue || !currentIssue.id) return;

  // A published PDF is immutable; any edit or browser draft needs freshly printed pages.
  const draftExists = Boolean(localStorage.getItem('galata_issue_' + currentIssue.id));
  const officialPdfName = ISSUE_PDF_MAP[currentIssue.id];
  if (activeRuntimeMode === 'static' && !hasUnsavedChanges && !draftExists && officialPdfName) {
    const a = document.createElement('a');
    a.href = resolveAppPath('output/' + officialPdfName + '?v=' + PUBLIC_RELEASE_TAG);
    a.download = officialPdfName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Değiştirilmemiş resmî PDF indiriliyor.', 'info');
    return;
  }

  const saveResult = await saveCurrentIssue();
  if (!saveResult) return;
  if (saveResult === 'server') {
    try {
      const res = await fetch('/api/export-pdf/' + encodeURIComponent(currentIssue.id), { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.outputPdf) throw new Error(data.error || 'PDF çıktısı oluşturulmadı.');
      showToast('Güncel içerikten A4 PDF oluşturuldu.', 'success');
      window.open(data.outputPdf, '_blank');
      return;
    } catch (err) {
      showToast('PDF motoru başarısız: ' + err.message + '. Mevcut PDF korunur; tarayıcıdan PDF kaydedin.', 'error');
      printCurrentIssue();
      return;
    }
  }

  showToast('Bu sayı tarayıcı taslağıdır; eski resmî PDF yerine güncel sayfalar yazdırılacak. Yazdır > PDF olarak kaydet.', 'info');
  printCurrentIssue();
}

/**
 * Mock RotaClub synchronization
 */
async function syncWithRotaClub() {
  showToast('RotaClub sistemine bağlanılıyor...', 'info');

  try {
    const res = await fetch('/api/rotaclub/sync', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'RotaClub bağlantı hatası.');

    showToast(`RotaClub ile senkronize edildi: ${data.syncedCount} sayı güncel.`, 'success');
  } catch (err) {
    showToast(`RotaClub Hatası: ${err.message}`, 'error');
  }
}

/**
 * Converts a File object into a Base64 Data URL (used in static mode and offline)
 */
function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(?:jpeg|png|webp)$/.test(file.type) || file.size > 6 * 1024 * 1024) {
      return reject(new Error('Lütfen geçerli bir görsel dosyası seçin (JPEG, PNG, WebP, en çok 6 MiB).'));
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Görsel dosyası okunamadı.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Handles image file upload via POST /api/upload in local mode,
 * or Base64 Data URL conversion via FileReader in static mode.
 */
async function uploadImageFile(file, issueFolder) {
  if (activeRuntimeMode === 'local') {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('issue', issueFolder || (currentIssue ? currentIssue.id : '2026-09'));

      const res = await fetch(`/api/upload?issue=${encodeURIComponent(issueFolder || '')}`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.url) return data.url;
    } catch (err) {
      console.warn('Sunucuya görsel yüklenemedi, Base64 Data URL moduna geçiliyor:', err.message);
    }
  }

  // Static Mode or Offline Fallback: Convert to Base64 Data URL
  return await readImageAsDataUrl(file);
}

/**
 * Initializes a new month's issue template ("Yeni Ay Başlat" / initMonth / createIssue)
 */
const MONTH_ENTRIES = [
  ['Ocak','ocak',1], ['Şubat','subat',2], ['Mart','mart',3],
  ['Nisan','nisan',4], ['Mayıs','mayis',5], ['Haziran','haziran',6],
  ['Temmuz','temmuz',7], ['Ağustos','agustos',8], ['Eylül','eylul',9],
  ['Ekim','ekim',10], ['Kasım','kasim',11], ['Aralık','aralik',12]
];

async function startNewIssue(payload) {
  try {
    if (activeRuntimeMode === 'local') {
      const res = await fetch('/api/issues/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Yeni ay oluşturulamadı.');
      closeNewIssueModal();
      await loadIssuesList(data.issue.id);
      showToast('Yeni sayı yerel JSON dosyasında taslak olarak oluşturuldu.', 'success');
      return;
    }

    const month = MONTH_ENTRIES.find(entry => entry[0] === payload.month);
    const year = Number(payload.year);
    const issueNumber = Number(payload.issueNumber);
    if (!month || !Number.isInteger(year) || year < 2000 || year > 2100 ||
        !Number.isInteger(issueNumber) || issueNumber < 1) {
      throw new Error('Ay, yıl veya sayı numarası geçersiz.');
    }
    const id = year + '-' + String(month[2]).padStart(2, '0') + '-' + month[1];
    if (availableIssues.some(issue => issue.id === id) || localStorage.getItem('galata_issue_' + id)) {
      throw new Error('Bu aya ait bir bülten zaten mevcut: ' + id);
    }
    if (!currentIssue) throw new Error('Künye kopyalanabilecek mevcut sayı bulunamadı.');
    const base = JSON.parse(JSON.stringify(currentIssue));
    const rotaryStart = month[2] >= 7 ? year : year - 1;
    const draft = { ...base, id, month: month[0], year, issueNumber,
      rotaryYear: rotaryStart + '-' + (rotaryStart + 1),
      rotaryMonthTheme: payload.rotaryMonthTheme || '',
      theme: 'KALICI ETKİ YARAT',
      presidentMessage: { ...(base.presidentMessage || {}), title: month[0] + ' Ayı Başkan Mesajı', body: '' },
      articles: [],
      culture: { title: 'Galata Kültür Köşesi', book: { title: '', author: '', cover: '', summary: '' } }
    };
    localStorage.setItem('galata_issue_' + id, JSON.stringify(draft));
    localStorage.setItem('galata_issue_timestamp_' + id, new Date().toISOString());
    closeNewIssueModal();
    await loadIssuesList(id);
    showToast('Yeni sayı tarayıcıda boş taslak olarak oluşturuldu. Kalıcı yayın için JSON indirip depoya ekleyin.', 'info');
  } catch (err) {
    showToast('Yeni Ay Hatası: ' + err.message, 'error');
  }
}

function openNewIssueModal() {
  const modal = document.getElementById('modal-new-issue');
  if (modal) modal.classList.add('active');
}

function closeNewIssueModal() {
  const modal = document.getElementById('modal-new-issue');
  if (modal) modal.classList.remove('active');
}

/**
 * Attach DOM Event Handlers
 */
window.addEventListener('beforeunload', event => {
  if (!hasUnsavedChanges) return;
  event.preventDefault();
  event.returnValue = '';
});

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initial Load
  loadIssuesList();

  // 2. Tab Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.editor-section').forEach(s => s.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.dataset.tab;
      const section = document.getElementById(targetTab);
      if (section) section.classList.add('active');
    });
  });

  // 3. Issue Dropdown Switcher
  const issueSelect = document.getElementById('issue-select');
  if (issueSelect) {
    issueSelect.addEventListener('change', (e) => {
      if (hasUnsavedChanges &&
          !confirm('Kaydedilmemiş değişiklikler var. Sayı değiştirilirse kaybolacak. Devam edilsin mi?')) {
        e.target.value = currentIssue?.id || '';
        return;
      }
      selectIssue(e.target.value);
    });
  }

  // 4. Form Change Listeners (Debounced Live Preview)
  const editorPane = document.getElementById('editor-pane');
  if (editorPane) {
    editorPane.addEventListener('input', queuePreviewRender);
    editorPane.addEventListener('change', queuePreviewRender);
  }

  // 5. Action Buttons & Export Controls
  document.getElementById('btn-save')?.addEventListener('click', saveCurrentIssue);
  document.getElementById('btn-download-json')?.addEventListener('click', () => {
    if (!currentIssue) return;
    syncModelFromForms();
    downloadJSON(currentIssue, `${currentIssue.id || 'bulten'}.json`);
    showToast('Bülten JSON dosyası indirildi!', 'success');
  });

  document.getElementById('btn-reset-issue')?.addEventListener('click', async () => {
    if (!currentIssue || !currentIssue.id) return;
    if (confirm(`"${currentIssue.month} ${currentIssue.year}" sayısının yerel değişiklikleri silinip orijinal versiyonuna dönülsün mü?`)) {
      // Automatic recovery download before deleting a browser-only draft.
      const existingDraft = localStorage.getItem('galata_issue_' + currentIssue.id);
      if (existingDraft) {
        try { downloadJSON(JSON.parse(existingDraft), currentIssue.id + '-silinmeden-once-yedek.json'); }
        catch (err) { showToast('Taslak yedeklenemedi: ' + err.message, 'error'); return; }
      }
      localStorage.removeItem(`galata_issue_${currentIssue.id}`);
      localStorage.removeItem(`galata_issue_timestamp_${currentIssue.id}`);
      showToast('Yerel değişiklikler temizlendi, orijinal bülten yükleniyor...', 'info');
      await selectIssue(currentIssue.id);
      await loadIssuesList(currentIssue.id);
    }
  });

  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPdf);
  document.getElementById('btn-print')?.addEventListener('click', printCurrentIssue);
  document.getElementById('btn-rotaclub-sync')?.addEventListener('click', syncWithRotaClub);
  document.getElementById('btn-refresh-preview')?.addEventListener('click', renderLivePreview);

  // 6. View Mode Switcher Listeners
  document.getElementById('btn-mode-editor')?.addEventListener('click', () => setViewMode('editor'));
  document.getElementById('btn-mode-reader')?.addEventListener('click', () => setViewMode('reader'));

  // 7. Reader Navigation Listeners
  document.getElementById('btn-prev-page')?.addEventListener('click', () => {
    if (currentReaderPage > 1) scrollToPage(currentReaderPage - 1);
  });

  document.getElementById('btn-next-page')?.addEventListener('click', () => {
    const total = document.querySelectorAll('.a4-page').length;
    if (currentReaderPage < total) scrollToPage(currentReaderPage + 1);
  });

  document.getElementById('reader-page-jump-select')?.addEventListener('change', (e) => {
    scrollToPage(parseInt(e.target.value, 10));
  });

  document.getElementById('btn-fullscreen-toggle')?.addEventListener('click', toggleFullScreen);

  // 8. New Month Initializer Modal
  document.getElementById('btn-new-issue')?.addEventListener('click', openNewIssueModal);
  document.getElementById('btn-close-modal')?.addEventListener('click', closeNewIssueModal);
  document.getElementById('btn-cancel-modal')?.addEventListener('click', closeNewIssueModal);

  document.getElementById('btn-confirm-new-issue')?.addEventListener('click', () => {
    const month = document.getElementById('new-issue-month')?.value;
    const year = parseInt(document.getElementById('new-issue-year')?.value || '2026', 10);
    const issueNum = parseInt(document.getElementById('new-issue-num')?.value || '1', 10);
    const theme = document.getElementById('new-issue-theme')?.value;

    startNewIssue({
      month,
      year,
      issueNumber: issueNum,
      rotaryMonthTheme: theme
    });
  });

  // 9. Dynamic Article Card Delegation (Non-destructive & Accordion enabled)
  if (editorPane) {
    editorPane.addEventListener('click', async (e) => {
      // Accordion Toggle
      const header = e.target.closest('.article-card-header');
      if (header && !e.target.closest('.article-delete-btn')) {
        const card = header.closest('.article-card-item');
        if (card) {
          card.classList.toggle('is-collapsed');
          const chevron = card.querySelector('.card-chevron');
          if (chevron) {
            chevron.textContent = card.classList.contains('is-collapsed') ? '►' : '▼';
          }
        }
        return;
      }

      const target = e.target.closest('button, label');
      if (!target) return;

      // Delete Article (Surgical)
      if (target.dataset.action === 'delete-article') {
        e.stopPropagation();
        const idx = parseInt(target.dataset.index, 10);
        deleteArticle(idx);
        return;
      }

      // Add Photo to Article (Surgical)
      if (target.dataset.action === 'add-photo') {
        const artIdx = parseInt(target.dataset.artIndex, 10);
        addPhotoToArticle(artIdx);
        return;
      }

      // Delete Photo from Article (Surgical)
      if (target.dataset.action === 'delete-photo') {
        const artIdx = parseInt(target.dataset.artIndex, 10);
        const pIdx = parseInt(target.dataset.photoIndex, 10);
        deletePhotoFromArticle(artIdx, pIdx);
        return;
      }

      // Bento Layout Switcher Buttons
      if (target.classList.contains('bento-option-btn')) {
        const layout = target.dataset.layout;
        const switcher = target.closest('.bento-switcher');
        const artIdx = parseInt(switcher.dataset.artIndex, 10);

        if (currentIssue.articles && currentIssue.articles[artIdx]) {
          currentIssue.articles[artIdx].layout = layout;
        }

        switcher.querySelectorAll('.bento-option-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        // Update badge on card header in-place
        const card = switcher.closest('.article-card-item');
        const badge = card?.querySelector('.article-bento-badge');
        if (badge) badge.textContent = layout;

        queuePreviewRender();
        return;
      }
    });

    // Article Fields Input Sync (with live card header title synchronization)
    editorPane.addEventListener('input', (e) => {
      const field = e.target.dataset.field;
      if (field) {
        const card = e.target.closest('.article-card-item');
        if (card) {
          const idx = parseInt(card.dataset.index, 10);
          if (currentIssue.articles && currentIssue.articles[idx]) {
            currentIssue.articles[idx][field] = e.target.value;

            // Live synchronization of card header title
            if (field === 'title') {
              const previewSpan = card.querySelector('.article-title-preview');
              if (previewSpan) {
                const val = e.target.value.trim();
                previewSpan.textContent = val ? (val.length > 28 ? val.substring(0, 28) + '...' : val) : 'Başlıksız Haber';
              }
            }
          }
        }
        return;
      }

      // Photo Inputs Sync (In-place without re-rendering)
      if (e.target.classList.contains('photo-url-input') || e.target.classList.contains('photo-caption-input')) {
        const row = e.target.closest('.photo-item-row');
        const card = e.target.closest('.article-card-item');
        if (row && card) {
          const artIdx = parseInt(card.dataset.index, 10);
          const pIdx = parseInt(row.dataset.photoIndex, 10);
          if (currentIssue.articles && currentIssue.articles[artIdx] && currentIssue.articles[artIdx].photos[pIdx]) {
            if (e.target.classList.contains('photo-url-input')) {
              currentIssue.articles[artIdx].photos[pIdx].url = e.target.value;
              const thumb = row.querySelector('.photo-preview-thumb');
              if (thumb) thumb.src = e.target.value;
            } else {
              currentIssue.articles[artIdx].photos[pIdx].caption = e.target.value;
            }
          }
        }
      }
    });

    // File Upload Inputs (Surgical in-place update)
    editorPane.addEventListener('change', async (e) => {
      if (e.target.classList.contains('hidden-file-input') && e.target.files.length > 0) {
        const file = e.target.files[0];
        const targetId = e.target.dataset.target;

        try {
          showToast(`"${file.name}" yükleniyor...`, 'info');
          const uploadedUrl = await uploadImageFile(file, currentIssue ? currentIssue.id : '2026-09');

          if (targetId) {
            // President or Book cover input
            const inputEl = document.getElementById(targetId);
            if (inputEl) {
              inputEl.value = uploadedUrl;
              queuePreviewRender();
            }
          } else {
            // Article photo upload (In-place update without rebuilding cards)
            const artIdx = parseInt(e.target.dataset.artIndex, 10);
            const pIdx = parseInt(e.target.dataset.photoIndex, 10);
            if (currentIssue.articles && currentIssue.articles[artIdx] && currentIssue.articles[artIdx].photos[pIdx]) {
              currentIssue.articles[artIdx].photos[pIdx].url = uploadedUrl;

              const card = document.querySelector(`.article-card-item[data-index="${artIdx}"]`);
              if (card) {
                const row = card.querySelector(`.photo-item-row[data-photo-index="${pIdx}"]`);
                if (row) {
                  const urlInp = row.querySelector('.photo-url-input');
                  const thumb = row.querySelector('.photo-preview-thumb');
                  if (urlInp) urlInp.value = uploadedUrl;
                  if (thumb) thumb.src = uploadedUrl;
                }
              }
              queuePreviewRender();
            }
          }

          showToast('Fotoğraf başarıyla yüklendi!', 'success');
        } catch (err) {
          showToast(`Yükleme Hatası: ${err.message}`, 'error');
        }
      }
    });
  }

  // Hook Add Article Button to non-destructive addNewArticle
  document.getElementById('btn-add-article')?.addEventListener('click', addNewArticle);

  // 10. Zoom Controls
  document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
    isFitMode = true;
    applyZoom();
  });

  document.querySelectorAll('.zoom-chip[data-zoom]').forEach(btn => {
    btn.addEventListener('click', () => {
      isFitMode = false;
      currentZoom = parseFloat(btn.dataset.zoom);
      applyZoom();
    });
  });

  document.getElementById('zoom-slider')?.addEventListener('input', (e) => {
    isFitMode = false;
    currentZoom = parseInt(e.target.value, 10) / 100;
    applyZoom();
  });

  // Ctrl + MouseWheel Zooming on #preview-viewport
  const previewViewport = document.getElementById('preview-viewport');
  if (previewViewport) {
    previewViewport.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        isFitMode = false;
        const zoomDelta = e.deltaY < 0 ? 0.05 : -0.05;
        currentZoom = Math.min(2.0, Math.max(0.4, Math.round((currentZoom + zoomDelta) * 100) / 100));
        applyZoom();
      }
    }, { passive: false });
  }

  window.addEventListener('resize', () => {
    if (isFitMode) applyZoom();
  });

  // 11. Keyboard Shortcuts & Reader Mode Navigation
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveCurrentIssue();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      printCurrentIssue();
      return;
    }

    // Reader Mode Keyboard Navigation
    const activeEl = document.activeElement;
    const isInputFocused = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable ||
      activeEl.getAttribute('contenteditable') === 'true'
    );

    if (!isInputFocused) {
      const isReaderActive = document.body.classList.contains('mode-reader-active');
      if (isReaderActive) {
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          if (currentReaderPage > 1) {
            scrollToPage(currentReaderPage - 1);
          }
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          e.preventDefault();
          const total = document.querySelectorAll('.a4-page').length;
          if (currentReaderPage < total) {
            scrollToPage(currentReaderPage + 1);
          }
        }
      }
    }
  });
});