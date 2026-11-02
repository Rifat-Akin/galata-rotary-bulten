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

test('September bulletin does not assert an unsupported exact foundation day', () => {
  assert.equal(issue.club.foundationDate, 'Eylül 2003');
  assert.equal(issue.club.charterDate, '27.01.2004');
  const source = JSON.stringify(issue);
  assert.ok(!source.includes('23 Eylül 2003'), 'obsolete 23 September foundation claim');
  assert.match(issue.presidentMessage.body, /Eylül 2003.te kurulan/);
  assert.match(issue.presidentMessage.body, /23\. kuruluş yıldönümünü/);
});

test('September anniversary retrospective is distinct from dated archive captions', () => {
  const retrospective = issue.articles.find(article => article.id === 'art-05');
  assert.ok(retrospective);
  assert.equal(retrospective.date, 'Eylül 2026');
  assert.match(retrospective.summary, /Eylül 2003.te kurulan/);
  assert.equal(retrospective.photos.length, 3);
  assert.equal(retrospective.photos[2].caption, '23 Eylül 2019 Dostluk Hatırası');
  assert.match(retrospective.photos[1].caption, /13 Eylül 2014/);
});

test('A4 page text displays month-level foundation date, not contested day', () => {
  const html = renderIssueToHTML(issue);
  assert.match(html, /Kuruluş: Eylül 2003/);
  assert.doesNotMatch(html, /23 Eylül 2003/);
  assert.equal((html.match(/class="a4-page/g) || []).length, 9);
});
