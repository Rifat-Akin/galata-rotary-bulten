/**
 * Galata Rotary Bülten Stüdyosu — Official Local Server & REST API
 * Lightweight Node.js server with built-in http, fs, path, url, and child_process.
 *
 * REST Endpoints:
 * - GET  /api/issues           : List all issues with metadata
 * - GET  /api/issues/:id       : Get full issue JSON
 * - PUT  /api/issues/:id       : Update issue JSON on disk
 * - POST /api/issues/new       : Initialize new month issue template (initMonth / createIssue)
 * - POST /api/upload           : Upload image to public/assets/photos/<issue>/
 * - POST /api/export-pdf/:id   : Export issue to print-quality A4 PDF using Chrome Headless CLI
 * - POST /api/rotaclub/sync    : Mock RotaClub synchronization
 *
 * Static Hosting:
 * - /                          : public/index.html (Bülten Stüdyosu UI)
 * - /output/*                  : output/ (Pre-rendered magazine PDFs)
 * - /*                         : public/* (CSS, JS, images, brand assets)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = __dirname;
const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'issues');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');
const DATA_STATIC_DIR = path.join(PROJECT_ROOT, 'data');
export const FORBIDDEN_THEME_REGEX = /rotary(?:\s|[\-_.]|\\[tnr])*[sş][iıİI]hr[iıİI]/i;

/**
 * Deep Brand Veto String Checker
 * Unescapes Unicode, Hex, HTML entities, URL encodings, zero-width spaces,
 * and normalizes Turkish diacritics to ensure no variant of "Rotary Sihri" can evade detection.
 */
export function checkStringForForbiddenBrand(str) {
  if (typeof str !== 'string' || !str) return false;
  if (FORBIDDEN_THEME_REGEX.test(str)) return true;

  let unescaped = str;
  try {
    if (unescaped.includes('%')) {
      unescaped = decodeURIComponent(unescaped);
    }
  } catch {}

  unescaped = unescaped
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));

  unescaped = unescaped
    .replace(/\\+u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\+u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\+x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  unescaped = unescaped.replace(/\\+[tnr]/g, ' ');
  unescaped = unescaped.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, '');
  unescaped = unescaped.normalize('NFC');

  if (FORBIDDEN_THEME_REGEX.test(unescaped)) return true;

  const folded = unescaped
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[iıİI]/g, 'i')
    .replace(/[sşŞS]/g, 's')
    .replace(/[hH]/g, 'h')
    .replace(/[rR]/g, 'r')
    .toLowerCase();

  return /rotary[\s_\-.]*sihri/.test(folded);
}

/**
 * Recursively scans an object tree (keys and values) for any forbidden branding phrase.
 */
export function hasForbiddenBrandDeep(target, visited = new WeakSet()) {
  if (target == null) return false;
  if (typeof target === 'string') return checkStringForForbiddenBrand(target);
  if (typeof target === 'number' || typeof target === 'boolean') return false;

  if (typeof target === 'object') {
    if (visited.has(target)) return false;
    visited.add(target);

    if (Array.isArray(target)) {
      for (const item of target) {
        if (hasForbiddenBrandDeep(item, visited)) return true;
      }
      return false;
    }

    for (const [key, value] of Object.entries(target)) {
      if (checkStringForForbiddenBrand(key)) return true;
      if (hasForbiddenBrandDeep(value, visited)) return true;
    }
  }

  return false;
}


const DEFAULT_PORT = 3420;
const MAX_PORT_ATTEMPTS = 10;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon'
};

