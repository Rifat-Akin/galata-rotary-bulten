import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderIssueToHTML, paginateArticles} from '../public/renderer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = id => JSON.parse(fs.readFileSync(path.join(root, 'data/issues', id + '.json'), 'utf8'));
const archive = [
  ['2026-07-temmuz',8], ['2026-08-agustos',8],
  ['2026-09-eylul',9], ['2026-10-ekim',9]
];

test('all accepted archive editions keep their exact 34 physical pages', () => {
  for (const [id, expected] of archive) {
    const issue = load(id);
    assert.equal((renderIssueToHTML(issue).match(/class="a4-page/g)||[]).length, expected,id);
    assert.equal(paginateArticles(issue).flat().length,issue.articles.length,id);
  }
});

test('appending an article to accepted August/October cannot silently drop it', () => {
  for (const id of ['2026-08-agustos','2026-10-ekim']) {
    const issue=load(id);
    const injected={...issue.articles[0],id:'qa-unique-extra',title:'SENTETİK EK HABER',photos:[]};
    issue.articles.push(injected);
    const groups=paginateArticles(issue);
    assert.equal(groups.flat().length,issue.articles.length);
    assert.equal(groups.flat().at(-1),injected);
    const html=renderIssueToHTML(issue);
    assert.match(html,/SENTETİK EK HABER/);
    assert.equal((html.match(/class="a4-page/g)||[]).length,issue.articles.length+4);
  }
});

test('arbitrary new months render all 0-25 articles without an artificial nine-page cap', () => {
  const prototype=load('2026-09-eylul');
  for(const n of [0,1,4,5,6,8,12,20,25]) {
    const issue=structuredClone(prototype);
    issue.id='2027-11-kasim'; issue.month='Kasım';issue.year=2027;issue.rotaryYear='2027-2028';
    issue.articles=Array.from({length:n},(_,i)=>({
      id:'test-story-'+i,title:'Test story number '+i,summary:'Örnek içerik '+i,
      date:'',category:'Kulüpten Haberler',photos:[]
    }));
    issue.culture={title:'Galata Kültür Köşesi',book:{title:'',author:'',cover:'',summary:''},announcements:[]};
    const groups=paginateArticles(issue);
    assert.equal(groups.flat().length,n,'story count '+n);
    assert.equal(new Set(groups.flat().map(a=>a.id)).size,n,'unique story ids '+n);
    const html=renderIssueToHTML(issue);
    assert.equal((html.match(/class="a4-page/g)||[]).length,n+4,'pages '+n);
    assert.ok(!html.includes('30 Ekim:'),'old October program leaked');
    assert.ok(!html.includes('Guvernör Erden Gökmen ve Vakıf'),'old October source leaked');
  }
});

test('monthly notices are user-provided and HTML escaped; archive defaults retained only for old IDs', () => {
  const issue=load('2026-10-ekim');
  assert.match(renderIssueToHTML(issue),/30 Ekim:/);
  issue.culture.announcements=[];
  const empty=renderIssueToHTML(issue);
  assert.doesNotMatch(empty,/30 Ekim:/);
  assert.match(empty,/Henüz duyuru eklenmedi/);
  issue.culture.announcements=[{title:'Yeni <script>başlık</script>',body:'Birinci satır\nİkinci satır'}];
  const changed=renderIssueToHTML(issue);
  assert.match(changed,/Yeni &lt;script&gt;başlık&lt;\/script&gt;/);
  assert.doesNotMatch(changed,/<script>başlık<\/script>/);
  assert.match(changed,/Birinci satır/);
  assert.match(changed,/İkinci satır/);
});

test('future Rotary year never presents previous president or official theme as current', () => {
  const issue=load('2026-09-eylul');
  issue.id='2027-11-kasim';issue.month='Kasım';issue.year=2027;issue.rotaryYear='2027-2028';
  issue.theme='';issue.officers={riPresident:'',districtGovernor:'',assistantGovernor:'',
    president:'',secretary:'',treasurer:'',bulletinCommittee:[]};
  issue.presidentMessage={title:'Başkanın Mesajı',body:'',photo:''};
  issue.articles=[];issue.culture={book:{},announcements:[]};
  const rendered=renderIssueToHTML(issue);
  assert.match(rendered,/2027–2028 DÖNEMİ/);
  assert.match(rendered,/Dönem teması belirtilmedi/);
  assert.doesNotMatch(rendered,/Sevilay Aksel/);
  assert.doesNotMatch(rendered,/Gökhan Alpertunga/);
  assert.doesNotMatch(rendered,/Olayinka Hakeem Babalola/);
});

test('blank new-month book cover uses bundled placeholder instead of invalid src=""', () => {
  const issue=load('2026-09-eylul');
  issue.id='2098-11-kasim';
  issue.month='Kasım';
  issue.year=2098;
  issue.rotaryYear='2098-2099';
  issue.theme='';
  issue.articles=[];
  issue.culture={title:'Galata Kültür Köşesi',
    announcements:[],book:{title:'',author:'',cover:'',summary:''}};
  issue.presidentMessage={title:'Yeni ay',body:'',photo:''};
  const html=renderIssueToHTML(issue);
  assert.equal((html.match(/class="a4-page/g)||[]).length,4);
  assert.doesNotMatch(html,/\bsrc=""/);
  assert.match(html,/class="book-cover-img book-cover-placeholder"/);
  assert.match(html,/assets\/brand\/galata-silhouette\.svg/);
});
