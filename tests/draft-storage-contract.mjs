import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');

test('durable on-device store has verified transactions and no network sync',()=>{
  const store=file('public/draft-store.js');
  assert.match(store,/indexedDB\.open\(DB, 1\)/);
  assert.match(store,/async get\(id\)/);
  assert.match(store,/async put\(issue\)/);
  assert.match(store,/async list\(\)/);
  assert.match(store,/async remove\(id\)/);
  assert.doesNotMatch(store,/\bfetch\s*\(/);
});
test('drafts never delete older localStorage data before read-back',()=>{
  const studio=file('public/studio.js');
  assert.match(studio,/JSON\.stringify\(verified\) === JSON\.stringify\(legacy\)/);
  assert.match(studio,/JSON\.stringify\(readBack\) !== JSON\.stringify\(issue\)/);
  assert.match(studio,/await saveStoredDraft\(draft\)/);
  assert.match(studio,/const existingDraft = await readStoredDraft\(currentIssue\.id\)/);
  assert.match(studio,/restoreJsonBackup\(file\)/);
  assert.match(studio,/downloadJSON\(current, issue\.id \+ '-onceki-taslak-yedek\.json'\)/);
});
test('new monthly issue PDF stays separate from indexed storage',()=>{
  const index=file('public/index.html');
  const pdf=file('public/pdf-download.js');
  assert.match(index,/draft-store\.js\?v=20261105-drafts16/);
  assert.match(index,/id="btn-import-json"/);
  assert.match(index,/id="inp-import-json"/);
  assert.match(index,/studio\.js\?v=20261105-drafts16/);
  assert.match(index,/Metinli PDF \/ Yazdır/);
  assert.match(pdf,/export async function buildDraftPdf/);
  assert.doesNotMatch(pdf,/fetch\('/);
});
test('photos are optimized only on upload while preserving offline fallback',()=>{
  const studio=file('public/studio.js');
  assert.match(studio,/await createImageBitmap\(file\)/);
  assert.match(studio,/1920 \/ Math\.max\(bitmap\.width, bitmap\.height\)/);
  assert.match(studio,/canvas\.toDataURL\('image\/webp', 0\.84\)/);
  assert.match(studio,/reader\.readAsDataURL\(file\)/);
  assert.match(studio,/async function saveStoredDraft\(issue\)/);
  assert.match(studio,/draftAutoSaveTimer = setTimeout\(async/);
});