const MONTH_ORDER = [
  { num: 7, name: 'Temmuz', theme: 'Anne ve Çocuk Sağlığı Ayı' },
  { num: 8, name: 'Ağustos', theme: 'Üyelik ve Yeni Kulüp Geliştirme Ayı' },
  { num: 9, name: 'Eylül', theme: 'Temel Eğitim ve Okuryazarlık Ayı' },
  { num: 10, name: 'Ekim', theme: 'Toplumsal ve Ekonomik Kalkınma Ayı' },
  { num: 11, name: 'Kasım', theme: 'Rotary Vakfı Ayı' },
  { num: 12, name: 'Aralık', theme: 'Hastalıkların Önlenmesi ve Tedavisi Ayı' },
  { num: 1, name: 'Ocak', theme: 'Mesleki Hizmetler Ayı' },
  { num: 2, name: 'Şubat', theme: 'Barış ve Çatışma Çözümü Ayı' },
  { num: 3, name: 'Mart', theme: 'Su, Sanitasyon ve Hijyen Ayı' },
  { num: 4, name: 'Nisan', theme: 'Çevrenin Korunması Ayı' },
  { num: 5, name: 'Mayıs', theme: 'Gençlik Hizmetleri Ayı' },
  { num: 6, name: 'Haziran', theme: 'Rotary Dostluk Grupları Ayı' }
];

const ISSUE_PDF_MAP = {
  '2026-07-temmuz': 'Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf',
  '2026-08-agustos': 'Galata_Rotary_Bulten_2026_08_Agustos_Sayi_2.pdf',
  '2026-09-eylul': 'Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf',
  '2026-10-ekim': 'Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf'
};

/**
 * Reads request body as a Buffer
 */
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Sends JSON response with standard headers
 */
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Sends simple text response
 */
function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(text);
}

/**
 * Serves static files safely from a base directory
 */
function serveStaticFile(res, basePath, relativePath) {
  // Prevent directory traversal attacks
  const safeRelativePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(basePath, safeRelativePath);

  if (!filePath.startsWith(basePath)) {
    sendText(res, 403, '403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendText(res, 404, '404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

/**
 * Parses basic multipart/form-data without external dependencies
 */
function parseMultipartData(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const result = { fields: {}, files: [] };
  let start = 0;

  while (true) {
    const bStart = buffer.indexOf(boundaryBuffer, start);
    if (bStart === -1) break;

    const partStart = bStart + boundaryBuffer.length;
    // Check for trailing '--'
    if (buffer.slice(partStart, partStart + 2).toString() === '--') {
      break;
    }

    const nextBoundary = buffer.indexOf(boundaryBuffer, partStart);
    if (nextBoundary === -1) break;

    const partBuffer = buffer.slice(partStart + 2, nextBoundary - 2); // strip \r\n
    const headerEndIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEndIndex === -1) {
      start = nextBoundary;
      continue;
    }

    const headerStr = partBuffer.slice(0, headerEndIndex).toString('utf8');
    const bodyBuffer = partBuffer.slice(headerEndIndex + 4);

    const dispositionMatch = headerStr.match(/content-disposition:\s*form-data;\s*([^;\r\n]+)(?:;\s*filename="([^"\r\n]+)")?/i);
    if (dispositionMatch) {
      const nameMatch = headerStr.match(/name="([^"\r\n]+)"/i);
      const fieldName = nameMatch ? nameMatch[1] : null;
      const fileName = dispositionMatch[2];

      if (fileName) {
        result.files.push({
          fieldName,
          filename: path.basename(fileName),
          data: bodyBuffer
        });
      } else if (fieldName) {
        result.fields[fieldName] = bodyBuffer.toString('utf8');
      }
    }

    start = nextBoundary;
  }

  return result;
}

/**
 * Path traversal sanitization for issue identifiers in server requests and templates.
 * Rejects any identifiers containing traversal characters (.., /, \) or non-alphanumeric formats.
 */
export function sanitizeIssueId(rawId) {
  if (!rawId || typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    return null;
  }
  const clean = path.basename(trimmed).replace(/\.json$/i, '').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    return null;
  }
  return clean;
}

/**
 * Resolves an issue JSON file path within DATA_DIR and strictly asserts containment.
 */
export function resolveSafeIssuePath(safeId) {
  if (!safeId || typeof safeId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(safeId)) {
    return null;
  }
  const resolvedDataDir = path.resolve(DATA_DIR);
  const resolvedDataDirWithSep = resolvedDataDir.endsWith(path.sep) ? resolvedDataDir : resolvedDataDir + path.sep;
  const filePath = path.resolve(DATA_DIR, `${safeId}.json`);
  if (!filePath.startsWith(resolvedDataDirWithSep)) {
    return null;
  }
  return filePath;
}

