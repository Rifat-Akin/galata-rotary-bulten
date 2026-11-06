import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderIssueToHTML, resolveLeadPhotoIndex} from '../public/renderer.js';

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
    assert.equal(html.includes('styles/bulletin-print.css?v=20261105-monthly15'), true,
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
    assert.match(block(cls), /height:\s*auto/, cls + ' avoids padded image boxes and empty filler');
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
  assert.match(block('.editorial-duo'), /grid-template-columns:\s*minmax\(0, 1\.65fr\) minmax\(0, 1fr\)/);
  assert.match(block('.editorial-duo .bento-photo-card'), /background:\s*transparent/);
  assert.match(block('.editorial-duo .bento-img'), /object-fit:\s*contain/);
  assert.match(block('.editorial-duo .bento-caption'), /overflow-wrap:\s*break-word/);
  assert.match(block('.editorial-duo'), /align-content:\s*start/);
  assert.match(block('.editorial-duo .bento-photo-card:not(:first-child)'), /transform:\s*none/);
  assert.match(block('.bento-3 .bento-photo-card:first-child'), /grid-column:\s*1 \/ -1/);
  assert.match(block('.bento-4'), /grid-template-rows:\s*max-content max-content/);
  assert.match(block('.article-card.compact .single-col .bento-img'), /max-height:\s*58mm/,
    'two stories on one A4 must have half-page photo budgets');
  for (const sel of ['.single-col .bento-img', '.bento-3 .bento-img', '.bento-4 .bento-img']) {
    assert.match(block(sel), /height:\s*auto/);
    assert.match(block(sel), /object-fit:\s*contain/);
  }
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
  assert.match(studio, /styles\/bulletin-print\.css\?v=20261105-monthly15/);
  assert.match(studio, /styles\/studio\.css\?v=20261105-monthly15/);
});

test('Pages uses cache-versioned modules and officially downloaded PDFs', () => {
  const controller = fs.readFileSync(path.join(root, 'public/studio.js'), 'utf8');
  const tag = '20261105-monthly15';
  assert.ok(studio.includes('src="renderer.js?v=' + tag + '"'),
    'renderer module must bypass cached pre-release JavaScript');
  assert.ok(studio.includes('src="studio.js?v=20261107-autosave17"'),
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
  assert.match(shell, /Mobile\/tablet: use one natural document scroller/);
  assert.match(shell, /overflow-y:\s*auto !important/);
  assert.match(shell, /body:not\(\.mode-reader-active\) \.editor-pane/);
  assert.match(shell, /\.editor-tabs-bar\s*\{\s*position:\s*sticky/);
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
  assert.match(printer, /Article gallery contains uncentered or invalid photo frames/);
  assert.match(printer, /Article gallery photo row edges are misaligned/);
  assert.match(printer, /A photo caption is visibly clipped/);
  assert.match(printer, /Article photo uses a cropping object-fit/);
  assert.match(printer, /Cover index and article count differ/);
  assert.match(printer, /A4 page overflow detected/);
});
test('an explicit lead photo wins without reordering archived original photographs', () => {
  const issue = JSON.parse(fs.readFileSync(
    path.join(root, 'data/issues/2026-09-eylul.json'), 'utf8'));
  const article = issue.articles[1];
  const originalOrder = article.photos.map(photo => photo.url);
  const editorialDefault = resolveLeadPhotoIndex(article);
  assert.equal(article.photos[editorialDefault].url.endsWith('00005290.jpg'), true);
  article.leadPhotoIndex = 0;
  assert.equal(resolveLeadPhotoIndex(article), 0);
  const html = renderIssueToHTML(issue);
  const pageFour = html.split('data-page-index="4"')[1].split('data-page-index="5"')[0];
  const orderedImages = [...pageFour.matchAll(/<img src="([^"]+)"[^>]*class="bento-img"/g)].map(m => m[1]);
  assert.equal(orderedImages[0], originalOrder[0]);
  assert.deepEqual(new Set(orderedImages), new Set(originalOrder));
  assert.deepEqual(article.photos.map(p => p.url), originalOrder,
    'editor priority must not change canonical source order');
  article.leadPhotoIndex = 999;
  assert.equal(resolveLeadPhotoIndex(article), editorialDefault,
    'invalid selection uses curated archive default');
});

test('featured editorial hierarchy is opt-in and safe for original A4 archive', () => {
  const issue = JSON.parse(fs.readFileSync(
    path.join(root, 'data/issues/2026-09-eylul.json'), 'utf8'));
  const original = structuredClone(issue);
  delete original.articles[4].storyStyle;
  assert.doesNotMatch(renderIssueToHTML(original), /article-card\s+story-feature/);
  assert.equal(issue.articles[4].storyStyle, 'feature');
  issue.articles[0].storyStyle = 'feature';
  const html = renderIssueToHTML(issue);
  assert.match(html, /article-card\s+story-feature/);
  assert.match(block('.article-card.story-feature:not(.compact) .article-title'),
    /font-size:\s*17pt/);
  assert.equal(issue.articles[0].photos.length, 2);
});

test('monthly editor makes story appearance and featured photo controllable', () => {
  const js = fs.readFileSync(path.join(root, 'public/studio.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public/styles/studio.css'), 'utf8');
  assert.match(js, /data-action="set-lead-photo"/);
  assert.match(js, /data-action="set-story-style"/);
  assert.match(js, /refreshLeadPhotoButtons\(card, artIdx\)/);
  assert.match(js, /leadPhotoIndex -= 1/);
  assert.match(js, /photos\.length >= 4/);
  assert.match(js, /btn\.disabled = !allowed/);
  assert.match(css, /photo-lead-btn\[aria-pressed="true"\]/);
  assert.match(css, /story-style-btn\.active/);
});

test('stale imported grid hints cannot force an overflowing multi-photo column', () => {
  const issue = JSON.parse(fs.readFileSync(
    path.join(root, 'data/issues/2026-09-eylul.json'), 'utf8'));
  const four = issue.articles[1];
  const original = four.photos.map(photo => photo.url);
  four.layout = 'single-col'; // obsolete imported draft state
  const html = renderIssueToHTML(issue);
  const pageFour = html.split('data-page-index="4"')[1].split('data-page-index="5"')[0];
  assert.match(pageFour, /class="bento-4"/);
  assert.deepEqual(four.photos.map(photo => photo.url), original);
});

test('one distinct lead story per issue adds magazine rhythm without editing narratives', () => {
  for (const id of ['2026-07-temmuz','2026-08-agustos','2026-09-eylul','2026-10-ekim']) {
    const issue = JSON.parse(fs.readFileSync(path.join(root, 'data/issues', id + '.json'), 'utf8'));
    assert.equal(issue.articles.filter(art => art.storyStyle === 'feature').length, 1, id);
    const html = renderIssueToHTML(issue);
    assert.match(html, /article-card\s+story-feature/, id);
    const bare = structuredClone(issue);
    for (const article of bare.articles) delete article.storyStyle;
    assert.equal(html.includes('class="bento-img"'), renderIssueToHTML(bare).includes('class="bento-img"'));
  }
});
