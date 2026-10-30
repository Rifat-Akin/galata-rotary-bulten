import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';
import { renderIssueToHTML } from '../public/renderer.js';
import { exportIssueToPDF } from '../scripts/export-pdf.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const issueId = '2026-07-temmuz';
const issuePath = path.join(root, 'data', 'issues', issueId + '.json');
const originalHash = crypto.createHash('sha256').update(fs.readFileSync(issuePath)).digest('hex');
const { server, port } = await startServer(0);
const defaultHost = '127.0.0.1:' + port;

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(issuePath)).digest('hex'), originalHash,
    'Source issue must never be modified by negative tests');
});

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body || '';
    const headers = { host: defaultHost, ...(options.headers || {}) };
    const req = http.request({ hostname: '127.0.0.1', port, path: urlPath,
      method: options.method || 'GET', headers }, res => {
      const chunks = [];
      res.on('data', buf => chunks.push(buf));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('editor binds loopback instead of exposing APIs to local network', () => {
  assert.equal(server.address().address, '127.0.0.1');
});
test('same-origin home responds without wildcard CORS and with nosniff', async () => {
  const res = await request('/');
  assert.equal(res.status, 200);
  assert.match(res.body, /Galata Rotary/);
  assert.equal(res.headers['access-control-allow-origin'], undefined);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
});
test('nonlocal Host headers are denied (DNS rebinding boundary)', async () => {
  assert.equal((await request('/', { headers: { host: 'attacker.example:3420' } })).status, 403);
});
test('cross-site POST is forbidden even with locally routed IP', async () => {
  const res = await request('/api/issues/new', { method: 'POST',
    headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
    body: '{"month":"Kasım"}' });
  assert.equal(res.status, 403);
});
test('cross-site fetch metadata is forbidden on state-changing requests', async () => {
  const res = await request('/api/rotaclub/sync', { method: 'POST',
    headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(res.status, 403);
});
test('no fabricated RotaClub integration success', async () => {
  const res = await request('/api/rotaclub/sync', { method: 'POST' });
  assert.equal(res.status, 501);
  assert.doesNotMatch(res.body, /"success": true/);
});
test('PUT rejects different identity without corrupting official JSON', async () => {
  const payload = JSON.parse(fs.readFileSync(issuePath, 'utf8'));
  payload.id = '2026-08-agustos';
  const res = await request('/api/issues/' + issueId, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(res.status, 422);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(issuePath)).digest('hex'), originalHash);
});
test('SVG upload is forbidden, even with a matching extension', async () => {
  const body = JSON.stringify({ issue: '2026-07', filename: 'untrusted.svg',
    data: Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64') });
  const res = await request('/api/upload', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body });
  assert.equal(res.status, 400);
});
test('uploaded image MIME and magic bytes must agree', async () => {
  const body = JSON.stringify({ issue: '2026-07', filename: 'fake.png',
    data: Buffer.from('not a PNG').toString('base64') });
  const res = await request('/api/upload', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body });
  assert.equal(res.status, 415);
});
test('oversized body is rejected before state changes', async () => {
  const res = await request('/api/issues/' + issueId, { method: 'PUT',
    headers: { 'content-type': 'application/json' }, body: 'X'.repeat(9 * 1024 * 1024) });
  assert.equal(res.status, 413);
});
test('malicious URLs cannot break out of magazine image attributes', () => {
  const issue = JSON.parse(fs.readFileSync(issuePath, 'utf8'));
  const first = issue.articles.find(a => a.photos?.length);
  assert.ok(first);
  first.photos[0].url = 'x" onerror="alert(123)" src="';
  const html = renderIssueToHTML(issue);
  assert.doesNotMatch(html, /onerror="alert\(123\)"/);
  assert.match(html, /&quot; onerror=&quot;alert/);
  first.photos[0].url = 'javascript:alert(123)';
  assert.doesNotMatch(renderIssueToHTML(issue), /javascript:alert/);
});
test('PDF generator failure keeps last-good output and removes temporary stages', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'galata-pdf-protection-'));
  const target = path.join(dir, 'Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf');
  try {
    fs.writeFileSync(target, 'LAST_GOOD_PDF_SENTINEL');
    await assert.rejects(exportIssueToPDF(issueId, {
      chromePath: process.execPath, port: 1, outputDir: dir
    }));
    assert.equal(fs.readFileSync(target, 'utf8'), 'LAST_GOOD_PDF_SENTINEL');
    assert.deepEqual(fs.readdirSync(dir), [path.basename(target)]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});