/**
 * New Month Initializer / Issue Creator
 * Clones masthead & officers from the latest issue and creates a clean next-month template
 */
export function createIssue(customData = {}) {
  const serializedCustom = JSON.stringify(customData);
  if (
    FORBIDDEN_THEME_REGEX.test(serializedCustom) ||
    hasForbiddenBrandDeep(customData)
  ) {
    throw new Error('Corporate Branding Violation: "Rotary Sihri" ifadesi kesinlikle kullanılamaz! Tema "KALICI ETKİ YARAT" olmalıdır.');
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const existingFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');

  // Read existing issues to discover highest issueNumber and base metadata
  let maxIssueNum = 0;
  let baseIssue = null;

  for (const file of existingFiles) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
      if (content.issueNumber > maxIssueNum) {
        maxIssueNum = content.issueNumber;
        baseIssue = content;
      }
    } catch {
      // continue
    }
  }

  const nextIssueNum = maxIssueNum + 1;
  // Determine next month
  let nextMonthIndex = 0;
  if (baseIssue && baseIssue.month) {
    const curIdx = MONTH_ORDER.findIndex(m => m.name.toLowerCase() === baseIssue.month.toLowerCase());
    if (curIdx !== -1 && curIdx + 1 < MONTH_ORDER.length) {
      nextMonthIndex = curIdx + 1;
    }
  }

  let monthEntry = null;
  if (customData.month) {
    monthEntry = MONTH_ORDER.find(m => m.name.toLowerCase() === String(customData.month).trim().toLowerCase());
  }
  if (!monthEntry) {
    monthEntry = MONTH_ORDER[nextMonthIndex];
  }

  const targetMonth = customData.month || monthEntry.name;
  const rawYear = customData.year || (baseIssue ? baseIssue.year : 2026);
  const targetYear = parseInt(rawYear, 10) || 2026;
  const targetTheme = customData.rotaryMonthTheme || monthEntry.theme;

  const monthSlug = targetMonth
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

  const monthNumStr = String(monthEntry.num).padStart(2, '0');
  const rawId = (customData.id ? String(customData.id) : `${targetYear}-${monthNumStr}-${monthSlug}`).trim();
  const safeId = sanitizeIssueId(rawId);
  if (!safeId) {
    throw new Error(`Invalid issue ID format: "${rawId}"`);
  }

  const targetFilePath = resolveSafeIssuePath(safeId);
  if (!targetFilePath) {
    throw new Error('Target file path outside data directory');
  }

  if (fs.existsSync(targetFilePath) && !customData.overwrite) {
    throw new Error(`Sayı zaten mevcut: ${safeId}. Farklı bir ay veya id seçiniz.`);
  }

  const newIssueTemplate = {
    id: safeId,
    issueNumber: customData.issueNumber || nextIssueNum,
    rotaryYear: "2026-2027",
    month: targetMonth,
    year: targetYear,
    theme: "KALICI ETKİ YARAT",
    rotaryMonthTheme: targetTheme,
    club: baseIssue ? { ...baseIssue.club } : {
      name: "Galata Rotary Kulübü",
      district: "UR 2420. Bölge",
      clubNo: "64336",
      charterDate: "27.01.2004",
      foundationDate: "02.09.2003",
      meeting: "Her Pazartesi 19:30 | Grand Hyatt İstanbul Taksim & Zoom"
    },
    officers: baseIssue ? { ...baseIssue.officers } : {
      riPresident: "Olayinka Hakeem Babalola",
      districtGovernor: "Erden Gökmen",
      assistantGovernor: "İhsan Ercan",
      president: "Sevilay Aksel",
      secretary: "Gökhan Alpertunga",
      treasurer: "Burhan Tokgöz",
      bulletinCommittee: ["Rifat Akın Kaplan", "Özgür Kuddar", "GDB Polat Özcan"]
    },
    presidentMessage: {
      title: `${targetMonth} Ayı Başkan Mesajı`,
      body: `Değerli Rotaryen Dostlarım ve Sevgili Galata Ailemiz,\n\n${targetMonth} ayında "Kalıcı Etki Yarat" ilkemizle hizmetlerimize ve projelerimize devam ediyoruz.\n\nSevgi ve Saygılarımla,\nSevilay Aksel\nGalata Rotary Kulübü Dönem Başkanı`,
      photo: baseIssue && baseIssue.presidentMessage ? baseIssue.presidentMessage.photo : "assets/photos/2026-09/baskan_sevilay_aksel.jpg"
    },
    articles: [
      {
        id: "art-01",
        category: "Haberler ve Etkinlikler",
        date: `1 ${targetMonth} ${targetYear}`,
        title: `${targetMonth} Ayı Açılış Toplantısı`,
        venue: "Grand Hyatt İstanbul Taksim",
        summary: `${targetMonth} ayı dönemsel projelerimiz ve toplantı gündemimiz üyelerimizle paylaşıldı.`,
        layout: "two-col",
        photos: []
      }
    ],
    culture: {
      title: "Galata Kültür Köşesi",
      book: {
        title: "İstanbul ve Galata Hatıratı",
        author: "Tarih ve Kültür Araştırmaları",
        cover: "assets/brand/galata-silhouette.svg",
        summary: "Galata'nın tarihî ve kültürel dokusunu ele alan kapsamlı bir editoryal inceleme."
      }
    },
    backCover: {
      theme: "ÇOCUK FELCİNE SON",
      subTheme: "End Polio Now",
      color: "#E01E26",
      contact: {
        instagram: "@galatarotarykulubu",
        web: "www.galatarotary.org"
      }
    }
  };

  fs.writeFileSync(targetFilePath, JSON.stringify(newIssueTemplate, null, 2), 'utf8');

  // Also ensure photo directory exists for this new issue
  const photoDir = path.join(PUBLIC_DIR, 'assets', 'photos', `${targetYear}-${monthNumStr}`);
  fs.mkdirSync(photoDir, { recursive: true });

  return newIssueTemplate;
}

