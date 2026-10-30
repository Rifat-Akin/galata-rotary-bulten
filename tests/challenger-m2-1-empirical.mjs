/**
 * Challenger M2-1: Empirical Adversarial Stress Test & Injection Verifier
 * 
 * Verifies Milestone M2 implementation against:
 * 1. Turkish Glyph & Escaped Whitespace Regex Veto across validate-issues.mjs,
 *    server.mjs createIssue, and server.mjs PUT /api/issues/:id.
 * 2. Path Traversal & Cleanup Adversarial Probe for scripts/export-pdf.mjs.
 * 3. Failure Cleanup (no corrupt/partial PDFs left on error).
 * 4. %TEMP% Chrome Profile Directory Lifecycle (zero orphaned galata-pdf-chrome-* dirs).
 * 5. Clean execution of all prior test suites.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createIssue, startServer } from '../server.mjs';
import {
  exportIssueToPDF,
  inspectPDF,
  sanitizeIssueId,
  getKnownIssueIds,
  cleanupAllTempDirs,
  cleanupStaleTempProfiles
} from '../scripts/export-pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'issues');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');
const VALIDATOR_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'validate-issues.mjs');
const EXPORT_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'export-pdf.mjs');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const findings = [];

function testAssert(desc, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ [PASS] ${desc}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${desc}`);
    if (details) console.error(`    ↳ Details: ${details}`);
    findings.push({ desc, details });
  }
}

function runCli(scriptPath, args = []) {
  const res = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    timeout: 30000
  });
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    error: res.error
  };
}

// Canonical required variations from dispatch instructions + edge cases
const VARIATIONS = [
  { name: 'Lowercase ASCII "rotary sihri"', value: 'rotary sihri' },
  { name: 'Uppercase with Turkish dotted İ "ROTARY SİHRİ"', value: 'ROTARY SİHRİ' },
  { name: 'Lowercase with Turkish dotless ı "rotary sıhrı"', value: 'rotary sıhrı' },
  { name: 'Uppercase ASCII "ROTARY SIHRI"', value: 'ROTARY SIHRI' },
  { name: 'Turkish ş without space "rotaryşihri"', value: 'rotaryşihri' },
  { name: 'ASCII s without space "rotarysihri"', value: 'rotarysihri' },
  { name: 'JSON escaped tab "rotary\\tsihri"', value: 'rotary\tsihri' },
  { name: 'JSON escaped newline "rotary\\nsihri"', value: 'rotary\nsihri' },
  { name: 'JSON escaped CR "rotary\\rsihri"', value: 'rotary\rsihri' },
  { name: 'Unicode escape dotted İ "ROTARY S\\u0130HR\\u0130"', value: 'ROTARY S\u0130HR\u0130' },
  { name: 'Unicode escape dotless ı "rotary s\\u0131hr\\u0131"', value: 'rotary s\u0131hr\u0131' },
  { name: 'Mixed case with Turkish Ş "ROTARY ŞİHRİ"', value: 'ROTARY ŞİHRİ' },
  { name: 'Multiple whitespace "ROTARY   SİHRİ"', value: 'ROTARY   SİHRİ' }
];

// Raw literal escape sequences directly in JSON strings
const RAW_LITERAL_ESCAPES = [
  { name: 'Raw Unicode escape "ROTARY S\\u0130HR\\u0130"', rawToken: 'ROTARY S\\u0130HR\\u0130' },
  { name: 'Raw Unicode escape "rotary s\\u0131hr\\u0131"', rawToken: 'rotary s\\u0131hr\\u0131' },
  { name: 'Raw escaped tab "rotary\\tsihri"', rawToken: 'rotary\\tsihri' },
  { name: 'Raw escaped newline "rotary\\nsihri"', rawToken: 'rotary\\nsihri' },
  { name: 'Raw escaped CR "rotary\\rsihri"', rawToken: 'rotary\\rsihri' }
];

async function main() {
  console.log('========================================================================');
  console.log('  CHALLENGER M2-1: EMPIRICAL STRESS TEST & ADVERSARIAL VERIFIER');
  console.log('========================================================================\n');

  // Backup all 4 canonical issue files
  const backupMap = new Map();
  const issueFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
  for (const f of issueFiles) {
    backupMap.set(f, fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
  }

  const restoreAllIssues = () => {
    for (const [f, content] of backupMap.entries()) {
      fs.writeFileSync(path.join(DATA_DIR, f), content, 'utf8');
    }
  };

  try {
    // ------------------------------------------------------------------------
    // SUITE 1: Turkish Glyph & Escaped Whitespace Regex Veto Stress Test
    // ------------------------------------------------------------------------
    console.log('[SUITE 1] Turkish Glyph & Escaped Whitespace Regex Veto Stress Test');
    console.log('────────────────────────────────────────────────────────────────────────');

    const targetIssueFile = path.join(DATA_DIR, '2026-09-eylul.json');
    const originalSeptember = backupMap.get('2026-09-eylul.json');

    // 1.1 Test scripts/validate-issues.mjs against standard model mutations
    console.log('\n  --- 1.1: scripts/validate-issues.mjs Veto Probe (Model Mutations) ---');
    for (const v of VARIATIONS) {
      try {
        const obj = JSON.parse(originalSeptember);
        obj.articles[0].summary = `Ana tema ${v.value} olarak planlandı.`;
        fs.writeFileSync(targetIssueFile, JSON.stringify(obj, null, 2), 'utf8');

        const res = runCli(VALIDATOR_SCRIPT);
        const fullOut = res.stdout + res.stderr;
        const hasVeto = fullOut.includes('Yasaklı tema ifadesi bulundu: "Rotary Sihri"');

        testAssert(
          `validate-issues.mjs rejects variation: ${v.name}`,
          res.status === 1 && hasVeto,
          `Status: ${res.status}, Veto logged: ${hasVeto}`
        );
      } finally {
        fs.writeFileSync(targetIssueFile, originalSeptember, 'utf8');
      }
    }

    // 1.1b Test scripts/validate-issues.mjs against raw literal JSON escapes
    console.log('\n  --- 1.1b: scripts/validate-issues.mjs Veto Probe (Raw Literal Injections) ---');
    for (const r of RAW_LITERAL_ESCAPES) {
      try {
        // Splice raw escape directly into target title in JSON text
        const rawInjected = originalSeptember.replace(
          'Eğitimle Büyüyen Umut',
          `${r.rawToken} Eğitimle Büyüyen Umut`
        );
        fs.writeFileSync(targetIssueFile, rawInjected, 'utf8');

        const res = runCli(VALIDATOR_SCRIPT);
        const fullOut = res.stdout + res.stderr;
        const hasVeto = fullOut.includes('Yasaklı tema ifadesi bulundu: "Rotary Sihri"');

        testAssert(
          `validate-issues.mjs rejects raw literal: ${r.name}`,
          res.status === 1 && hasVeto,
          `Status: ${res.status}, Veto logged: ${hasVeto}`
        );
      } finally {
        fs.writeFileSync(targetIssueFile, originalSeptember, 'utf8');
      }
    }

    // 1.2 Test server.mjs createIssue() against all variations
    console.log('\n  --- 1.2: server.mjs createIssue() Veto Probe ---');
    for (const v of VARIATIONS) {
      let threw = false;
      let errorMsg = '';
      try {
        createIssue({
          theme: v.value,
          articles: [{ title: `Etkinlik ve ${v.value}` }]
        });
      } catch (err) {
        threw = true;
        errorMsg = err.message;
      }
      testAssert(
        `createIssue() throws for: ${v.name}`,
        threw && errorMsg.includes('Corporate Branding Violation: "Rotary Sihri" ifadesi kesinlikle kullanılamaz'),
        `Threw: ${threw}, Message: ${errorMsg}`
      );
    }

    // 1.3 Test server.mjs PUT /api/issues/:id HTTP endpoint
    console.log('\n  --- 1.3: server.mjs PUT /api/issues/:id Veto Probe ---');
    const ephemeralPort = 3496;
    const { server, port } = await startServer(ephemeralPort);
    console.log(`  [Server running on ephemeral port ${port}]`);

    try {
      // Test model-stringified variations
      for (const v of VARIATIONS) {
        const bodyStr = JSON.stringify({
          theme: 'KALICI ETKİ YARAT',
          articles: [{ title: `Adversarial title: ${v.value}` }]
        });

        const res = await fetch(`http://127.0.0.1:${port}/api/issues/2026-09-eylul`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr
        });

        const status = res.status;
        const resJson = await res.json();
        const hasViolation = resJson.error && resJson.error.includes('Corporate Branding Violation: "Rotary Sihri"');

        testAssert(
          `PUT /api/issues/:id rejects: ${v.name} (HTTP 400)`,
          status === 400 && hasViolation,
          `Status: ${status}, Response: ${JSON.stringify(resJson)}`
        );
      }

      // Test raw wire HTTP payloads (raw Unicode escapes & raw escaped whitespace)
      for (const r of RAW_LITERAL_ESCAPES) {
        const rawBody = `{"theme":"KALICI ETKİ YARAT","articles":[{"title":"Adversarial ${r.rawToken}"}]}`;
        const res = await fetch(`http://127.0.0.1:${port}/api/issues/2026-09-eylul`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: rawBody
        });

        const status = res.status;
        const resJson = await res.json();
        const hasViolation = resJson.error && resJson.error.includes('Corporate Branding Violation: "Rotary Sihri"');

        testAssert(
          `PUT /api/issues/:id rejects raw wire literal: ${r.name} (HTTP 400)`,
          status === 400 && hasViolation,
          `Status: ${status}, Response: ${JSON.stringify(resJson)}`
        );
      }
    } finally {
      server.close();
      console.log('  [Server closed]');
    }

    // Confirm that 2026-09-eylul.json was never modified by PUT attempts
    const afterPutSept = fs.readFileSync(targetIssueFile, 'utf8');
    testAssert(
      'Target issue 2026-09-eylul.json remained completely unmodified after all rejected PUT attempts',
      afterPutSept === originalSeptember
    );

    console.log();

    // ------------------------------------------------------------------------
    // SUITE 2: Path Traversal & Cleanup Adversarial Probe
    // ------------------------------------------------------------------------
    console.log('[SUITE 2] Path Traversal & Cleanup Adversarial Probe');
    console.log('────────────────────────────────────────────────────────────────────────');

    // 2.1 Malicious CLI argument injection
    const MALICIOUS_ISSUES = [
      { arg: '../../package.json', desc: 'Relative traversal to package.json' },
      { arg: '../etc/passwd', desc: 'Unix-style root traversal to etc/passwd' },
      { arg: 'invalid*id', desc: 'Wildcard glob injection' },
      { arg: '..\\..\\package.json', desc: 'Windows backslash traversal' },
      { arg: '2026-09-eylul/../../package.json', desc: 'Nested directory traversal attempt' },
      { arg: 'nonexistent-issue-999', desc: 'Arbitrary non-existent issue name' }
    ];

    for (const probe of MALICIOUS_ISSUES) {
      const res = runCli(EXPORT_SCRIPT, ['--issue', probe.arg]);
      testAssert(
        `CLI rejects malicious issue "${probe.arg}" (${probe.desc}) with exit code 1`,
        res.status === 1,
        `Exit: ${res.status}`
      );
      testAssert(
        `CLI reports graceful rejection for "${probe.arg}"`,
        res.stderr.includes('Issue not found or invalid'),
        `Stderr: ${res.stderr.trim()}`
      );
    }

    // Verify zero files created outside output/
    const forbiddenArtifacts = [
      path.join(PROJECT_ROOT, 'package.json.pdf'),
      path.join(PROJECT_ROOT, 'package.pdf'),
      path.join(PROJECT_ROOT, 'passwd.pdf'),
      path.join(PROJECT_ROOT, '..', 'package.json.pdf'),
      path.join(PROJECT_ROOT, 'nonexistent-issue-999.pdf')
    ];
    for (const f of forbiddenArtifacts) {
      testAssert(`No escaped artifact created at: ${path.basename(f)}`, !fs.existsSync(f));
    }

    // 2.2 Programmatic sanitizeIssueId unit tests
    testAssert('sanitizeIssueId(null) returns null', sanitizeIssueId(null) === null);
    testAssert('sanitizeIssueId("") returns null', sanitizeIssueId('') === null);
    testAssert('sanitizeIssueId(123) returns null', sanitizeIssueId(123) === null);
    testAssert('sanitizeIssueId("../../package.json") sanitizes to "package"', sanitizeIssueId('../../package.json') === 'package');
    testAssert('sanitizeIssueId("../etc/passwd") sanitizes to "passwd"', sanitizeIssueId('../etc/passwd') === 'passwd');
    testAssert('sanitizeIssueId("invalid*id") returns null', sanitizeIssueId('invalid*id') === null);
    testAssert('sanitizeIssueId("2026-09-eylul.json") strips .json extension to "2026-09-eylul"', sanitizeIssueId('2026-09-eylul.json') === '2026-09-eylul');

    // 2.3 Failure Cleanup Probe: Ensure no partial/corrupted PDF is left behind on error
    console.log('\n  --- 2.3: Failure Cleanup & Corrupt PDF Unlink Probe ---');
    const testOutputDir = path.join(PROJECT_ROOT, 'output', 'test-challenger-cleanup');
    fs.mkdirSync(testOutputDir, { recursive: true });

    try {
      const corruptDestFile = path.join(testOutputDir, 'Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf');
      // Pre-seed corrupt file to simulate partial write during crashed run
      fs.writeFileSync(corruptDestFile, '%PDF-1.4 CORRUPT HEADER TRUNCATED', 'utf8');

      let exportThrew = false;
      let exportErrorMsg = '';

      // Invoke exportIssueToPDF pointing to unreachable port
      try {
        await exportIssueToPDF('2026-09-eylul', {
          outputDir: testOutputDir,
          port: 1 // unreachable port
        });
      } catch (err) {
        exportThrew = true;
        exportErrorMsg = err.message;
      }

      testAssert(
        'exportIssueToPDF throws on render/connection failure',
        exportThrew,
        `Error: ${exportErrorMsg}`
      );

      testAssert(
        'Failure cleanup: partial/corrupt PDF is unlinked and absent from output directory',
        !fs.existsSync(corruptDestFile),
        `Corrupt file unexpectedly remained at ${corruptDestFile}`
      );
    } finally {
      if (fs.existsSync(testOutputDir)) {
        try {
          fs.rmSync(testOutputDir, { recursive: true, force: true });
        } catch {}
      }
    }

    // 2.4 %TEMP% Chrome Profile Directory Lifecycle Probe
    console.log('\n  --- 2.4: %TEMP% Chrome Profile Directory Lifecycle Probe ---');
    const tmpDir = os.tmpdir();

    // Purge any preexisting stale profiles
    cleanupStaleTempProfiles();

    const countActiveProfiles = () => {
      try {
        return fs.readdirSync(tmpDir).filter(f => f.startsWith('galata-pdf-chrome-')).length;
      } catch {
        return 0;
      }
    };

    const countBefore = countActiveProfiles();
    console.log(`  Active Chrome profiles in %TEMP% before export: ${countBefore}`);

    // Run valid single export
    const exportResult = runCli(EXPORT_SCRIPT, ['--issue', '2026-07-temmuz']);
    testAssert(
      'Export script executed successfully for 2026-07-temmuz',
      exportResult.status === 0,
      `Status: ${exportResult.status}, Stderr: ${exportResult.stderr}`
    );

    const countAfter = countActiveProfiles();
    console.log(`  Active Chrome profiles in %TEMP% after export: ${countAfter}`);

    testAssert(
      'Zero orphaned galata-pdf-chrome-* directories remain in %TEMP% after export run',
      countAfter <= countBefore,
      `Before: ${countBefore}, After: ${countAfter}`
    );

    console.log();

    // ------------------------------------------------------------------------
    // SUITE 3: Run Existing Test Suites
    // ------------------------------------------------------------------------
    console.log('[SUITE 3] Verification of Existing Test Suites');
    console.log('────────────────────────────────────────────────────────────────────────');

    const testSuites = [
      { name: 'challenger-m1-dual-mode.mjs', file: 'tests/challenger-m1-dual-mode.mjs' },
      { name: 'challenger-m1-empirical-tests.mjs', file: 'tests/challenger-m1-empirical-tests.mjs' },
      { name: 'challenger-m2-empirical-tests.mjs', file: 'tests/challenger-m2-empirical-tests.mjs' }
    ];

    for (const suite of testSuites) {
      console.log(`  Executing: node ${suite.file}...`);
      const res = runCli(path.join(PROJECT_ROOT, suite.file));
      testAssert(
        `Test suite ${suite.name} executed cleanly with exit code 0`,
        res.status === 0,
        `Exit: ${res.status}, Stderr: ${res.stderr.slice(0, 300)}`
      );
    }

  } finally {
    // Restore all issues to guarantee pristine workspace
    restoreAllIssues();
  }

  console.log();
  console.log('========================================================================');
  console.log('  CHALLENGER M2-1 TEST SUMMARY');
  console.log('========================================================================');
  console.log(`  Total Evaluated Assertions : ${totalTests}`);
  console.log(`  Passed                     : ${passedTests}`);
  console.log(`  Failed                     : ${failedTests}`);
  console.log(`  Adversarial Findings       : ${findings.length}`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    console.error(`VERDICT: REQUEST_CHANGES (${failedTests} test assertions failed)`);
    process.exit(1);
  } else {
    console.log('VERDICT: APPROVE (All Turkish glyph, whitespace, traversal, and cleanup tests PASSED 100%)');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
