import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderIssueToHTML} from '../public/renderer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/issues/index.json'), 'utf8'));
const stylesheet = fs.readFileSync(path.join(root, 'public/styles/bulletin-print.css'), 'utf8');
const studio = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const printer = fs.readFileSync(path.join(root, 'scripts/chrome-cdp-print.mjs'), 'utf8');

function htmlEscape(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function block(selector) {
  const index = stylesheet.indexOf(selector + ' {');
  assert.ok(index !== -1, 'CSS selector missing: ' + selector);
  return stylesheet.slice(index, stylesheet.indexOf('}', index) + 1);
}

for (const issueMeta of catalog) {
  test(issueMeta.id + ': edition contents reflect actual articles and print page count', () => {
    const issue = JSON.parse(fs.readFileSync(path.join(root, 'data/issues', issueMeta.id + '.json'), 'utf8'));
    const html = renderIssueToHTML(issue, {fullDoc: true});
    const pages = html.match(/<article class="a4-page/g) || [];
    assert.equal(pages.length, issueMeta.pageCount, 'must preserve accepted official pagination');
    assert.equal(html.includes('styles/bulletin-print.css?v=20261101-editorial6'), true,
      'full-document print CSS must be cache-busted');
    assert.match(html, /class="culture-watermark"/,
      'culture pages must use a clear non-stretched decorative ending');
    const indexBlock = /<ol class="cover-contents-list">([\s\S]*?)<\/ol>/.exec(html);
    assert.ok(indexBlock, 'cover must include a source-derived table of contents');
    assert.equal((indexBlock[1].match(/<li>/g) || []).length, issue.articles.length,
      'every article must appear in the cover index exactly once');
    for (const article of issue.articles) {
      assert.ok(indexBlock[1].includes(htmlEscape(article.title)),
        'missing original article title from cover: ' + article.title);
      for (const photo of article.photos || []) {
        if (photo.caption) {
          assert.ok(html.includes('<figcaption class="bento-caption">' + htmlEscape(photo.caption) + '</figcaption>'),
            'caption must be present in full, not truncated during HTML generation');
        }
      }
    }
  });
}

test('article photos and book covers do not crop source images', () => {
  assert.match(block('.bento-img'), /object-fit:\s*contain/);
  assert.match(block('.book-cover-img'), /object-fit:\s*contain/);
  assert.doesNotMatch(block('.bento-caption'), /white-space:\s*nowrap/);
  assert.match(block('.bento-caption'), /position:\s*static/);
  for (const cls of ['.single-col', '.two-col', '.bento-3', '.bento-4']) {
    assert.match(block(cls), /height:\s*100%/, cls + ' must fill the allocated page media area');
  }
});

test('typography, culture features and cache version are designed for readable A4', () => {
  assert.match(block('.article-title'), /font-size:\s*15pt/);
  assert.match(block('.article-summary'), /font-size:\s*9\.4pt/);
  assert.match(block('.book-cover-img'), /height:\s*70mm/);
  assert.match(block('.announcement-box-content'), /font-size:\s*8\.8pt/);
  assert.match(block('.culture-page-grid .announcements-grid'), /flex:\s*0 0 auto/);
  assert.match(block('.culture-watermark img'), /object-fit:\s*contain/);
  assert.match(studio, /styles\/bulletin-print\.css\?v=20261101-editorial6/);
  assert.match(studio, /styles\/studio\.css\?v=20261101-editorial6/);
});

test('CDP printer rejects clipped gallery captions, cropped photos and empty media area', () => {
  assert.match(printer, /Visual layout acceptance failed/);
  assert.match(printer, /Article gallery leaves most of its page blank/);
  assert.match(printer, /A photo caption is visibly clipped/);
  assert.match(printer, /Article photo uses a cropping object-fit/);
  assert.match(printer, /Cover index and article count differ/);
  assert.match(printer, /A4 page overflow detected/);
});