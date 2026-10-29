/**
 * Galata Rotary Bülten Stüdyosu — Official Decoupled Magazine Renderer
 * Converts standard BulletinIssue JSON into semantic, print-ready A4 HTML pages (.a4-page).
 *
 * Conforms to:
 * - A4 Portrait (210mm x 297mm)
 * - 2026-2027 Corporate Theme: "KALICI ETKİ YARAT"
 * - UR 2420. Bölge | Galata Rotary Kulübü (Kulüp No: 64336)
 * - Full-page crimson (#E01E26) "ÇOCUK FELCİNE SON" closing back cover
 * - Strictly 7–9 A4 pages per issue
 */

// 12-Month Rotary Designated Calendar
export const ROTARY_MONTHS = [
  { num: 7, name: 'Temmuz', theme: 'Anne ve Çocuk Sağlığı Ayı' },
  { num: 8, name: 'Ağustos', theme: 'Üyelik ve Yeni Kulüp Geliştirme Ayı' },
  { num: 9, name: 'Eylül', theme: 'Temel Eğitim ve Okuryazarlık Ayı' },
  { num: 10, name: 'Ekim', theme: 'Toplumsal ve Ekonomik Kalkınma Ayı' },
  { num: 11, name: 'Kasım', theme: 'Rotary Vakfı Ayı' },
  { num: 12, name: 'Aralık', theme: 'Hastalıkların Önlenmesi ve Tedavisi Ayı' },
  { num: 1, name: 'Ocak', theme: 'Mesleki Hizmetler Ayı' },
  { num: 2, name: 'Şubat', theme: 'Barış ve Çatışma Çözümü Ayı' },
  { num: 3, name: 'Mart', theme: 'Su, Sanitasyon ve Hijyen Ayı' },
  { num: 4, name: 'Nisan', theme: 'Çevrenin Korunması Ayı' },
  { num: 5, name: 'Mayıs', theme: 'Gençlik Hizmetleri Ayı' },
  { num: 6, name: 'Haziran', theme: 'Rotary Dostluk Grupları Ayı' }
];

// Rotary 7 Priority Focus Areas
export const ROTARY_FOCUS_AREAS = [
  'Barışın İnşası ve Çatışmaların Önlenmesi',
  'Hastalıkların Önlenmesi ve Tedavisi',
  'Temiz Su, Sanitasyon ve Hijyen',
  'Anne ve Çocuk Sağlığı',
  'Temel Eğitim ve Okuryazarlık',
  'Toplumsal ve Ekonomik Kalkınma',
  'Çevrenin Korunması'
];

// The Four-Way Test (Dörtlü Özdenetim)
export const FOUR_WAY_TEST = [
  'Gerçeğe uygun mu?',
  'İlgililerin tümü için adil mi?',
  'İyi niyet ve daha sıkı dostluklar sağlayacak mı?',
  'İlgililerin tümü için yararlı mı?'
];

/**
 * Escapes special HTML characters without corrupting UTF-8 Turkish glyphs
 */
function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalizes relative URLs with optional assetPrefix
 */
function resolveUrl(url, prefix = '') {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  // Strip leading slash if prefix ends with one
  if (prefix.endsWith('/') && url.startsWith('/')) {
    return prefix + url.slice(1);
  }
  if (!prefix.endsWith('/') && prefix !== '' && !url.startsWith('/')) {
    return prefix + '/' + url;
  }
  return prefix + url;
}

/**
 * Helper to build running page header
 */
function renderPageHeader(issue, pageCategory = 'KULÜPTEN HABERLER') {
  return `
    <header class="page-header">
      <div class="page-header-left">
        <span class="page-header-tag">${escapeHTML(pageCategory)}</span>
        <span>${escapeHTML(issue.club?.name || 'Galata Rotary Kulübü')}</span>
      </div>
      <div class="page-header-right">
        <span>${escapeHTML(issue.month || '')} ${escapeHTML(issue.year || 2026)} • SAYI: ${escapeHTML(issue.issueNumber || 1)}</span>
      </div>
    </header>
  `;
}

