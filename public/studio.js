/**
 * Galata Rotary Bülten Stüdyosu — Official Interactive Studio Controller
 * Handles split-screen state sync, REST API communication, dynamic Bento switcher,
 * live A4 preview scaling, and real-time 297mm height boundary overflow detection.
 */

// State Management
let currentIssue = null;
let availableIssues = [];
let renderDebounceTimer = null;
let currentZoom = 0.75; // Default 75% zoom
let isFitMode = true;

/**
 * Shows an animated toast notification
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

/**
 * Fetches all available issues and populates the dropdown selector
 */
async function loadIssuesList(selectedId = null) {
  try {
    const res = await fetch('/api/issues');
    if (!res.ok) throw new Error('Sunucudan bülten listesi alınamadı.');
    availableIssues = await res.json();

    const selector = document.getElementById('issue-select');
    selector.innerHTML = '';

    availableIssues.forEach(issue => {
      const option = document.createElement('option');
      option.value = issue.id;
      option.textContent = `${issue.month} ${issue.year} (Sayı ${issue.issueNumber})`;
      selector.appendChild(option);
    });

    // Default to preferred issue (e.g. 2026-09-eylul or first available)
    let targetId = selectedId;
    if (!targetId) {
      const priorityIssue = availableIssues.find(i => i.id === '2026-09-eylul');
      targetId = priorityIssue ? priorityIssue.id : (availableIssues[0] ? availableIssues[0].id : null);
    }

    if (targetId) {
      selector.value = targetId;
      await selectIssue(targetId);
    }
  } catch (err) {
    showToast(`Hata: ${err.message}`, 'error');
  }
}

/**
 * Loads a specific issue JSON by ID into memory and updates forms
 */
