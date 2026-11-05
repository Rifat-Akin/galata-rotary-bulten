import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIssueToHTML } from '../public/renderer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const issue = JSON.parse(fs.readFileSync(
  path.join(root, 'data/issues/2026-09-eylul.json'), 'utf8'
));

test('September bulletin follows explicitly selected 1000th meeting source', () => {
  assert.equal(issue.club.foundationDate, '03.09.2003');
  assert.equal(issue.club.charterDate, '27.01.2004');
  const source = JSON.stringify(issue);
  assert.ok(!source.includes('23 Eylül 2003'), 'obsolete 23 September foundation claim');
  assert.match(issue.presidentMessage.body, /3 Eylül 2003.te kurulan/);
  assert.match(issue.presidentMessage.body, /23\. kuruluş yıldönümünü/);
});

test('September anniversary retrospective is distinct from dated archive captions', () => {
  const retrospective = issue.articles.find(article => article.id === 'art-05');
  assert.ok(retrospective);
  assert.equal(retrospective.date, 'Eylül 2026');
  assert.match(retrospective.summary, /3 Eylül 2003.te kurulan/);
  assert.equal(retrospective.photos.length, 3);
  assert.equal(retrospective.photos[2].caption, '23 Eylül 2019 Dostluk Hatırası');
  assert.match(retrospective.photos[1].caption, /13 Eylül 2014/);
});

test('A4 page text displays accepted precise foundation date', () => {
  const html = renderIssueToHTML(issue);
  assert.match(html, /Kuruluş: 03\.09\.2003/);
  assert.doesNotMatch(html, /23 Eylül 2003/);
  assert.equal((html.match(/class="a4-page/g) || []).length, 9);
});


test('all archived issue metadata and new-issue defaults agree with the 1000th meeting source', () => {
  for (const id of ['2026-07-temmuz', '2026-08-agustos', '2026-09-eylul', '2026-10-ekim']) {
    const current = JSON.parse(fs.readFileSync(
      path.join(root, 'data/issues', id + '.json'), 'utf8'));
    assert.equal(current.club.foundationDate, '03.09.2003', id);
    assert.equal(current.club.charterDate, '27.01.2004', id);
  }
  for (const file of ['server.mjs', 'public/renderer.js', 'tests/fixtures/mock-issues.mjs']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(source.includes('03.09.2003'), file);
    assert.ok(!source.includes('02.09.2003'), file);
  }
  const validator = fs.readFileSync(path.join(root, 'scripts/validate-issues.mjs'), 'utf8');
  assert.match(validator, /foundationDate !== '03\\.09\\.2003'/);
});