/**
 * Helper to build running page footer
 */
function renderPageFooter(issue, pageNum, totalPages) {
  return `
    <footer class="page-footer">
      <span class="page-footer-theme">DÖNEM TEMASI: ${escapeHTML(issue.theme || 'KALICI ETKİ YARAT')}</span>
      <span class="page-footer-center">${escapeHTML(issue.club?.district || 'UR 2420. Bölge')}</span>
      <span class="page-footer-page-num">Sayfa ${pageNum} / ${totalPages}</span>
    </footer>
  `;
}

/**
 * Page 1: Cover & Künye System
 */
function renderCoverPage(issue, pageNum, totalPages, options) {
  const prefix = options.assetPrefix || '';
  const officers = issue.officers || {};
  const club = issue.club || {};

  const rotaryLogoUrl = resolveUrl('assets/brand/rotary-masterbrand.svg', prefix);
  const themeLogoUrl = resolveUrl('assets/brand/kalici-etki-yarat.svg', prefix);
  const silhouetteUrl = resolveUrl('assets/brand/galata-silhouette.svg', prefix);

  const committeeStr = Array.isArray(officers.bulletinCommittee)
    ? officers.bulletinCommittee.join(', ')
    : (officers.bulletinCommittee || 'Rifat Akın Kaplan, Özgür Kuddar, GDB Polat Özcan');

  return `
  <article class="a4-page page-cover" data-page-index="${pageNum}">
    <div class="cover-masthead">
      <div class="masthead-brand">
        <img src="${rotaryLogoUrl}" alt="Rotary International" class="masthead-rotary-logo" onerror="this.style.display='none'" />
        <div class="masthead-club-info">
          <h1 class="masthead-club-name">${escapeHTML(club.name || 'Galata Rotary Kulübü')}</h1>
          <span class="masthead-district-badge">${escapeHTML(club.district || 'UR 2420. Bölge')} • Kulüp No: ${escapeHTML(club.clubNo || '64336')}</span>
        </div>
      </div>
      <img src="${themeLogoUrl}" alt="Kalıcı Etki Yarat 2026-2027" class="masthead-theme-logo" onerror="this.style.display='none'" />
    </div>

    <div class="cover-issue-ribbon">
      <div class="ribbon-month-year">${escapeHTML(issue.month || '').toUpperCase()} ${escapeHTML(issue.year || 2026)}</div>
      <div class="ribbon-issue-badge">SAYI: ${escapeHTML(issue.issueNumber || 1)} • DÖNEM: ${escapeHTML(issue.rotaryYear || '2026-2027')}</div>
      <div class="ribbon-theme-tag">${escapeHTML(issue.rotaryMonthTheme || 'Aylık Bülten')}</div>
    </div>

    <section class="kunye-box">
      <div class="kunye-title">
        <span>GALATA ROTARY KULÜBÜ RESMİ KÜNYESİ</span>
        <span>2026–2027 DÖNEMİ</span>
      </div>
      <div class="kunye-officers-grid">
        <div class="kunye-officer-item">
          <span class="officer-role">UR Başkanı</span>
          <span class="officer-name">${escapeHTML(officers.riPresident || 'Olayinka Hakeem Babalola')}</span>
        </div>
        <div class="kunye-officer-item">
          <span class="officer-role">2420. Bölge Guvernörü</span>
          <span class="officer-name">${escapeHTML(officers.districtGovernor || 'Erden Gökmen')}</span>
        </div>
        <div class="kunye-officer-item">
          <span class="officer-role">Guvernör Yardımcısı</span>
          <span class="officer-name">${escapeHTML(officers.assistantGovernor || 'İhsan Ercan')}</span>
        </div>
        <div class="kunye-officer-item">
          <span class="officer-role">Kulüp Dönem Başkanı</span>
          <span class="officer-name">${escapeHTML(officers.president || 'Sevilay Aksel')}</span>
        </div>
        <div class="kunye-officer-item">
          <span class="officer-role">Kulüp Dönem Sekreteri</span>
          <span class="officer-name">${escapeHTML(officers.secretary || 'Gökhan Alpertunga')}</span>
        </div>
        <div class="kunye-officer-item">
          <span class="officer-role">Kulüp Dönem Saymanı</span>
          <span class="officer-name">${escapeHTML(officers.treasurer || 'Burhan Tokgöz')}</span>
        </div>
        <div class="kunye-officer-item" style="grid-column: span 3;">
          <span class="officer-role">Bülten Komitesi</span>
          <span class="officer-name">${escapeHTML(committeeStr)}</span>
        </div>
      </div>
      <div class="kunye-club-meta">
        <div>
          <span class="kunye-meeting-line">Toplantı:</span> ${escapeHTML(club.meeting || 'Her Pazartesi 19:30 | Grand Hyatt İstanbul Taksim & Zoom')}
        </div>
        <div style="text-align: right;">
          Kuruluş: ${escapeHTML(club.foundationDate || '02.09.2003')} | Charter: ${escapeHTML(club.charterDate || '27.01.2004')}
        </div>
      </div>
    </section>

    <div class="cover-ideals-container">
      <div class="focus-areas-card">
        <h2 class="focus-areas-title">Rotary'nin 7 Öncelikli Odak Alanı</h2>
        <div class="focus-areas-list">
          ${ROTARY_FOCUS_AREAS.map((area, idx) => `
            <div class="focus-area-item">
              <span class="focus-area-num">${idx + 1}</span>
              <span>${escapeHTML(area)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="four-way-test-card">
        <h2 class="four-way-title">Rotary Dörtlü Özdenetim</h2>
        <p class="four-way-preamble">Düşündüğümüz, söylediğimiz ve yaptığımız her şeyde:</p>
        <ul class="four-way-list">
          ${FOUR_WAY_TEST.map((item, idx) => `
            <li class="four-way-item">
              <span class="four-way-num">${idx + 1}.</span>
              <span>${escapeHTML(item)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>

    <div class="cover-silhouette-wrap">
      <img src="${silhouetteUrl}" alt="Galata Silüeti" class="cover-silhouette-svg" onerror="this.style.display='none'" />
    </div>

    ${renderPageFooter(issue, pageNum, totalPages)}
  </article>
  `;
}

/**
 * Page 2: President's Message + 12-Month Rotary Calendar
 */
function renderPresidentPage(issue, pageNum, totalPages, options) {
  const prefix = options.assetPrefix || '';
  const pres = issue.presidentMessage || {};
  const presPhotoUrl = resolveUrl(pres.photo || 'assets/photos/2026-07/baskan_sevilay_aksel.jpg', prefix);

  // Split president body into paragraphs
  const paragraphs = (pres.body || '')
    .split(/\n\s*\n|\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const activeMonthName = (issue.month || '').trim().toLowerCase();

  return `
  <article class="a4-page" data-page-index="${pageNum}">
    <div class="page-inner">
      ${renderPageHeader(issue, "BAŞKANIN MESAJI & DÖNEM TAKVİMİ")}

      <div class="president-page-grid">
        <!-- 2/3 President Column -->
        <section class="president-message-col">
          <div class="president-col-header">
            <span class="president-col-tag">Dönem Başkanı Mesajı</span>
            <h2 class="president-message-title">${escapeHTML(pres.title || 'Başkanın Mesajı')}</h2>
          </div>

          <div class="president-portrait-wrap">
            <img src="${presPhotoUrl}" alt="Sevilay Aksel" class="president-portrait-img" onerror="this.src='${resolveUrl('assets/brand/rotary-logo.svg', prefix)}'" />
            <div class="president-portrait-meta">
              <span class="president-name-bold">Sevilay Aksel</span>
              <span class="president-title-sub">Galata Rotary Kulübü Dönem Başkanı (2026–2027)</span>
              <span class="president-quote-badge">"Kalıcı Etki Yaratmak İçin Birlikteyiz"</span>
            </div>
          </div>

          <div class="president-body-text">
            ${paragraphs.map(p => `<p>${escapeHTML(p)}</p>`).join('')}
          </div>

          <div class="president-signature-block">
            <span class="president-sig-name">Sevilay Aksel</span>
            <span class="president-sig-role">Galata Rotary Kulübü Dönem Başkanı 2026–2027</span>
          </div>
        </section>

        <!-- 1/3 Rotary Calendar Column -->
        <aside class="calendar-col">
          <div class="calendar-header">
            <h3 class="calendar-title-main">Rotary Tanımlanmış Ayları</h3>
            <span class="calendar-year-sub">2026–2027 DÖNEMİ</span>
          </div>

          <div class="calendar-months-list">
            ${ROTARY_MONTHS.map(m => {
              const isActive = m.name.toLowerCase() === activeMonthName;
              return `
                <div class="calendar-month-item ${isActive ? 'active-month' : ''}">
                  <div class="month-header-row">
                    <span class="calendar-month-name">${m.name}</span>
                    ${isActive ? '<span class="active-badge-tag">BU AY</span>' : ''}
                  </div>
                  <span class="calendar-month-theme-text">${escapeHTML(m.theme)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </aside>
      </div>

      ${renderPageFooter(issue, pageNum, totalPages)}
    </div>
  </article>
  `;
}

/**
 * Renders Bento Grid HTML based on article layout mode and photo list
 */
function renderBentoGrid(article, options) {
  const prefix = options.assetPrefix || '';
  const photos = article.photos || [];
  const layout = article.layout || (photos.length <= 1 ? 'single-col' : (photos.length === 2 ? 'two-col' : `bento-${Math.min(photos.length, 4)}`));

  if (photos.length === 0) {
    return '';
  }

  return `
    <div class="bento-container">
      <div class="${escapeHTML(layout)}">
        ${photos.map((p, idx) => `
          <figure class="bento-photo-card">
            <img src="${resolveUrl(p.url, prefix)}" alt="${escapeHTML(p.caption || article.title)}" class="bento-img" onerror="this.style.opacity='0.4'" />
            ${p.caption ? `<figcaption class="bento-caption">${escapeHTML(p.caption)}</figcaption>` : ''}
          </figure>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Renders a single article card
 */
function renderArticleCard(article, options, isCompact = false) {
  const catClass = (article.category || '').toLowerCase().includes('engelsiz')
    ? 'engelsiz'
    : ((article.category || '').toLowerCase().includes('sosyal')
      ? 'sosyal'
      : ((article.category || '').toLowerCase().includes('imza')
        ? 'imza'
        : ((article.category || '').toLowerCase().includes('vefa') ? 'vefa' : '')));

  return `
    <section class="article-card ${isCompact ? 'compact' : ''}">
      <div class="article-meta-bar">
        <span class="article-category-badge ${catClass}">${escapeHTML(article.category || 'Kulüp Haberi')}</span>
        <div class="article-date-venue">
          ${article.date ? `<span>📅 ${escapeHTML(article.date)}</span>` : ''}
          ${article.venue ? `<span>📍 ${escapeHTML(article.venue)}</span>` : ''}
        </div>
      </div>

      <h2 class="article-title">${escapeHTML(article.title || '')}</h2>
      ${article.summary ? `<p class="article-summary">${escapeHTML(article.summary)}</p>` : ''}

      ${renderBentoGrid(article, options)}
    </section>
  `;
}

/**
 * Renders an Article Page (holding 1 full article or 2 compact articles)
 */
function renderArticlePage(issue, articlesForPage, pageNum, totalPages, options) {
  const isMulti = articlesForPage.length > 1;
  const primaryCat = articlesForPage[0]?.category || 'KULÜPTEN HABERLER';

  return `
  <article class="a4-page" data-page-index="${pageNum}">
    <div class="page-inner">
      ${renderPageHeader(issue, primaryCat)}

      <div class="article-page-layout">
        ${articlesForPage.map(art => renderArticleCard(art, options, isMulti)).join('')}
      </div>

      ${renderPageFooter(issue, pageNum, totalPages)}
    </div>
  </article>
  `;
}

/**
 * Culture & Regional Announcements Page
 */
function renderCulturePage(issue, pageNum, totalPages, options) {
  const prefix = options.assetPrefix || '';
  const culture = issue.culture || {};
  const book = culture.book || {};
  const bookCoverUrl = resolveUrl(book.cover || '', prefix);

  // Context-aware announcements based on month
  let announcementsHTML = '';
  const m = (issue.month || '').toLowerCase();

  if (m === 'temmuz') {
    announcementsHTML = `
      <div class="announcement-box">
        <h4 class="announcement-box-title">Bölgeden Duyurular</h4>
        <div class="announcement-box-content">
          <p><strong>UR 2420. Bölge Guvernörü Erden Gökmen:</strong> "2026–2027 dönemine 'Kalıcı Etki Yarat' vizyonuyla başladık. Anne ve Çocuk Sağlığı Komitemiz ile toplum sağlığında sürdürülebilir fark yaratmayı hedefliyoruz."</p>
          <p style="margin-top: 1.5mm;"><strong>Kurumsal İletişim Webinarı:</strong> 8 Temmuz Çarşamba günü saat 20:30'da Bölge kulüpleri için dijital medya ve kurumsal temsil eğitimi düzenlendi.</p>
        </div>
      </div>
      <div class="announcement-box">
        <h4 class="announcement-box-title">Mutlu Günlerimiz & Kültür</h4>
        <div class="announcement-box-content">
          <p><strong>Doğum Günleri:</strong> Ata Tibet Aygün dostumuzun doğum gününü kutlar, sevdikleriyle birlikte nice sağlıklı ve başarılı yaşlar dileriz.</p>
          <p style="margin-top: 1.5mm;"><strong>Arşiv Notu:</strong> Nazım Hikmet'in eşi Piraye Hanım'ın mektup ve belgelerinden oluşan dijital <em>Piraye Koleksiyonu</em> araştırma arşivimize kazandırıldı.</p>
        </div>
      </div>
    `;
  } else if (m === 'ağustos') {
    announcementsHTML = `
      <div class="announcement-box">
        <h4 class="announcement-box-title">Bölge & Kulüplerarası Dayanışma</h4>
        <div class="announcement-box-content">
          <p><strong>Kadına Nefes RK:</strong> "İlk Önlüğüm Rotary'den" projesi kapsamında İstanbul Tıp Fakültesi'ne yeni başlayan 420 tıp öğrencisine beyaz önlük takdim edildi.</p>
          <p style="margin-top: 1.5mm;"><strong>Beylikdüzü RK:</strong> 30 Ağustos Zafer Koşusu vesilesiyle açılan Polio bağış kampanyasına kulübümüzce kurumsal destek sağlandı.</p>
        </div>
      </div>
      <div class="announcement-box">
        <h4 class="announcement-box-title">Mutlu Günlerimiz & Gelecek Program</h4>
        <div class="announcement-box-content">
          <p><strong>Doğum Günleri:</strong> Adil Acar dostumuzun doğum gününü (12 Ağustos) en içten dileklerimizle kutlarız.</p>
          <p style="margin-top: 1.5mm;"><strong>Gelecek Ay:</strong> Eylül ayı Temel Eğitim ve Okuryazarlık temasıyla Bölge Komite Başkanı Pınar Pirim kulübümüzün konuğu olacaktır.</p>
        </div>
      </div>
    `;
  } else if (m === 'eylül') {
    announcementsHTML = `
      <div class="announcement-box">
        <h4 class="announcement-box-title">21 Eylül Dünya Barış Günü</h4>
        <div class="announcement-box-content">
          <p><strong>Guvernör Erden Gökmen:</strong> "Barış yalnızca savaşların olmaması değil; adaletin, karşılıklı anlayışın, kaliteli eğitimin ve kalıcı etkinin bir yaşam biçimi haline gelmesidir."</p>
          <p style="margin-top: 1.5mm;"><strong>Bölge İş Birliği:</strong> BigChefs & Rotary Genç İstihdam Protokolü kapsamında 50 gencimize mesleki staj imkânı yaratıldı.</p>
        </div>
      </div>
      <div class="announcement-box">
        <h4 class="announcement-box-title">Mutlu Günlerimiz & Gelecek Program</h4>
        <div class="announcement-box-content">
          <p><strong>Evlilik Yıldönümü:</strong> Melek & Aydın Ekinci dostlarımızın 11 Eylül evlilik yıldönümünü kutlarız.</p>
          <p><strong>Doğum Günü:</strong> Cenk Laçin dostumuzun (11 Eylül) yeni yaşını tebrik ederiz.</p>
          <p style="margin-top: 1mm;"><strong>Gelecek Ay:</strong> 10 Ekim'de 38 gencimizin katılacağı RYLA Eğiticinin Eğitimi Semineri Galata Derneği'nde gerçekleştirilecektir.</p>
        </div>
      </div>
    `;
  } else {
    // Ekim
    announcementsHTML = `
      <div class="announcement-box">
        <h4 class="announcement-box-title">Dünya Çocuk Felci Günü Çağrısı</h4>
        <div class="announcement-box-content">
          <p><strong>24 Ekim Dünya Polio Günü:</strong> Guvernör Erden Gökmen ve Vakıf Komite Başkanı Gülperi Gürpınar video çağrısıyla kulüplerimizi çocuk felcine son verme fonuna katkıya davet etti.</p>
          <p style="margin-top: 1.5mm;"><strong>Tarihi Vefa:</strong> 21 Ekim 2024 Galata RK Balat Kültür Gezisi nostaljisiyle geçmiş dönem başkan ve üyelerimizin kulübe kattığı değerleri andık.</p>
        </div>
      </div>
      <div class="announcement-box">
        <h4 class="announcement-box-title">Gelecek Program & Etkinlikler</h4>
        <div class="announcement-box-content">
          <p><strong>30 Ekim:</strong> Alkent 2000 Rotary Kulübü ev sahipliğinde Cumhuriyet Balosu.</p>
          <p><strong>19 Kasım:</strong> Caddebostan Kültür Merkezi'nde merhum Kerem Arsan anısına Resim Sergisi ve Sunay Akın özel gösterisi.</p>
          <p><strong>28 Kasım:</strong> Galata Sosyal Komitesi Geleneksel Sonbahar Buluşması.</p>
        </div>
      </div>
    `;
  }

  return `
  <article class="a4-page" data-page-index="${pageNum}">
    <div class="page-inner">
      ${renderPageHeader(issue, "GALATA KÜLTÜR KÖŞESİ & BÖLGEDEN HABERLER")}

      <div class="culture-page-grid">
        <!-- Culture Book Card -->
        <section class="culture-book-card">
          <img src="${bookCoverUrl}" alt="${escapeHTML(book.title || 'Kitap Kapağı')}" class="book-cover-img" onerror="this.style.display='none'" />
          <div class="book-details">
            <span class="book-tag">Galata Kültür Köşesi • Ayın Kitap Önerisi</span>
            <h2 class="book-title">${escapeHTML(book.title || 'Galata Kitap Seçkisi')}</h2>
            <span class="book-author">${escapeHTML(book.author || '')}</span>
            <p class="book-summary">${escapeHTML(book.summary || '')}</p>
          </div>
        </section>

        <!-- Announcements Grid -->
        <div class="announcements-grid">
          ${announcementsHTML}
        </div>
      </div>

      ${renderPageFooter(issue, pageNum, totalPages)}
    </div>
  </article>
  `;
}

/**
 * Final Page: Full-Page Polio Back Cover (#E01E26)
 */
function renderBackCoverPage(issue, pageNum, totalPages, options) {
  const prefix = options.assetPrefix || '';
  const backCover = issue.backCover || {};
  const contact = backCover.contact || {};
  const emblemUrl = resolveUrl('assets/brand/end-polio-now.svg', prefix);

  return `
  <article class="a4-page page-backcover" data-page-index="${pageNum}">
    <header class="backcover-top-header">
      <span>ULUSLARARASI ROTARY • UR 2420. BÖLGE • ${escapeHTML(issue.club?.name || 'GALATA ROTARY KULÜBÜ').toUpperCase()}</span>
    </header>

    <div class="backcover-center-content">
      <img src="${emblemUrl}" alt="End Polio Now" class="backcover-emblem-svg" onerror="this.style.display='none'" />
      <h1 class="backcover-main-title">${escapeHTML(backCover.theme || 'ÇOCUK FELCİNE SON')}</h1>
      <span class="backcover-sub-title">${escapeHTML(backCover.subTheme || 'END POLIO NOW')}</span>
      <p class="backcover-manifesto">
        Rotary ve ortakları sayesinde çocuk felci vakaları %99,9 oranında azaldı. Dünyayı bu hastalıktan tamamen arındırana kadar durmayacağız.
      </p>
    </div>

    <footer class="backcover-footer">
      <div class="backcover-contact-row">
        ${contact.instagram ? `<span class="backcover-contact-item">📷 ${escapeHTML(contact.instagram)}</span>` : ''}
        ${contact.web ? `<span class="backcover-contact-item">🌐 ${escapeHTML(contact.web)}</span>` : ''}
      </div>
      <div class="backcover-club-meta">
        ${escapeHTML(issue.club?.name || 'Galata Rotary Kulübü')} • Kulüp No: ${escapeHTML(issue.club?.clubNo || '64336')} • Charter: ${escapeHTML(issue.club?.charterDate || '27.01.2004')}
      </div>
      <div class="backcover-theme-motto">
        2026–2027 DÖNEMİ: ${escapeHTML(issue.theme || 'KALICI ETKİ YARAT')}
      </div>
    </footer>
  </article>
  `;
}

/**
 * Smart Article Paginator: groups articles to guarantee strict 7–9 A4 pages
 */
function paginateArticles(issue) {
  const articles = issue.articles || [];
  const id = (issue.id || '').toLowerCase();

  // Curated layout assignments for the 4 official 2026-2027 issues
  if (id.includes('temmuz')) {
    // 4 articles -> 4 separate pages (Total: 1 cover + 1 pres + 4 arts + 1 culture + 1 polio = 8 pages)
    return articles.map(a => [a]);
  }

  if (id.includes('agustos') || id.includes('ağustos')) {
    // 5 articles: art3 and art4 are compact single-col articles that fit on 1 shared page
    // (Total: 1 cover + 1 pres + 4 art pages + 1 culture + 1 polio = 8 pages)
    if (articles.length >= 5) {
      return [
        [articles[0]],
        [articles[1]],
        [articles[2], articles[3]],
        [articles[4]]
      ];
    }
  }

  if (id.includes('eylul') || id.includes('eylül')) {
    // 5 articles: 5 dedicated pages (Total: 1 cover + 1 pres + 5 arts + 1 culture + 1 polio = 9 pages)
    return articles.map(a => [a]);
  }

  if (id.includes('ekim')) {
    // 6 articles: art5 and art6 share 1 page
    // (Total: 1 cover + 1 pres + 5 art pages + 1 culture + 1 polio = 9 pages)
    if (articles.length >= 6) {
      return [
        [articles[0]],
        [articles[1]],
        [articles[2]],
        [articles[3]],
        [articles[4], articles[5]]
      ];
    }
  }

  // Generic fallback for any arbitrary issue:
  // Target 3 to 5 article pages so total pages is 7 to 9
  if (articles.length <= 4) {
    return articles.map(a => [a]);
  } else if (articles.length === 5) {
    return articles.map(a => [a]); // 9 pages total
  } else {
    // 6 or more articles: group consecutive pairs where appropriate
    const pages = [];
    let i = 0;
    while (i < articles.length) {
      // If we have more articles than remaining slots to keep under 5 pages
      const remainingSlots = 5 - pages.length;
      const remainingArticles = articles.length - i;
      if (remainingArticles > remainingSlots && i + 1 < articles.length) {
        pages.push([articles[i], articles[i + 1]]);
        i += 2;
      } else {
        pages.push([articles[i]]);
        i += 1;
      }
    }
    return pages;
  }
}

/**
 * Core Function: Renders a BulletinIssue model to an HTML string
 *
 * @param {Object} issue - Validated BulletinIssue model
 * @param {Object} options - Configuration options
 * @param {string} [options.assetPrefix=''] - URL or filesystem prefix for asset references
 * @param {boolean} [options.fullDoc=false] - Return complete HTML document with <head> and <body>
 * @param {string} [options.title=''] - Custom HTML document title
 * @returns {string} Semantic A4 HTML pages markup
 */
export function renderIssueToHTML(issue, options = {}) {
  if (!issue || typeof issue !== 'object') {
    throw new Error('renderIssueToHTML: Invalid issue parameter, expected an object');
  }

  const prefix = options.assetPrefix || '';
  const articlePages = paginateArticles(issue);

  // Total page calculation: 1 (Cover) + 1 (President/Calendar) + N (Article Pages) + 1 (Culture) + 1 (Polio Back Cover)
  const totalPages = 1 + 1 + articlePages.length + 1 + 1;

  let currentPage = 1;
  const pagesHTML = [];

  // Page 1: Cover & Künye
  pagesHTML.push(renderCoverPage(issue, currentPage++, totalPages, options));

  // Page 2: President & 12-Month Calendar
  pagesHTML.push(renderPresidentPage(issue, currentPage++, totalPages, options));

  // Pages 3..(N-2): Article Pages
  for (const group of articlePages) {
    pagesHTML.push(renderArticlePage(issue, group, currentPage++, totalPages, options));
  }

  // Page N-1: Culture & Regional Announcements
  pagesHTML.push(renderCulturePage(issue, currentPage++, totalPages, options));

  // Page N: Full-Page Polio Back Cover
  pagesHTML.push(renderBackCoverPage(issue, currentPage++, totalPages, options));

  const bodyContent = pagesHTML.join('\n\n');

  if (!options.fullDoc) {
    return bodyContent;
  }

  const docTitle = options.title || `Galata Rotary Kulübü Bülteni - ${issue.month || ''} ${issue.year || 2026} (Sayı ${issue.issueNumber || 1})`;
  const printCssUrl = resolveUrl('styles/bulletin-print.css', prefix);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(docTitle)}</title>
  <link rel="stylesheet" href="${printCssUrl}">
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

/**
 * DOM Function: Renders a BulletinIssue model to DOM elements in a browser environment
 *
 * @param {Object} issue - Validated BulletinIssue model
 * @param {Object} options - Configuration options
 * @returns {HTMLElement} A container element holding all .a4-page elements
 */
export function renderIssueToDOM(issue, options = {}) {
  if (typeof document === 'undefined') {
    throw new Error('renderIssueToDOM: Browser DOM environment (window.document) is required. For Node.js/SSR use renderIssueToHTML.');
  }

  const html = renderIssueToHTML(issue, { ...options, fullDoc: false });
  const container = document.createElement('div');
  container.className = 'galata-bulletin-container';
  container.innerHTML = html;
  return container;
}

// Global browser registration for RotaClub or script tag usage
if (typeof globalThis !== 'undefined') {
  globalThis.BulletinRenderer = {
    renderIssueToHTML,
    renderIssueToDOM,
    ROTARY_MONTHS,
    ROTARY_FOCUS_AREAS,
    FOUR_WAY_TEST
  };
}
