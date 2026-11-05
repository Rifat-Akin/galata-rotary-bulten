import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {draftPdfFilename} from '../public/pdf-download.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('download filename is predictable and never overwrites a published PDF by accident', () => {
  assert.equal(draftPdfFilename({id:'2026-11-kasim',issueNumber:5}),
    'Galata_Rotary_Bulten_2026_11_Kasim_Sayi_5.pdf');
  assert.equal(draftPdfFilename({id:'2026-09-eylul',issueNumber:3}),
    'Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf');
  assert.throws(() => draftPdfFilename({id:'../oops',issueNumber:1}), /geçerli/);
  assert.throws(() => draftPdfFilename({id:'2026-11-kasim',issueNumber:0}), /Geçerli/);
});

test('browser PDF libraries are vendored, pinned and no vulnerable legacy jsPDF is shipped', () => {
  const html = read('public/vendor/html2canvas-1.4.1.min.js');
  const pdf = read('public/vendor/jspdf-4.2.1.umd.min.js');
  assert.match(html.slice(0,250), /html2canvas 1.4.1/);
  assert.match(pdf.slice(0,250), /Version 4\.2\.1/);
  assert.ok(html.length > 180_000 && pdf.length > 400_000);
  assert.ok(!fs.existsSync(path.join(root,'public/vendor/jspdf-2.5.1.umd.min.js')));
});

test('edited monthly PDF is created without a publishing endpoint', () => {
  const module = read('public/pdf-download.js');
  const controller = read('public/studio.js');
  const index = read('public/index.html');
  assert.match(module, /export async function buildDraftPdf/);
  assert.match(module, /const blob = documentPdf\.output\('blob'\)/);
  assert.match(module, /Bültende yüklenemeyen fotoğraf/);
  assert.match(module, /Sayfa .* A4 sınırını aşıyor/);
  assert.match(module, /stage\.remove\(\)/);
  assert.match(controller, /offerGeneratedPdf\(result\)/);
  assert.match(controller, /activeRuntimeMode === 'static'/);
  assert.match(controller, /invalidatePdfReadyLink\(\)/);
  assert.match(controller, /'PDF İndir'/);
  assert.match(index, /id="pdf-download-ready"/);
  assert.match(index, /studio\.js\?v=20261105-monthly15/);
});
