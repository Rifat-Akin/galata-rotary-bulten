/**
 * Private, on-device A4 PDF generation for a browser-only bulletin draft.
 *
 * No draft or image is sent to an export service. The two pinned, first-party
 * libraries are only loaded when the user clicks PDF Indir.
 * Note: this is a high-resolution image-based PDF. The separate print/export
 * path remains available when selectable/vector typography is required.
 */
const PDF_A4_MM = Object.freeze({width:210,height:297});
const MAX_PAGES = 40;
const MAX_IMAGE_PIXELS = 40_000_000;
const RENDER_SCALE = 2.2;
const loadedScripts = new Map();

async function loadLibrary(relativeUrl, available) {
  if (available()) return;
  if (!loadedScripts.has(relativeUrl)) {
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(relativeUrl, import.meta.url).href;
      script.async = true;
      script.onload = () => available() ? resolve() : reject(new Error('PDF kütüphanesi başlatılamadı.'));
      script.onerror = () => reject(new Error('PDF oluşturucu yüklenemedi. Ağ bağlantısını kontrol edin.'));
      document.head.appendChild(script);
    }).catch(err => {
      loadedScripts.delete(relativeUrl);
      throw err;
    });
    loadedScripts.set(relativeUrl, promise);
  }
  await loadedScripts.get(relativeUrl);
}

async function ensureLibraries() {
  await loadLibrary('./vendor/html2canvas-1.4.1.min.js', () => typeof globalThis.html2canvas === 'function');
  await loadLibrary('./vendor/jspdf-4.2.1.umd.min.js', () => typeof globalThis.jspdf?.jsPDF === 'function');
}

function waitForImage(image, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let timer;
    const finish = (error) => {
      clearTimeout(timer);
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      error ? reject(error) : resolve();
    };
    const validate = () => {
      const pixels = image.naturalWidth * image.naturalHeight;
      if (!image.naturalWidth || !image.naturalHeight ||
          pixels > MAX_IMAGE_PIXELS || !Number.isFinite(pixels)) {
        finish(new Error('Bir görsel yüklenemedi veya boyutu çok büyük. Fotoğrafları kontrol edin.'));
      } else finish();
    };
    const onLoad = () => validate();
    const onError = () => finish(new Error('Bültende yüklenemeyen fotoğraf var. PDF üretilmedi.'));
    if (image.complete) { validate(); return; }
    image.addEventListener('load', onLoad, {once:true});
    image.addEventListener('error', onError, {once:true});
    timer = setTimeout(() => finish(new Error('Fotoğraf yükleme zaman aşımı. PDF üretilmedi.')), timeoutMs);
  });
}

export function draftPdfFilename(issue) {
  const id = String(issue?.id || '').toLowerCase();
  const parts = /^(\d{4})-(\d{2})-([a-z0-9-]+)$/.exec(id);
  if (!parts) throw new Error('PDF dosya adı için geçerli yıl ve ay seçin.');
  const number = Number(issue.issueNumber);
  if (!Number.isSafeInteger(number) || number < 1 || number > 999) {
    throw new Error('Geçerli bülten sayı numarası gerekli.');
  }
  return 'Galata_Rotary_Bulten_' + parts[1] + '_' + parts[2] +
    '_' + parts[3].charAt(0).toUpperCase() + parts[3].slice(1) +
    '_Sayi_' + number + '.pdf';
}

/**
 * @param {object} issue - Current unsaved or saved editor model.
 * @param {object} renderer - BulletinRenderer with renderIssueToDOM().
 * @param {(done:number,total:number)=>void} onProgress
 * @returns {Promise<{blob:Blob,pages:number,filename:string}>}
 */
export async function buildDraftPdf(issue, renderer, onProgress = () => {}) {
  if (!issue || typeof renderer?.renderIssueToDOM !== 'function') {
    throw new Error('Düzenlenen bülten önizlemesi hazır değil.');
  }
  const filename = draftPdfFilename(issue);
  await ensureLibraries();

  const stage = document.createElement('div');
  stage.className = 'bulletin-local-export-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = 'position:absolute;left:-20000px;top:0;width:210mm;pointer-events:none;z-index:-1;';
  const mount = renderer.renderIssueToDOM(issue);
  stage.append(mount);
  document.body.append(stage);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    // A double RAF allows image dimensions and print CSS to settle.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const pages = [...mount.querySelectorAll('.a4-page')];
    if (!pages.length || pages.length > MAX_PAGES) {
      throw new Error('PDF sayfa sayısı geçersiz. En fazla 40 sayfa oluşturabilirsiniz.');
    }
    await Promise.all([...mount.querySelectorAll('img')].map(image => waitForImage(image)));
    const PDF = globalThis.jspdf.jsPDF;
    const documentPdf = new PDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    for (const [index, page] of pages.entries()) {
      const inner = page.querySelector('.page-inner') || page;
      if (inner.scrollHeight > inner.clientHeight + 4 ||
          page.scrollHeight > page.clientHeight + 4) {
        throw new Error('Sayfa ' + (index + 1) + ' A4 sınırını aşıyor. İçeriği kısaltın veya yeni haber sayfasına ayırın.');
      }
      onProgress(index, pages.length);
      const canvas = await globalThis.html2canvas(page,{
        scale:RENDER_SCALE,
        backgroundColor:'#ffffff',
        useCORS:true,
        allowTaint:false,
        imageTimeout:15000,
        logging:false
      });
      try {
        if (canvas.width < 1000 || canvas.height < 1400) {
          throw new Error('PDF için sayfa görüntüsü oluşturulamadı.');
        }
        if (index > 0) documentPdf.addPage('a4', 'portrait');
        const image = canvas.toDataURL('image/jpeg',0.91);
        documentPdf.addImage(image,'JPEG',0,0,PDF_A4_MM.width,PDF_A4_MM.height,
          undefined,'FAST');
      } finally {
        canvas.width = 1;
        canvas.height = 1;
      }
    }
    onProgress(pages.length, pages.length);
    const blob = documentPdf.output('blob');
    if (!(blob instanceof Blob) || blob.type !== 'application/pdf' || blob.size < 5000) {
      throw new Error('Geçerli bir PDF oluşturulamadı.');
    }
    return {blob,pages:pages.length,filename};
  } finally {
    stage.remove();
  }
}
