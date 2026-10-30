/**
 * Deterministic Chrome CDP printer.
 * Chrome's --print-to-pdf CLI can exit successfully without writing a file.
 * This directly requests a PDF from Page.printToPDF after image/font readiness.
 * All network and browser automation is limited to a private loopback print server.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';

const OP_TIMEOUT_MS = 25000;

function openSession(url) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket !== 'function') {
      reject(new Error('PDF CDP engine requires Node.js 22+ (Node 24 recommended)'));
      return;
    }
    const ws = new WebSocket(url);
    let nextId = 1;
    const pending = new Map();
    const failPending = err => {
      for (const item of pending.values()) {
        clearTimeout(item.timer);
        item.reject(err);
      }
      pending.clear();
    };
    const connectionTimer = setTimeout(() => {
      ws.close();
      reject(new Error('CDP WebSocket connection timed out'));
    }, 7000);

    ws.addEventListener('open', () => {
      clearTimeout(connectionTimer);
      resolve({
        send(method, params = {}) {
          return new Promise((accept, fail) => {
            const id = nextId++;
            const timer = setTimeout(() => {
              pending.delete(id);
              fail(new Error('CDP operation timed out: ' + method));
            }, OP_TIMEOUT_MS);
            pending.set(id, { resolve: accept, reject: fail, timer });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close() { ws.close(); }
      });
    }, { once: true });
    ws.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (typeof message.id !== 'number' || !pending.has(message.id)) return;
      const item = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(item.timer);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result);
    });
    ws.addEventListener('error', () => {
      clearTimeout(connectionTimer);
      failPending(new Error('Chrome DevTools WebSocket failed'));
      reject(new Error('Chrome DevTools WebSocket connection failed'));
    });
    ws.addEventListener('close', () => {
      clearTimeout(connectionTimer);
      failPending(new Error('Chrome DevTools WebSocket closed'));
    });
  });
}

async function waitForTarget(profileDir, child) {
  const deadline = Date.now() + 14000;
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error('Chrome exited before DevTools opened (exit ' + child.exitCode + ')');
    }
    if (fs.existsSync(portFile)) {
      const lines = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
      const port = Number(lines[0]);
      if (port > 0 && port <= 65535) {
        try {
          const result = await fetch('http://127.0.0.1:' + port + '/json/list', {
            signal: AbortSignal.timeout(1100)
          });
          if (result.ok) {
            const targets = await result.json();
            const target = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
            if (target) return target.webSocketDebuggerUrl;
          }
        } catch {}
      }
    }
    await pause(125);
  }
  throw new Error('Chrome DevTools did not expose a page target');
}

async function waitForPrintablePage(session) {
  const deadline = Date.now() + 16000;
  while (Date.now() < deadline) {
    try {
      const result = await session.send('Runtime.evaluate', {
        expression: `(() => {
          const images = [...document.querySelectorAll('img')];
          const pages = document.querySelectorAll('.a4-page');
          return {
            pathname: location.pathname,
            ready: document.readyState === 'complete' &&
              (!document.fonts || document.fonts.status === 'loaded') &&
              images.every(img => img.complete),
            broken: images.filter(img => !img.naturalWidth).length,
            overflowPages: [...pages].map((page, index) => {
              const inner = page.querySelector('.page-inner');
              const maxOverflow = Math.max(page.scrollHeight - page.clientHeight,
                inner ? inner.scrollHeight - inner.clientHeight : 0);
              return maxOverflow > 3 ? index + 1 : null;
            }).filter(Boolean),
            pages: pages.length
          };
        })()`,
        returnByValue: true
      });
      const state = result.result?.value;
      if (state?.pathname === '/render' && state.ready && state.pages) {
        if (state.broken) throw new Error(state.broken + ' images failed to load in print document');
        if (state.overflowPages?.length) {
          throw new Error('A4 page overflow detected on pages: ' + state.overflowPages.join(', '));
        }
        return state.pages;
      }
    } catch (err) {
      if (/images failed to load|A4 page overflow/.test(err.message)) throw err;
    }
    await pause(160);
  }
  throw new Error('Print page did not finish loading images and fonts');
}

async function stopChrome(child) {
  if (!child || child.exitCode != null || child.signalCode) return;
  const exited = new Promise(resolve => {
    child.once('exit', resolve);
  });
  child.kill('SIGTERM');
  await Promise.race([exited, pause(1100)]);
  if (child.exitCode == null && !child.signalCode) child.kill('SIGKILL');
}

/**
 * @param {object} options
 * @param {string} options.chromePath
 * @param {string} options.url Loopback /render URL
 * @param {string} options.outputPath Temporary, non-published file path
 * @param {string} options.profileDir Isolated temp Chrome profile
 */
export async function printPageToPDF({ chromePath, url, outputPath, profileDir }) {
  if (!url.startsWith('http://127.0.0.1:')) {
    throw new Error('PDF printing only accepts local print-server URLs');
  }
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-extensions',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    '--window-size=1024,1448',
    '--user-data-dir=' + profileDir,
  ];
  if (os.platform() === 'linux') args.push('--no-sandbox', '--disable-setuid-sandbox');
  args.push('about:blank');

  const child = spawn(chromePath, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let spawnError = null;
  let stderr = '';
  child.on('error', error => { spawnError = error; });
  child.stderr?.on('data', chunk => {
    if (stderr.length < 4000) stderr += String(chunk).slice(0, 4000 - stderr.length);
  });
  let session = null;
  try {
    const targetUrl = await waitForTarget(profileDir, child);
    if (spawnError) throw spawnError;
    session = await openSession(targetUrl);
    await session.send('Page.enable');
    await session.send('Runtime.enable');
    await session.send('Page.navigate', { url });
    const expectedPages = await waitForPrintablePage(session);
    const result = await session.send('Page.printToPDF', {
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      scale: 1,
      paperWidth: 8.2677,
      paperHeight: 11.6929,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      transferMode: 'ReturnAsBase64'
    });
    if (!result.data || typeof result.data !== 'string') {
      throw new Error('Chrome Page.printToPDF returned no PDF bytes');
    }
    fs.writeFileSync(outputPath, Buffer.from(result.data, 'base64'), { flag: 'wx' });
    return { expectedPages };
  } catch (err) {
    const description = spawnError?.message || err.message;
    throw new Error('Chrome CDP PDF printing failed: ' + description +
      (child.exitCode !== null ? ' (Chrome exit ' + child.exitCode + ')' : ''));
  } finally {
    session?.close();
    await stopChrome(child);
  }
}