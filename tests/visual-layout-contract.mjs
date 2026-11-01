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
  // Match the entire selector line: ".bento-caption" must not accidentally
  // pick up an earlier ".editorial-duo .bento-caption" override.
  const lines = stylesheet.split('\n');
  const start = lines.findIndex(line => line.trim() === selector + ' {');
  assert.ok(start !== -1, 'CSS selector missing: ' + selector);
  const endOffset = lines.slice(start).findIndex(line => line.trim() === '}');
  assert.ok(endOffset !== -1, 'CSS closing brace missing: ' + selector);
  return lines.slice(start, start + endOffset + 1).join('\n');
}

for (const issueMeta of catalog) {
  test(issueMeta.id + ': edition contents reflect actual articles and print page count', () => {
    const issue = JSON.parse(fs.readFileSync(path.join(root, 'data/issues', issueMeta.id + '.json'), 'utf8'));
    const html = renderIssueToHTML(issue, {fullDoc: true});
    const pages = html.match(/<article class="a4-page/g) || [];
    assert.equal(pages.length, issueMeta.pageCount, 'must preserve accepted official pagination');
    assert.equal(html.includes('styles/bulletin-print.css?v=20261102-photo10'), true,
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
  for (const cls of ['.single-col', '.editorial-duo', '.bento-3', '.bento-4']) {
    assert.match(block(cls), /height:\s*100%/, cls + ' must fill the allocated page media area');
  }
});

test('September issue 3 page 3 has an asymmetric editorial photo story', () => {
  const issue = JSON.parse(fs.readFileSync(
    path.join(root, 'data/issues/2026-09-eylul.json'), 'utf8'));
  const html = renderIssueToHTML(issue, {fullDoc: false});
  const pageThreeStart = html.indexOf('data-page-index="3"');
  const pageFourStart = html.indexOf('data-page-index="4"');
  const pageThree = html.slice(pageThreeStart, pageFourStart);
  assert.ok(pageThreeStart !== -1 && pageFourStart > pageThreeStart);
  assert.match(pageThree, /class="editorial-duo"/);
  assert.doesNotMatch(pageThree, /class="two-col"/);
  assert.equal((pageThree.match(/class="bento-img"/g) || []).length, 2);
  assert.ok(pageThree.includes('00005281.jpg'));
  assert.ok(pageThree.includes('00005340.jpg'));
  assert.match(block('.editorial-duo'), /grid-template-columns:\s*minmax\(0, 1\.6fr\) minmax\(0, 0\.8fr\)/);
  assert.match(block('.editorial-duo .bento-photo-card'), /background:\s*transparent/);
  assert.match(block('.editorial-duo .bento-img'), /object-fit:\s*contain/);
  assert.match(block('.editorial-duo .bento-caption'), /overflow-wrap:\s*break-word/);
});

test('studio photo layout selector matches the actual preview and updates as photos change', () => {
  const controller = fs.readFileSync(path.join(root, 'public/studio.js'), 'utf8');
  assert.match(controller, /data-layout="editorial-duo"/,
    'two-photo selector must invoke the actual editorial-duo renderer');
  assert.doesNotMatch(controller, /İki Eşit Fotoğraf Kolonu/,
    'the editor must not advertise the rejected 50\/50 split');
  assert.match(controller, /Ana \+ Destek/,
    'describe the visual hierarchy rather than a technical column count');
  assert.match(controller, /function defaultPhotoLayout\(count\)/,
    'photo add/delete must update the chosen gallery layout');
  assert.match(controller, /setArticleLayoutControls\(card, currentIssue\.articles\[artIdx\]\.layout\)/);
});

test('legacy one-photo overrides no longer create an empty second column', () => {
  const july = JSON.parse(fs.readFileSync(
    path.join(root, 'data/issues/2026-07-temmuz.json'), 'utf8'));
  const html = renderIssueToHTML(july);
  const cards = html.split('<section class="article-card ');
  // July article 1 is stored with legacy layout=two-col but owns one photo.
  assert.match(cards[1], /class="single-col"/);
  assert.doesNotMatch(cards[1], /class="two-col"/);
});

test('four-photo spreads prioritize documentary photography without changing originals', () => {
  const issue = JSON.parse(fs.readFileSync(
    path.join(root, 'data/issues/2026-09-eylul.json'), 'utf8'));
  const photoUrls = issue.articles[1].photos.map(p => p.url);
  const html = renderIssueToHTML(issue);
  const pageFour = html.slice(html.indexOf('data-page-index="4"'), html.indexOf('data-page-index="5"'));
  assert.match(pageFour, /class="bento-4"/);
  const imageMatches = [...pageFour.matchAll(/<img src="([^"]+)"[^>]*class="bento-img"/g)]
    .map(m => m[1]);
  assert.deepEqual(new Set(imageMatches), new Set(photoUrls));
  assert.equal(imageMatches.length, 4);
  assert.ok(imageMatches[0].endsWith('00005290.jpg'),
    'the actual meeting photo should lead, not a mobile screenshot');
  assert.match(block('.bento-4'), /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(block('.bento-4 .bento-photo-card:first-child'), /grid-column:\s*1 \/ -1/);
});

test('typography, culture features and cache version are designed for readable A4', () => {
  assert.match(block('.article-title'), /font-size:\s*15pt/);
  assert.match(block('.article-summary'), /font-size:\s*9\.4pt/);
  assert.match(block('.book-cover-img'), /height:\s*70mm/);
  assert.match(block('.announcement-box-content'), /font-size:\s*8\.8pt/);
  assert.match(block('.culture-page-grid .announcements-grid'), /flex:\s*0 0 auto/);
  assert.match(block('.culture-watermark img'), /object-fit:\s*contain/);
  assert.match(studio, /styles\/bulletin-print\.css\?v=20261102-photo10/);
  assert.match(studio, /styles\/studio\.css\?v=20261102-ui9/);
});

test('Pages uses cache-versioned modules and officially downloaded PDFs', () => {
  const controller = fs.readFileSync(path.join(root, 'public/studio.js'), 'utf8');
  const tag = '20261102-photo10';
  assert.ok(studio.includes('src="renderer.js?v=' + tag + '"'),
    'renderer module must bypass cached pre-release JavaScript');
  assert.ok(studio.includes('src="studio.js?v=20261102-photo10"'),
    'editor controller must bypass cached pre-release JavaScript');
  assert.ok(controller.includes("const PUBLIC_RELEASE_TAG = '" + tag + "'"),
    'official PDF cache revision should match the visible JavaScript release');
  assert.ok(controller.includes("'output/' + officialPdfName + '?v=' + PUBLIC_RELEASE_TAG"),
    'direct PDF downloads must bypass stale browser cache');
});

test('responsive UI includes named touch actions, visible tabs, modal focus, and reader zoom', () => {
  const shell = fs.readFileSync(path.join(root, 'public/styles/studio.css'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'public/studio.js'), 'utf8');
  assert.match(shell, /Mobile compact action drawer/);
  assert.match(shell, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(shell, /\.zoom-btn-group \.zoom-chip\[data-zoom="1\.0"\]/);
  assert.match(shell, /\.studio-header-actions\.expanded \.mobile-secondary-action/);
  assert.match(studio, /id="btn-more-actions"/);
  assert.match(studio, /aria-controls="studio-header-actions"/);
  assert.match(studio, /id="modal-new-issue" class="modal-overlay" aria-hidden="true"/);
  assert.match(studio, /role="dialog" aria-modal="true"/);
  assert.match(studio, /for="inp-issue-number"/);
  assert.match(studio, /for="new-issue-month"/);
  assert.match(controller, /function handleNewIssueModalKeydown/);
  assert.match(controller, /needsHorizontalPan/);
});

test('desktop split preview toolbar keeps zoom and refresh reachable; reader controls get a second row', () => {
  const shell = fs.readFileSync(path.join(root, 'public/styles/studio.css'), 'utf8');
  assert.match(shell, /desktop split view had a 1,160px/);
  assert.match(shell, /body:not\(\.mode-reader-active\) #reader-navigation-bar\s*\{ display: none; \}/);
  assert.match(shell, /body:not\(\.mode-reader-active\) \.zoom-slider-container\s*\{ display: none; \}/);
  assert.match(shell, /body\.mode-reader-active \.zoom-toolbar\s*\{[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(shell, /body\.mode-reader-active #reader-navigation-bar\s*\{[\s\S]*?flex:\s*1 1 auto/);
});

test('CDP printer rejects clipped gallery captions, cropped photos and empty media area', () => {
  assert.match(printer, /Visual layout acceptance failed/);
  assert.match(printer, /Article gallery leaves most of its page blank/);
  assert.match(printer, /A photo caption is visibly clipped/);
  assert.match(printer, /Article photo uses a cropping object-fit/);
  assert.match(printer, /Cover index and article count differ/);
  assert.match(printer, /A4 page overflow detected/);
});