// Alias for requirement compatibility
export const initMonth = createIssue;
export const newIssue = createIssue;

/**
 * Request handler for all HTTP requests
 */
async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // --------------------------------------------------------------------------
  // API Endpoints
  // --------------------------------------------------------------------------

  // GET /api/issues -> list all issues
  if (method === 'GET' && pathname === '/api/issues') {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        return sendJSON(res, 200, []);
      }
      const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
      const issues = [];

      for (const file of files) {
        try {
          const filePath = path.join(DATA_DIR, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          issues.push({
            id: data.id || path.basename(file, '.json'),
            filename: file,
            title: `${data.month} ${data.year} (Sayı ${data.issueNumber})`,
            issueNumber: data.issueNumber,
            month: data.month,
            year: data.year,
            rotaryYear: data.rotaryYear,
            theme: data.theme,
            rotaryMonthTheme: data.rotaryMonthTheme,
            totalArticles: (data.articles || []).length,
            president: data.officers ? data.officers.president : ''
          });
        } catch (err) {
          console.error(`Error reading ${file}:`, err);
        }
      }

      // Sort by issue number ascending
      issues.sort((a, b) => (a.issueNumber || 0) - (b.issueNumber || 0));
      return sendJSON(res, 200, issues);
    } catch (err) {
      return sendJSON(res, 500, { error: 'Failed to list issues', details: err.message });
    }
  }

  // GET /api/issues/:id -> retrieve specific issue
  if (method === 'GET' && pathname.startsWith('/api/issues/')) {
    const rawIssueId = pathname.replace('/api/issues/', '').trim();
    if (!rawIssueId) {
      return sendJSON(res, 400, { error: 'Issue ID required' });
    }

    const safeIssueId = sanitizeIssueId(rawIssueId);
    if (!safeIssueId) {
      return sendJSON(res, 400, { error: 'Invalid issue ID format' });
    }

    const filePath = resolveSafeIssuePath(safeIssueId);
    if (!filePath) {
      return sendJSON(res, 403, { error: 'Access denied' });
    }

    if (!fs.existsSync(filePath)) {
      return sendJSON(res, 404, { error: `Issue not found: ${safeIssueId}` });
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return sendJSON(res, 200, data);
    } catch (err) {
      return sendJSON(res, 500, { error: 'Failed to read issue', details: err.message });
    }
  }

  // PUT /api/issues/:id -> update issue JSON
  if (method === 'PUT' && pathname.startsWith('/api/issues/')) {
    const rawIssueId = pathname.replace('/api/issues/', '').trim();
    if (!rawIssueId) {
      return sendJSON(res, 400, { error: 'Issue ID required' });
    }

    const safeIssueId = sanitizeIssueId(rawIssueId);
    if (!safeIssueId) {
      return sendJSON(res, 400, { error: 'Invalid issue ID format' });
    }

    const filePath = resolveSafeIssuePath(safeIssueId);
    if (!filePath) {
      return sendJSON(res, 403, { error: 'Access denied' });
    }

    try {
      const bodyBuffer = await readRequestBody(req);
      const rawBody = bodyBuffer.toString('utf8');
      let issueData;
      try {
        issueData = JSON.parse(rawBody);
      } catch (parseErr) {
        return sendJSON(res, 400, { error: 'Invalid JSON payload', details: parseErr.message });
      }

      // Validate strict corporate branding rules (case-insensitive & Turkish resilient & deep unescaped scan)
      const stringified = JSON.stringify(issueData);
      if (
        FORBIDDEN_THEME_REGEX.test(stringified) ||
        FORBIDDEN_THEME_REGEX.test(rawBody) ||
        hasForbiddenBrandDeep(issueData)
      ) {
        return sendJSON(res, 400, {
          error: 'Corporate Branding Violation: "Rotary Sihri" ifadesi kesinlikle kullanılamaz! Tema "KALICI ETKİ YARAT" olmalıdır.'
        });
      }

      if (issueData.theme !== 'KALICI ETKİ YARAT') {
        issueData.theme = 'KALICI ETKİ YARAT';
      }

      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(issueData, null, 2), 'utf8');

      return sendJSON(res, 200, {
        success: true,
        message: 'Bülten başarıyla kaydedildi.',
        id: safeIssueId,
        issue: issueData
      });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Failed to save issue', details: err.message });
    }
  }

  // POST /api/issues/new or POST /api/new-issue -> create next month issue
  if (method === 'POST' && (pathname === '/api/issues/new' || pathname === '/api/new-issue')) {
    try {
      const bodyBuffer = await readRequestBody(req);
      let payload = {};
      if (bodyBuffer.length > 0) {
        try {
          payload = JSON.parse(bodyBuffer.toString('utf8'));
        } catch {
          // ignore parsing error, use default
        }
      }

      const created = createIssue(payload);
      return sendJSON(res, 201, {
        success: true,
        message: `${created.month} ${created.year} (Sayı ${created.issueNumber}) başarıyla başlatıldı.`,
        issue: created
      });
    } catch (err) {
      return sendJSON(res, 400, { error: 'Failed to create issue', details: err.message });
    }
  }

  // POST /api/upload -> upload image asset
  if (method === 'POST' && pathname === '/api/upload') {
    try {
      const contentType = req.headers['content-type'] || '';
      const bodyBuffer = await readRequestBody(req);

      let fileBuffer = null;
      let rawFilename = null;
      let isMultipart = false;
      let issueFolder = parsedUrl.searchParams.get('issue') || '2026-09';
      let jsonPayload = null;

      if (contentType.includes('multipart/form-data')) {
        isMultipart = true;
        const boundaryMatch = contentType.match(/boundary=([^\s;]+)/i);
        if (!boundaryMatch) {
          return sendJSON(res, 400, { error: 'Missing boundary in multipart request' });
        }
        const boundary = boundaryMatch[1];
        const parsed = parseMultipartData(bodyBuffer, boundary);

        if (parsed.fields.issue) {
          issueFolder = parsed.fields.issue;
        }

        if (parsed.files.length === 0) {
          return sendJSON(res, 400, { error: 'No files uploaded in multipart form' });
        }

        const file = parsed.files[0];
        rawFilename = file.filename;
        fileBuffer = file.data;
      } else if (contentType.includes('application/json')) {
        try {
          jsonPayload = JSON.parse(bodyBuffer.toString('utf8'));
        } catch {
          return sendJSON(res, 400, { error: 'Invalid JSON payload' });
        }
        if (jsonPayload.issue) {
          issueFolder = jsonPayload.issue;
        }
        if (!jsonPayload.data) {
          return sendJSON(res, 400, { error: 'Missing base64 data property in JSON' });
        }
        rawFilename = jsonPayload.filename || `upload_${Date.now()}.jpg`;
        const base64Data = jsonPayload.data.replace(/^data:image\/\w+;base64,/, '');
        fileBuffer = Buffer.from(base64Data, 'base64');
      } else {
        return sendJSON(res, 400, { error: 'Unsupported Content-Type. Use multipart/form-data or application/json (base64).' });
      }

      // 1. Sanitize issueFolder with path.basename and enforce strict regex
      const rawFolder = String(issueFolder || '').trim();
      const safeFolder = path.basename(rawFolder).trim();
      if (!rawFolder || !/^[a-zA-Z0-9_-]+$/.test(rawFolder) || !/^[a-zA-Z0-9_-]+$/.test(safeFolder) || safeFolder !== rawFolder) {
        return sendJSON(res, 400, { error: 'Invalid issue folder format' });
      }

      // Assert target directory stays strictly inside public/assets/photos
      const photosBaseDir = path.join(PUBLIC_DIR, 'assets', 'photos');
      const targetDir = path.join(photosBaseDir, safeFolder);
      const resolvedPhotosBase = path.resolve(photosBaseDir);
      const resolvedTargetDir = path.resolve(targetDir);

      if (!targetDir.startsWith(photosBaseDir) || !resolvedTargetDir.startsWith(resolvedPhotosBase + path.sep)) {
        return sendJSON(res, 403, { error: 'Access denied: Target directory outside photos directory' });
      }

      // 2. Sanitize filename using path.basename and validate extension
      const ALLOWED_PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);
      const cleanBasename = path.basename(String(rawFilename || '')).trim();
      const rawExt = path.extname(cleanBasename);
      const ext = rawExt.toLowerCase();

      if (!ext || !ALLOWED_PHOTO_EXTENSIONS.has(ext)) {
        return sendJSON(res, 400, {
          error: `Invalid file extension "${ext}". Allowed extensions: .jpg, .jpeg, .png, .webp, .svg`
        });
      }

      const stemRaw = cleanBasename.slice(0, cleanBasename.length - rawExt.length);
      const sanitizedStem = stemRaw.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
      const stem = sanitizedStem.length > 0 ? sanitizedStem : 'upload';
      const finalFilename = isMultipart
        ? `${Date.now()}_${stem}${ext}`
        : (jsonPayload && jsonPayload.filename ? `${stem}${ext}` : `upload_${Date.now()}${ext}`);

      // 3. Assert final destination file path stays strictly inside targetDir
      const destinationPath = path.join(targetDir, finalFilename);
      const resolvedDest = path.resolve(destinationPath);

      if (!destinationPath.startsWith(targetDir) || !resolvedDest.startsWith(resolvedTargetDir + path.sep)) {
        return sendJSON(res, 403, { error: 'Access denied: Destination path outside target directory' });
      }

      // 4. Safely ensure directory exists and write file
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(destinationPath, fileBuffer);
      const savedUrl = `assets/photos/${safeFolder}/${finalFilename}`;

      return sendJSON(res, 200, {
        success: true,
        message: 'Görsel başarıyla yüklendi',
        url: savedUrl,
        filename: finalFilename
      });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Image upload failed', details: err.message });
    }
  }

  // POST /api/export-pdf/:id -> trigger headless Chrome PDF generation
  if (method === 'POST' && pathname.startsWith('/api/export-pdf/')) {
    const rawIssueId = pathname.replace('/api/export-pdf/', '').trim();
    if (!rawIssueId) {
      return sendJSON(res, 400, { error: 'Issue ID required' });
    }

    const safeIssueId = sanitizeIssueId(rawIssueId);
    if (!safeIssueId) {
      return sendJSON(res, 400, { error: 'Invalid issue ID format' });
    }
    const issueId = safeIssueId;

    try {
      const scriptPath = path.join(SCRIPTS_DIR, 'export-pdf.mjs');
      console.log(`[PDF Export] Executing: node ${scriptPath} --issue ${issueId}`);

      const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, '--issue', issueId], {
        cwd: PROJECT_ROOT,
        timeout: 60000
      });

      console.log('[PDF Export Output]:', stdout);
      if (stderr) console.error('[PDF Export Stderr]:', stderr);

      // Determine PDF filename in output directory robustly
      let matched = null;
      if (ISSUE_PDF_MAP[issueId] && fs.existsSync(path.join(OUTPUT_DIR, ISSUE_PDF_MAP[issueId]))) {
        matched = ISSUE_PDF_MAP[issueId];
      } else if (fs.existsSync(path.join(OUTPUT_DIR, `${issueId}.pdf`))) {
        matched = `${issueId}.pdf`;
      } else if (fs.existsSync(OUTPUT_DIR)) {
        const pdfFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.pdf'));
        const parts = issueId.toLowerCase().split(/[-_]/).filter(Boolean);
        matched = pdfFiles.find(f => {
          const lower = f.toLowerCase();
          return lower.includes(issueId.toLowerCase()) || parts.some(part => part.length >= 3 && lower.includes(part));
        }) || null;
      }

      return sendJSON(res, 200, {
        success: true,
        message: 'PDF başarıyla üretildi.',
        issue: issueId,
        outputPdf: matched ? `/output/${matched}` : null,
        stdout
      });
    } catch (err) {
      return sendJSON(res, 500, {
        error: 'PDF export failed',
        details: err.message,
        stderr: err.stderr || ''
      });
    }
  }

  // POST /api/rotaclub/sync -> mock RotaClub synchronization
  if (method === 'POST' && pathname === '/api/rotaclub/sync') {
    try {
      const files = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'index.json') : [];
      return sendJSON(res, 200, {
        success: true,
        message: 'RotaClub veri senkronizasyonu tamamlandı.',
        syncedCount: files.length,
        syncedIssues: files.map(f => path.basename(f, '.json')),
        timestamp: new Date().toISOString(),
        club: {
          name: "Galata Rotary Kulübü",
          district: "UR 2420. Bölge",
          clubNo: "64336",
          status: "Aktif"
        }
      });
    } catch (err) {
      return sendJSON(res, 500, { error: 'RotaClub sync error', details: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // Static File Serving
  // --------------------------------------------------------------------------

  // Output folder PDFs: /output/*
  if (pathname.startsWith('/output/')) {
    const relPath = pathname.slice('/output/'.length);
    return serveStaticFile(res, OUTPUT_DIR, relPath);
  }

  // Data folder JSON files & static catalogs: /data/*
  if (pathname.startsWith('/data/')) {
    const relPath = pathname.slice('/data/'.length);
    return serveStaticFile(res, DATA_STATIC_DIR, relPath);
  }

  // Root -> /index.html
  if (pathname === '/' || pathname === '/index.html') {
    return serveStaticFile(res, PUBLIC_DIR, 'index.html');
  }

  // Fallback to public/*
  const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  return serveStaticFile(res, PUBLIC_DIR, cleanPath);
}

/**
 * Starts the HTTP server with automatic port retry if busy
 */
export function startServer(port = DEFAULT_PORT, attempt = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handleRequest);

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
        console.warn(`[Server] Port ${port} is in use. Trying port ${port + 1}...`);
        server.close();
        resolve(startServer(port + 1, attempt + 1));
      } else {
        reject(err);
      }
    });

    server.listen(port, '0.0.0.0', () => {
      const activePort = server.address().port;
      console.log(`========================================================================`);
      console.log(`  GALATA ROTARY BÜLTEN STÜDYOSU (Web & API Server)`);
      console.log(`  Yerel Web URL   : http://localhost:${activePort}`);
      console.log(`  Dönem Teması    : KALICI ETKİ YARAT (2026–2027)`);
      console.log(`  Bölge & Kulüp   : UR 2420. Bölge | Galata Rotary Kulübü (64336)`);
      console.log(`========================================================================`);
      resolve({ server, port: activePort });
    });
  });
}

// Auto-run if executed directly as entrypoint
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  startServer().catch(err => {
    console.error('Fatal server error:', err);
    process.exit(1);
  });
}
