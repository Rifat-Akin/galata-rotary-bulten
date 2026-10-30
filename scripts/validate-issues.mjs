#!/usr/bin/env node
/**
 * Galata Rotary Bülten Stüdyosu — Automated Issue Validator
 * Validates JSON schema, corporate theme compliance, Turkish UTF-8 typography,
 * back cover requirements, and physical existence of all referenced photo assets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'issues');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

const CORPORATE_THEME = 'KALICI ETKİ YARAT';
const FORBIDDEN_THEME = 'Rotary Sihri';
export const FORBIDDEN_THEME_REGEX = /rotary(?:\s|[\-_.]|\\[tnr])*[sş][iıİI]hr[iıİI]/i;

export function checkStringForForbiddenBrand(str) {
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

export function hasForbiddenBrandDeep(target, visited = new WeakSet()) {
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

const POLIO_THEME = 'ÇOCUK FELCİNE SON';
const POLIO_CRIMSON = '#E01E26';

const MOJIBAKE_PATTERNS = [
  'Ã§', 'Ã¼', 'ÅŸ', 'Ã¶', 'ÄŸ', 'Ä±', 'ý', 'þ', 'ð', 'Ý', 'Þ', 'Ð', 'ï¿½', '\uFFFD'
];

const EXPECTED_OFFICERS = {
  riPresident: 'Olayinka Hakeem Babalola',
  districtGovernor: 'Erden Gökmen',
  president: 'Sevilay Aksel',
  secretary: 'Gökhan Alpertunga',
  treasurer: 'Burhan Tokgöz'
};

const EXPECTED_BOOKS = {
  '2026-07-temmuz': {
    author: 'İlhan Eksen',
    title: 'Galata Köprüsü'
  },
  '2026-08-agustos': {
    author: 'Pera',
    title: 'Hatırat'
  },
  '2026-09-eylul': {
    author: 'Timurtaş Onan',
    title: 'Beyoğlu: Eski Yeni'
  },
  '2026-10-ekim': {
    author: 'Celali Yılmaz',
    title: 'Galata Hanları'
  }
};

const REQUIRED_ISSUES = [
  '2026-07-temmuz.json',
  '2026-08-agustos.json',
  '2026-09-eylul.json',
  '2026-10-ekim.json'
];

function resolveAssetPath(relPath) {
  if (!relPath) return null;
  // Handle paths with or without leading slash or public/
  let clean = relPath.replace(/^[\/\\]+/, '');
  if (clean.startsWith('public/')) {
    clean = clean.substring('public/'.length);
  }
  return path.join(PUBLIC_DIR, clean);
}

function validateIssue(filename) {
  const filePath = path.join(DATA_DIR, filename);
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(filePath)) {
    return {
      filename,
      passed: false,
      errors: [`Dosya mevcut değil: ${filePath}`],
      warnings: []
    };
  }

  const rawText = fs.readFileSync(filePath, 'utf8');

  // 1. Forbidden Theme Check (Zero occurrences of "Rotary Sihri", case-insensitive & Turkish resilient)
  if (FORBIDDEN_THEME_REGEX.test(rawText) || checkStringForForbiddenBrand(rawText)) {
    errors.push(`Kritik Kural İhlali: Yasaklı tema ifadesi bulundu: "${FORBIDDEN_THEME}"`);
  }

  // 2. Turkish Mojibake Check
  for (const pattern of MOJIBAKE_PATTERNS) {
    if (rawText.includes(pattern)) {
      errors.push(`Karakter Hatası: Mojibake / bozuk karakter bulundu: "${pattern}"`);
    }
  }

  let issue;
  try {
    issue = JSON.parse(rawText);
  } catch (err) {
    return {
      filename,
      passed: false,
      errors: [`JSON Ayrıştırma Hatası: ${err.message}`],
      warnings: []
    };
  }

  // 1b. Deep Unicode Unescape & Object Scan Check
  if (issue && (FORBIDDEN_THEME_REGEX.test(JSON.stringify(issue)) || hasForbiddenBrandDeep(issue))) {
    const errorMsg = `Kritik Kural İhlali: Yasaklı tema ifadesi bulundu: "${FORBIDDEN_THEME}"`;
    if (!errors.includes(errorMsg)) {
      errors.push(errorMsg);
    }
  }

  // 3. Schema Structure & Theme Verification
  if (issue.theme !== CORPORATE_THEME) {
    errors.push(`Tema Uyuşmazlığı: "${issue.theme}", beklenen: "${CORPORATE_THEME}"`);
  }
  if (issue.rotaryYear !== '2026-2027') {
    errors.push(`Dönem Uyuşmazlığı: "${issue.rotaryYear}", beklenen: "2026-2027"`);
  }
  if (!issue.rotaryMonthTheme) {
    errors.push('Eksik Alan: rotaryMonthTheme tanımlanmamış');
  }

  // 4. Club & Masthead Verification
  if (!issue.club) {
    errors.push('Eksik Alan: club nesnesi eksik');
  } else {
    if (issue.club.name !== 'Galata Rotary Kulübü') {
      errors.push(`Kulüp Adı Hatası: "${issue.club.name}"`);
    }
    if (!issue.club.district || !issue.club.district.includes('2420')) {
      errors.push(`Bölge Hatası: "${issue.club.district}", UR 2420. Bölge olmalıdır`);
    }
    if (issue.club.clubNo !== '64336') {
      errors.push(`Kulüp No Hatası: "${issue.club.clubNo}", beklenen: "64336"`);
    }
    if (issue.club.charterDate !== '27.01.2004') {
      errors.push(`Charter Tarihi Hatası: "${issue.club.charterDate}", beklenen: "27.01.2004"`);
    }
  }

  // 5. Officers Verification
  if (!issue.officers) {
    errors.push('Eksik Alan: officers nesnesi eksik');
  } else {
    for (const [key, expectedVal] of Object.entries(EXPECTED_OFFICERS)) {
      if (issue.officers[key] !== expectedVal) {
        errors.push(`Yönetici Hatası (${key}): "${issue.officers[key]}", beklenen: "${expectedVal}"`);
      }
    }
    if (!Array.isArray(issue.officers.bulletinCommittee) || issue.officers.bulletinCommittee.length < 2) {
      errors.push('Bülten Komitesi Hatası: En az 2 komite üyesi tanımlanmalıdır');
    }
  }

  // 6. President Message & Photo Verification
  if (!issue.presidentMessage || !issue.presidentMessage.title || !issue.presidentMessage.body) {
    errors.push('Başkanın Mesajı Hatası: title veya body eksik');
  } else {
    const photoPath = resolveAssetPath(issue.presidentMessage.photo);
    if (!photoPath || !fs.existsSync(photoPath)) {
      errors.push(`Fotoğraf Bulunamadı (Başkan): "${issue.presidentMessage.photo}" -> ${photoPath}`);
    }
  }

  // 7. Articles & Photos Verification
  if (!Array.isArray(issue.articles) || issue.articles.length === 0) {
    errors.push('Haber Hatası: articles dizisi boş veya tanımlanmamış');
  } else {
    issue.articles.forEach((art, idx) => {
      if (!art.title || !art.summary || !art.layout) {
        errors.push(`Haber #${idx + 1} (${art.id || 'isimsiz'}) Eksik Bilgi: title, summary veya layout eksik`);
      }
      const allowedLayouts = ['single-col', 'two-col', 'bento-3', 'bento-4'];
      if (!allowedLayouts.includes(art.layout)) {
        errors.push(`Haber #${idx + 1} Geçersiz Layout: "${art.layout}". İzin verilenler: ${allowedLayouts.join(', ')}`);
      }
      if (Array.isArray(art.photos)) {
        art.photos.forEach((ph, pIdx) => {
          const phPath = resolveAssetPath(ph.url);
          if (!phPath || !fs.existsSync(phPath)) {
            errors.push(`Haber #${idx + 1} Foto #${pIdx + 1} Bulunamadı: "${ph.url}" -> ${phPath}`);
          }
        });
      }
    });
  }

  // 8. Culture & Book Verification
  const expectedBook = EXPECTED_BOOKS[issue.id];
  if (!issue.culture || !issue.culture.book) {
    errors.push('Kültür Köşesi Hatası: culture veya book nesnesi eksik');
  } else {
    const book = issue.culture.book;
    if (expectedBook) {
      if (!book.author || !book.author.toLowerCase().includes(expectedBook.author.toLowerCase())) {
        errors.push(`Kitap Yazarı Uyuşmazlığı: "${book.author}", içermeli: "${expectedBook.author}"`);
      }
      if (!book.title || !book.title.toLowerCase().includes(expectedBook.title.toLowerCase())) {
        errors.push(`Kitap Başlığı Uyuşmazlığı: "${book.title}", içermeli: "${expectedBook.title}"`);
      }
    }
    const coverPath = resolveAssetPath(book.cover);
    if (!coverPath || !fs.existsSync(coverPath)) {
      errors.push(`Kitap Kapağı Bulunamadı: "${book.cover}" -> ${coverPath}`);
    }
  }

  // 9. Back Cover Polio Verification
  if (!issue.backCover) {
    errors.push('Arka Kapak Hatası: backCover nesnesi eksik');
  } else {
    if (issue.backCover.theme !== POLIO_THEME) {
      errors.push(`Arka Kapak Teması Hatası: "${issue.backCover.theme}", kesinlikle "${POLIO_THEME}" olmalıdır`);
    }
    if ((issue.backCover.color || '').toUpperCase() !== POLIO_CRIMSON.toUpperCase()) {
      errors.push(`Arka Kapak Rengi Hatası: "${issue.backCover.color}", "${POLIO_CRIMSON}" olmalıdır`);
    }
  }

  return {
    filename,
    passed: errors.length === 0,
    errors,
    warnings
  };
}

export function runValidation() {
  console.log('=====================================================');
  console.log('Galata Rotary Bülten Stüdyosu — Bülten Doğrulayıcı');
  console.log('Kurumsal Standart: 2026–2027 "KALICI ETKİ YARAT"');
  console.log('=====================================================\n');

  let allPassed = true;
  let totalErrors = 0;

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`✗ HATA: data/issues dizini bulunamadı: ${DATA_DIR}`);
    process.exit(1);
  }

  for (const filename of REQUIRED_ISSUES) {
    console.log(`[İNCELENİYOR] ${filename}...`);
    const result = validateIssue(filename);
    if (result.passed) {
      console.log(`  ✓ BAŞARILI: ${filename} kurumsal standartlara ve şemaya %100 uygundur.\n`);
    } else {
      allPassed = false;
      totalErrors += result.errors.length;
      console.error(`  ✗ BAŞARISIZ: ${filename} (${result.errors.length} hata bulundu):`);
      for (const err of result.errors) {
        console.error(`    - ${err}`);
      }
      console.log('');
    }
  }

  console.log('-----------------------------------------------------');
  if (allPassed) {
    console.log('✓ TEBRİKLER: Tüm 4 aylık bülten JSON verileri kusursuz doğrulandı!');
    console.log('  - 2026–2027 Dönem Teması "KALICI ETKİ YARAT": EKSİKSİZ');
    console.log('  - 0 "Rotary Sihri" İhlali: KANITLANDI');
    console.log('  - Türkçe Karakter Bütünlüğü: KUSURSUZ (0 mojibake)');
    console.log('  - Referans Verilen Tüm Görseller: DİSKTE MEVCUT');
    console.log('  - Arka Kapak "ÇOCUK FELCİNE SON" (#E01E26): DOĞRULANDI');
    console.log('-----------------------------------------------------');
    return 0;
  } else {
    console.error(`✗ DOĞRULAMA BAŞARISIZ OLDU: Toplam ${totalErrors} hata tespit edildi.`);
    console.log('-----------------------------------------------------');
    return 1;
  }
}

// Run CLI directly if invoked from command line
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const exitCode = runValidation();
  process.exit(exitCode);
}
