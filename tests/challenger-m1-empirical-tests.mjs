/**
 * Challenger M1: Empirical Adversarial Stress Test Suite
 * 
 * Tests:
 * 1. Deep binary header and dimension verification for all extracted photos
 * 2. Adversarial "Rotary Sihri" injection across various fields
 * 3. Boundary conditions: malformed JSON, missing mandatory schema fields, invalid colors
 * 4. Turkish character encoding and mojibake rejection
 * 5. End-to-end CLI behavior of scripts/validate-issues.mjs under adversarial conditions
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'issues');
const PHOTOS_DIR = path.join(PROJECT_ROOT, 'public', 'assets', 'photos');
const BRAND_DIR = path.join(PROJECT_ROOT, 'public', 'assets', 'brand');
const VALIDATOR_PATH = path.join(PROJECT_ROOT, 'scripts', 'validate-issues.mjs');

// Parse JPEG SOF to get width and height
function parseJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return null;
  }
  let i = 2;
  while (i < buffer.length - 8) {
    if (buffer[i] !== 0xFF) {
      i++;
      continue;
    }
    const marker = buffer[i + 1];
    i += 2;
    // Markers without payload
    if (marker === 0xD8 || marker === 0xD9 || marker === 0x01 || marker === 0x00 || (marker >= 0xD0 && marker <= 0xD7)) {
      continue;
    }
    if (i + 2 > buffer.length) break;
    const segLen = buffer.readUInt16BE(i);
    // SOF markers (SOF0 - SOF15, except DHT, JPG, DAC)
    const sofMarkers = [0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF];
    if (sofMarkers.includes(marker)) {
      if (i + 8 <= buffer.length) {
        const precision = buffer.readUInt8(i + 2);
        const height = buffer.readUInt16BE(i + 3);
        const width = buffer.readUInt16BE(i + 5);
        const components = buffer.readUInt8(i + 7);
        return { precision, height, width, components };
      }
    }
    i += segLen;
  }
  return null;
}

// Find all files in a directory recursively
function getAllFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

// Run validator CLI and capture output and exit code
function runValidatorCli() {
  const res = spawnSync(process.execPath, [VALIDATOR_PATH], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8'
  });
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || ''
  };
}

// Main Test Execution
async function runAllChallengerTests() {
  console.log('========================================================================');
  console.log('  CHALLENGER M1: EMPIRICAL STRESS TEST & ADVERSARIAL ORACLE');
  console.log('========================================================================\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const findings = [];

  function testAssert(desc, condition, details = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✔ [PASS] ${desc}`);
    } else {
      failedTests++;
      console.error(`  ✖ [FAIL] ${desc}`);
      if (details) console.error(`    Detail: ${details}`);
      findings.push({ desc, details });
    }
  }

  // -------------------------------------------------------------------------
  // SUITE 1: PHOTO & BRAND ASSET INTEGRITY
  // -------------------------------------------------------------------------
  console.log('[SUITE 1] Empirical Photo & Asset Integrity Verification');
  console.log('────────────────────────────────────────────────────────────────────────');

  const photoFiles = getAllFiles(PHOTOS_DIR);
  testAssert(`Photos directory contains extracted assets (count: ${photoFiles.length})`, photoFiles.length > 50);

  let zeroByteCount = 0;
  let badHeaderCount = 0;
  let missingEoiCount = 0;
  let validDimsCount = 0;

  for (const p of photoFiles) {
    const buf = fs.readFileSync(p);
    if (buf.length === 0) {
      zeroByteCount++;
      continue;
    }
    // Check SOI
    if (buf[0] !== 0xFF || buf[1] !== 0xD8) {
      badHeaderCount++;
      continue;
    }
    // Check EOI in last 100 bytes
    const tail = buf.subarray(Math.max(0, buf.length - 100));
    let hasEoi = false;
    for (let j = 0; j < tail.length - 1; j++) {
      if (tail[j] === 0xFF && tail[j + 1] === 0xD9) {
        hasEoi = true;
        break;
      }
    }
    if (!hasEoi) {
      missingEoiCount++;
    }

    const dims = parseJpegDimensions(buf);
    if (dims && dims.width > 0 && dims.height > 0) {
      validDimsCount++;
    }
  }

  testAssert('Zero 0-byte photo files', zeroByteCount === 0, `Found ${zeroByteCount} zero-byte files`);
  testAssert('All photo files possess valid JPEG SOI markers (0xFFD8)', badHeaderCount === 0, `Found ${badHeaderCount} files with invalid SOI`);
  testAssert('All photo files contain valid EOI markers (0xFFD9)', missingEoiCount === 0, `Found ${missingEoiCount} files without EOI`);
  testAssert(`All photo files have decodable non-zero dimensions (${validDimsCount}/${photoFiles.length})`, validDimsCount === photoFiles.length);

  // Check referenced photos in all 4 issues
  const issueFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  let totalReferencedPhotos = 0;
  let missingReferencedPhotos = 0;

  for (const issueFile of issueFiles) {
    const issue = JSON.parse(fs.readFileSync(path.join(DATA_DIR, issueFile), 'utf8'));
    // president photo
    if (issue.presidentMessage?.photo) {
      totalReferencedPhotos++;
      const fullPath = path.join(PROJECT_ROOT, 'public', issue.presidentMessage.photo.replace(/^[\/\\]+/, ''));
      if (!fs.existsSync(fullPath)) missingReferencedPhotos++;
    }
    // articles photos
    if (Array.isArray(issue.articles)) {
      for (const art of issue.articles) {
        if (Array.isArray(art.photos)) {
          for (const ph of art.photos) {
            totalReferencedPhotos++;
            const fullPath = path.join(PROJECT_ROOT, 'public', ph.url.replace(/^[\/\\]+/, ''));
            if (!fs.existsSync(fullPath)) missingReferencedPhotos++;
          }
        }
      }
    }
    // book cover
    if (issue.culture?.book?.cover) {
      totalReferencedPhotos++;
      const fullPath = path.join(PROJECT_ROOT, 'public', issue.culture.book.cover.replace(/^[\/\\]+/, ''));
      if (!fs.existsSync(fullPath)) missingReferencedPhotos++;
    }
  }

  testAssert(`All referenced photos exist physically on disk (${totalReferencedPhotos} refs checked)`, missingReferencedPhotos === 0, `Missing: ${missingReferencedPhotos}`);

  // Brand assets
  const brandFiles = getAllFiles(BRAND_DIR);
  testAssert(`Brand directory contains corporate assets (count: ${brandFiles.length})`, brandFiles.length >= 8);

  console.log();

  // -------------------------------------------------------------------------
  // SUITE 2: ADVERSARIAL "Rotary Sihri" INJECTION ORACLE
  // -------------------------------------------------------------------------
  console.log('[SUITE 2] Adversarial "Rotary Sihri" Injection Oracle');
  console.log('────────────────────────────────────────────────────────────────────────');

  const baseSeptemberPath = path.join(DATA_DIR, '2026-09-eylul.json');
  const originalSeptemberContent = fs.readFileSync(baseSeptemberPath, 'utf8');

  // Helper to run validator with temporary mutation of 2026-09-eylul.json
  function testAdversarialMutation(name, mutateFn, shouldFail, expectedErrorSubstr) {
    try {
      const baseObj = JSON.parse(originalSeptemberContent);
      const mutatedObj = mutateFn(baseObj);
      const mutatedText = typeof mutatedObj === 'string' ? mutatedObj : JSON.stringify(mutatedObj, null, 2);
      fs.writeFileSync(baseSeptemberPath, mutatedText, 'utf8');

      const res = runValidatorCli();
      const failed = res.status !== 0;
      const hasExpectedError = expectedErrorSubstr ? (res.stderr + res.stdout).includes(expectedErrorSubstr) : true;

      testAssert(
        `Veto on: ${name}`,
        shouldFail ? (failed && hasExpectedError) : (!failed),
        `Exit: ${res.status}, Output: ${(res.stderr + res.stdout).trim()}`
      );
    } finally {
      fs.writeFileSync(baseSeptemberPath, originalSeptemberContent, 'utf8');
    }
  }

  // 1. Injected into theme
  testAdversarialMutation('theme set to "Rotary Sihri"', obj => {
    obj.theme = 'Rotary Sihri';
    return obj;
  }, true, 'Yasaklı tema ifadesi bulundu: "Rotary Sihri"');

  // 2. Injected into presidentMessage.body
  testAdversarialMutation('presidentMessage.body poisoned with "Rotary Sihri"', obj => {
    obj.presidentMessage.body += ' Bu sene Rotary Sihri ile yola çıkıyoruz.';
    return obj;
  }, true, 'Yasaklı tema ifadesi bulundu: "Rotary Sihri"');

  // 3. Injected into articles[0].title
  testAdversarialMutation('article title poisoned with "Rotary Sihri"', obj => {
    obj.articles[0].title = 'Rotary Sihri ile Buluşma';
    return obj;
  }, true, 'Yasaklı tema ifadesi bulundu: "Rotary Sihri"');

  // 4. Injected into articles[0].summary
  testAdversarialMutation('article summary poisoned with "Rotary Sihri"', obj => {
    obj.articles[0].summary += ' Rotary Sihri kulübümüzü aydınlatıyor.';
    return obj;
  }, true, 'Yasaklı tema ifadesi bulundu: "Rotary Sihri"');

  // 5. Injected into culture.book.summary
  testAdversarialMutation('culture book summary poisoned with "Rotary Sihri"', obj => {
    obj.culture.book.summary += ' Kitap Rotary Sihri temasını inceliyor.';
    return obj;
  }, true, 'Yasaklı tema ifadesi bulundu: "Rotary Sihri"');

  // 6. Injected into backCover.subTheme
  testAdversarialMutation('backCover.subTheme poisoned with "Rotary Sihri"', obj => {
    obj.backCover.subTheme = 'Rotary Sihri';
    return obj;
  }, true, 'Yasaklı tema ifadesi bulundu: "Rotary Sihri"');

  // 7. Injected as arbitrary JSON property
  testAdversarialMutation('Arbitrary key poisoned with "Rotary Sihri"', obj => {
    obj.adversarial_token = 'Rotary Sihri';
    return obj;
  }, true, 'Yasaklı tema ifadesi bulundu: "Rotary Sihri"');

  // 8. Adversarial Challenge: Lowercase "rotary sihri" inside article summary
  // We empirically check if the current validator catches lowercase or if it's case-sensitive
  {
    try {
      const baseObj = JSON.parse(originalSeptemberContent);
      baseObj.articles[0].summary += ' bu donem rotary sihri yerine kalıcı etki yaratıyoruz.';
      fs.writeFileSync(baseSeptemberPath, JSON.stringify(baseObj, null, 2), 'utf8');
      const res = runValidatorCli();
      const failed = res.status !== 0;
      if (!failed) {
        console.log('  ⚠️ [NOTE: Blind Spot Discovered] validate-issues.mjs checks exact "Rotary Sihri" case; lowercase "rotary sihri" in body text passed without error.');
        findings.push({
          desc: 'Adversarial Case Variation: Lowercase "rotary sihri" in body text',
          details: 'validate-issues.mjs currently checks rawText.includes("Rotary Sihri") (case-sensitive). If someone types lowercase "rotary sihri" in an article summary, it bypasses the forbidden theme filter.'
        });
      } else {
        console.log('  ✔ [PASS] Lowercase "rotary sihri" was rejected.');
      }
    } finally {
      fs.writeFileSync(baseSeptemberPath, originalSeptemberContent, 'utf8');
    }
  }

  console.log();

  // -------------------------------------------------------------------------
  // SUITE 3: BOUNDARY CONDITIONS & JSON SCHEMA STRESS TESTS
  // -------------------------------------------------------------------------
  console.log('[SUITE 3] Boundary Conditions & Schema Violation Oracle');
  console.log('────────────────────────────────────────────────────────────────────────');

  // A. Malformed JSON
  testAdversarialMutation('Malformed JSON (broken syntax)', () => {
    return '{ "id": "2026-09-eylul", "unclosed_string: ';
  }, true, 'JSON Ayrıştırma Hatası');

  // B. Missing mandatory fields
  testAdversarialMutation('Missing theme field', obj => {
    delete obj.theme;
    return obj;
  }, true, 'Tema Uyuşmazlığı');

  testAdversarialMutation('Wrong rotaryYear ("2025-2026")', obj => {
    obj.rotaryYear = '2025-2026';
    return obj;
  }, true, 'Dönem Uyuşmazlığı');

  testAdversarialMutation('Missing rotaryMonthTheme', obj => {
    delete obj.rotaryMonthTheme;
    return obj;
  }, true, 'Eksik Alan: rotaryMonthTheme');

  testAdversarialMutation('Missing club object', obj => {
    delete obj.club;
    return obj;
  }, true, 'Eksik Alan: club nesnesi eksik');

  testAdversarialMutation('Invalid club.clubNo ("99999")', obj => {
    obj.club.clubNo = '99999';
    return obj;
  }, true, 'Kulüp No Hatası');

  testAdversarialMutation('Missing officers object', obj => {
    delete obj.officers;
    return obj;
  }, true, 'Eksik Alan: officers nesnesi eksik');

  testAdversarialMutation('Wrong officer (riPresident)', obj => {
    obj.officers.riPresident = 'Wrong Person';
    return obj;
  }, true, 'Yönetici Hatası (riPresident)');

  testAdversarialMutation('Insufficient bulletin committee (<2 members)', obj => {
    obj.officers.bulletinCommittee = ['Single Member'];
    return obj;
  }, true, 'Bülten Komitesi Hatası');

  testAdversarialMutation('Missing presidentMessage object', obj => {
    delete obj.presidentMessage;
    return obj;
  }, true, 'Başkanın Mesajı Hatası');

  testAdversarialMutation('Non-existent president photo', obj => {
    obj.presidentMessage.photo = 'assets/photos/non_existent_baskan_99999.jpg';
    return obj;
  }, true, 'Fotoğraf Bulunamadı (Başkan)');

  testAdversarialMutation('Empty articles array', obj => {
    obj.articles = [];
    return obj;
  }, true, 'Haber Hatası: articles dizisi boş');

  testAdversarialMutation('Invalid article layout ("bento-99")', obj => {
    obj.articles[0].layout = 'bento-99';
    return obj;
  }, true, 'Geçersiz Layout: "bento-99"');

  testAdversarialMutation('Article referencing missing photo', obj => {
    obj.articles[0].photos = [{ url: 'assets/photos/2026-09/fake_non_existent.jpg' }];
    return obj;
  }, true, 'Foto #1 Bulunamadı');

  testAdversarialMutation('Missing culture object', obj => {
    delete obj.culture;
    return obj;
  }, true, 'Kültür Köşesi Hatası');

  testAdversarialMutation('Wrong book author', obj => {
    obj.culture.book.author = 'Wrong Author';
    return obj;
  }, true, 'Kitap Yazarı Uyuşmazlığı');

  testAdversarialMutation('Missing book cover image', obj => {
    obj.culture.book.cover = 'assets/photos/non_existent_book_cover.jpg';
    return obj;
  }, true, 'Kitap Kapağı Bulunamadı');

  // C. Invalid Colors & Back Cover
  testAdversarialMutation('Missing backCover object', obj => {
    delete obj.backCover;
    return obj;
  }, true, 'Arka Kapak Hatası');

  testAdversarialMutation('Wrong backCover theme (not "ÇOCUK FELCİNE SON")', obj => {
    obj.backCover.theme = 'Wrong Theme';
    return obj;
  }, true, 'Arka Kapak Teması Hatası');

  testAdversarialMutation('Invalid backCover color ("#000000" black)', obj => {
    obj.backCover.color = '#000000';
    return obj;
  }, true, 'Arka Kapak Rengi Hatası');

  testAdversarialMutation('Invalid backCover color ("red" non-hex)', obj => {
    obj.backCover.color = 'red';
    return obj;
  }, true, 'Arka Kapak Rengi Hatası');

  console.log();

  // -------------------------------------------------------------------------
  // SUITE 4: TURKISH TYPOGRAPHY & MOJIBAKE REJECTION
  // -------------------------------------------------------------------------
  console.log('[SUITE 4] Turkish Typography & Mojibake Rejection');
  console.log('────────────────────────────────────────────────────────────────────────');

  const mojibakeSamples = ['Ã§', 'Ã¼', 'ÅŸ', 'Ã¶', 'ÄŸ', 'Ä±', 'ï¿½'];
  for (const bad of mojibakeSamples) {
    testAdversarialMutation(`Mojibake rejection: "${bad}"`, obj => {
      obj.articles[0].title += ` ${bad}`;
      return obj;
    }, true, 'Mojibake / bozuk karakter bulundu');
  }

  // Verify valid Turkish characters are accepted
  testAdversarialMutation('Valid Turkish characters (ç, ğ, ı, ö, ş, ü, Ç, Ğ, İ, Ö, Ş, Ü) are accepted', obj => {
    obj.articles[0].title += ' Çocuğun Işığı Öğretmenin Şiiri Ümit';
    return obj;
  }, false);

  console.log();

  // -------------------------------------------------------------------------
  // SUITE 5: RE-VERIFY CLEAN PROJECT STATE
  // -------------------------------------------------------------------------
  console.log('[SUITE 5] Clean Project Verification');
  console.log('────────────────────────────────────────────────────────────────────────');
  const cleanRes = runValidatorCli();
  testAssert('Clean project passes validate-issues.mjs with exit code 0', cleanRes.status === 0);

  console.log('\n========================================================================');
  console.log('  CHALLENGER STRESS TEST SUMMARY');
  console.log('========================================================================');
  console.log(`  Total Evaluated Assertions : ${totalTests}`);
  console.log(`  Passed                     : ${passedTests}`);
  console.log(`  Failed                     : ${failedTests}`);
  console.log(`  Discovered Blind Spots     : ${findings.length}`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    console.error(`STATUS: FAILED (${failedTests} assertion(s) failed)`);
    process.exit(1);
  } else {
    console.log('STATUS: PASSED (All adversarial stress assertions confirmed)');
    process.exit(0);
  }
}

runAllChallengerTests().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