async function selectIssue(issueId) {
  try {
    const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}`);
    if (!res.ok) throw new Error(`Bülten yüklenemedi: ${issueId}`);
    currentIssue = await res.json();

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
 * Renders dynamic article cards in the editor pane
 */
function renderArticleCards() {
  const container = document.getElementById('articles-container');
  if (!container || !currentIssue) return;

  container.innerHTML = '';
  const articles = currentIssue.articles || [];

  articles.forEach((art, index) => {
    const card = document.createElement('div');
    card.className = 'article-card-item';
    card.dataset.index = index;

    const bentoLayout = art.layout || 'two-col';

    card.innerHTML = `
      <div class="article-card-header">
        <span class="article-num-title">
          <span>📄</span> Haber #${index + 1}: ${art.title ? (art.title.length > 25 ? art.title.substring(0, 25) + '...' : art.title) : 'Başlıksız Haber'}
        </span>
        <button type="button" class="article-delete-btn" data-action="delete-article" data-index="${index}" title="Bu haberi bültenden sil">
          ✕ Sil
        </button>
      </div>

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
          <label class="form-label" style="margin-bottom:0;">Fotoğraflar (${(art.photos || []).length})</label>
          <button type="button" class="btn btn-secondary" style="font-size:11px; padding:3px 8px;" data-action="add-photo" data-art-index="${index}">
            + Fotoğraf Ekle
          </button>
        </div>

        <div class="photos-list" data-art-index="${index}">
          ${(art.photos || []).map((photo, pIdx) => `
            <div class="photo-item-row" data-photo-index="${pIdx}">
              <img src="${escapeAttr(photo.url || 'assets/brand/galata-silhouette.svg')}" class="photo-preview-thumb" alt="Thumb" onerror="this.src='assets/brand/galata-silhouette.svg'">
              <div class="photo-inputs">
                <input type="text" class="photo-url-input" value="${escapeAttr(photo.url || '')}" placeholder="Görsel Yolu (assets/photos/...)" data-pindex="${pIdx}">
                <input type="text" class="photo-caption-input" value="${escapeAttr(photo.caption || '')}" placeholder="Fotoğraf Açıklaması" data-pindex="${pIdx}">
              </div>
              <label class="file-upload-label" style="padding:4px 8px; margin:0;" title="Yeni Fotoğraf Yükle">
                <span>📁</span>
                <input type="file" class="hidden-file-input" data-art-index="${index}" data-photo-index="${pIdx}" accept="image/*">
              </label>
              <button type="button" class="article-delete-btn" style="padding:2px 6px;" data-action="delete-photo" data-art-index="${index}" data-photo-index="${pIdx}" title="Fotoğrafı Kaldır">
                ✕
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
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

    // Reapply current zoom
    applyZoom();
  } catch (err) {
    mountContainer.innerHTML = `<div style="padding:40px; color:#EF4444;">Mizanpaj oluşturma hatası: ${err.message}</div>`;
  }
}

/**
 * Real-Time A4 Overflow Detection:
 * Validates that each rendered page DOM element strictly fits within the 297mm height boundary.
 * Displays prominent visual warning banners and alert badges if content spills beyond A4 dimensions.
 */
function checkA4PageOverflow(pages) {
  if (!pages || pages.length === 0) return;

  let totalOverflows = 0;
  const overflowStatusBadge = document.getElementById('overflow-status-badge');

  pages.forEach((page, idx) => {
    // In CSS, .a4-page is 210mm x 297mm with overflow: hidden
    // scrollHeight > clientHeight indicates content exceeds the 297mm physical page limit
    const pageHeight = page.clientHeight;
    const contentHeight = page.scrollHeight;
    const pageNumber = idx + 1;

    // Remove any previous overflow warnings
    page.classList.remove('page-overflow');
    const existingBanner = page.querySelector('.overflow-warning-banner');
    if (existingBanner) existingBanner.remove();

    // 297mm height check with 3px sub-pixel tolerance
    const isOverflowing = contentHeight > pageHeight + 3;

    if (isOverflowing) {
      totalOverflows++;
      page.classList.add('page-overflow');

      // Prepend prominent warning banner inside the overflowing page
      const warningBanner = document.createElement('div');
      warningBanner.className = 'overflow-warning-banner';
      warningBanner.innerHTML = `⚠️ DİKKAT: Sayfa ${pageNumber} A4 sınırını (297mm) aşıyor! (+${contentHeight - pageHeight}px taşma) Lütfen metni kısaltın veya fotoğraf düzenini Bento formatında ayarlayın.`;
      page.prepend(warningBanner);
    }
  });

  // Update Top Navigation Bar Overflow Status Badge
  if (overflowStatusBadge) {
    if (totalOverflows > 0) {
      overflowStatusBadge.className = 'overflow-status-badge has-overflow';
      overflowStatusBadge.innerHTML = `<span>⚠️</span> <span>${totalOverflows} Sayfada A4 Taşması!</span>`;
      overflowStatusBadge.title = 'Bülten sayfalarından en az biri 297mm yüksekliğini aşıyor.';
    } else {
      overflowStatusBadge.className = 'overflow-status-badge';
      overflowStatusBadge.innerHTML = `<span>✅</span> <span>A4 Sınırında</span>`;
      overflowStatusBadge.title = 'Tüm bülten sayfaları A4 (210mm x 297mm) sınırına uygundur.';
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

/**
 * Saves current issue to disk via PUT /api/issues/:id
 */
async function saveCurrentIssue() {
  if (!currentIssue || !currentIssue.id) return;
  syncModelFromForms();

  try {
    const res = await fetch(`/api/issues/${encodeURIComponent(currentIssue.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(currentIssue, null, 2)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kaydetme işlemi başarısız.');

    showToast('Bülten başarıyla kaydedildi!', 'success');
    renderLivePreview();
  } catch (err) {
    showToast(`Kaydetme Hatası: ${err.message}`, 'error');
  }
}

/**
 * Exports current issue to high-quality print PDF via POST /api/export-pdf/:id
 */
async function exportPdf() {
  if (!currentIssue || !currentIssue.id) return;
  await saveCurrentIssue();

  showToast('Chrome Headless PDF motoru çalıştırılıyor... Lütfen bekleyin.', 'info');

  try {
    const res = await fetch(`/api/export-pdf/${encodeURIComponent(currentIssue.id)}`, {
      method: 'POST'
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'PDF üretilemedi.');

    showToast('A4 PDF başarıyla üretildi!', 'success');
    if (data.outputPdf) {
      // Open in new tab or trigger download
      window.open(data.outputPdf, '_blank');
    }
  } catch (err) {
    showToast(`PDF Üretim Hatası: ${err.message}`, 'error');
  }
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
 * Handles image file upload via POST /api/upload
 */
async function uploadImageFile(file, issueFolder) {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('issue', issueFolder || (currentIssue ? currentIssue.id : '2026-09'));

  const res = await fetch(`/api/upload?issue=${encodeURIComponent(issueFolder || '')}`, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Görsel yüklenemedi.');
  return data.url;
}

/**
 * Initializes a new month's issue template ("Yeni Ay Başlat" / initMonth / createIssue)
 */
async function startNewIssue(payload) {
  try {
    const res = await fetch('/api/issues/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Yeni ay oluşturulamadı.');

    showToast(`${data.issue.month} ${data.issue.year} başarıyla başlatıldı!`, 'success');
    closeNewIssueModal();
    await loadIssuesList(data.issue.id);
  } catch (err) {
    showToast(`Yeni Ay Hatası: ${err.message}`, 'error');
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
      selectIssue(e.target.value);
    });
  }

  // 4. Form Change Listeners (Debounced Live Preview)
  const editorPane = document.getElementById('editor-pane');
  if (editorPane) {
    editorPane.addEventListener('input', queuePreviewRender);
    editorPane.addEventListener('change', queuePreviewRender);
  }

  // 5. Action Buttons
  document.getElementById('btn-save')?.addEventListener('click', saveCurrentIssue);
  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPdf);
  document.getElementById('btn-print')?.addEventListener('click', () => window.print());
  document.getElementById('btn-rotaclub-sync')?.addEventListener('click', syncWithRotaClub);
  document.getElementById('btn-refresh-preview')?.addEventListener('click', renderLivePreview);

  // 6. New Month Initializer Modal
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

  // 7. Dynamic Article Card Delegation
  if (editorPane) {
    editorPane.addEventListener('click', async (e) => {
      const target = e.target.closest('button, label');
      if (!target) return;

      // Delete Article
      if (target.dataset.action === 'delete-article') {
        const idx = parseInt(target.dataset.index, 10);
        if (confirm(`Haber #${idx + 1} bültenden silinsin mi?`)) {
          currentIssue.articles.splice(idx, 1);
          renderArticleCards();
          queuePreviewRender();
        }
        return;
      }

      // Add Photo to Article
      if (target.dataset.action === 'add-photo') {
        const artIdx = parseInt(target.dataset.artIndex, 10);
        if (!currentIssue.articles[artIdx].photos) currentIssue.articles[artIdx].photos = [];
        currentIssue.articles[artIdx].photos.push({
          url: 'assets/brand/galata-silhouette.svg',
          caption: 'Yeni Fotoğraf Açıklaması'
        });
        renderArticleCards();
        queuePreviewRender();
        return;
      }

      // Delete Photo from Article
      if (target.dataset.action === 'delete-photo') {
        const artIdx = parseInt(target.dataset.artIndex, 10);
        const pIdx = parseInt(target.dataset.photoIndex, 10);
        currentIssue.articles[artIdx].photos.splice(pIdx, 1);
        renderArticleCards();
        queuePreviewRender();
        return;
      }

      // Bento Layout Switcher Buttons
      if (target.classList.contains('bento-option-btn')) {
        const layout = target.dataset.layout;
        const switcher = target.closest('.bento-switcher');
        const artIdx = parseInt(switcher.dataset.artIndex, 10);

        currentIssue.articles[artIdx].layout = layout;

        switcher.querySelectorAll('.bento-option-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        queuePreviewRender();
        return;
      }
    });

    // Article Fields Input Sync
    editorPane.addEventListener('input', (e) => {
      const field = e.target.dataset.field;
      if (field) {
        const card = e.target.closest('.article-card-item');
        if (card) {
          const idx = parseInt(card.dataset.index, 10);
          if (currentIssue.articles[idx]) {
            currentIssue.articles[idx][field] = e.target.value;
          }
        }
        return;
      }

      // Photo Inputs Sync
      if (e.target.classList.contains('photo-url-input') || e.target.classList.contains('photo-caption-input')) {
        const row = e.target.closest('.photo-item-row');
        const card = e.target.closest('.article-card-item');
        if (row && card) {
          const artIdx = parseInt(card.dataset.index, 10);
          const pIdx = parseInt(row.dataset.photoIndex, 10);
          if (currentIssue.articles[artIdx] && currentIssue.articles[artIdx].photos[pIdx]) {
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

    // File Upload Inputs
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
            // Article photo upload
            const artIdx = parseInt(e.target.dataset.artIndex, 10);
            const pIdx = parseInt(e.target.dataset.photoIndex, 10);
            if (currentIssue.articles[artIdx] && currentIssue.articles[artIdx].photos[pIdx]) {
              currentIssue.articles[artIdx].photos[pIdx].url = uploadedUrl;
              renderArticleCards();
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

  // Add Article Button
  document.getElementById('btn-add-article')?.addEventListener('click', () => {
    if (!currentIssue.articles) currentIssue.articles = [];
    const newArtId = `art-${String(currentIssue.articles.length + 1).padStart(2, '0')}`;
    currentIssue.articles.push({
      id: newArtId,
      category: 'Kulüpten Haberler',
      date: `1 ${currentIssue.month || 'Eylül'} ${currentIssue.year || 2026}`,
      title: 'Yeni Etkinlik & Toplantı',
      venue: 'Grand Hyatt İstanbul Taksim',
      summary: 'Yeni etkinliğin veya projenin açıklaması buraya yazılacaktır.',
      layout: 'two-col',
      photos: []
    });
    renderArticleCards();
    queuePreviewRender();
  });

  // 8. Zoom Controls
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

  window.addEventListener('resize', () => {
    if (isFitMode) applyZoom();
  });

  // 9. Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveCurrentIssue();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      window.print();
    }
  });
});
