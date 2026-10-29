#!/usr/bin/env node
/**
 * Galata Rotary Bülten Stüdyosu — E2E Test Harness Runner
 * Progressive, 4-tier test runner supporting isolated feature tests,
 * boundary/adversarial cases, cross-feature combinations, and full pipeline scenarios.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllSuites } from './test-suites.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function parseArgs(args) {
  const options = {
    tier: null,
    milestone: null,
    issue: null,
    verbose: false,
    summaryOnly: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tier' && args[i + 1]) {
      options.tier = parseInt(args[++i], 10);
    } else if (arg === '--milestone' && args[i + 1]) {
      options.milestone = args[++i].toUpperCase();
    } else if (arg === '--issue' && args[i + 1]) {
      options.issue = args[++i];
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--summary') {
      options.summaryOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
${colors.bold}${colors.cyan}Galata Rotary Bülten Stüdyosu — E2E Test Harness${colors.reset}

Usage:
  node tests/e2e-harness.mjs [options]

Options:
  --tier <1-4>         Run only the specified test tier (1: Features, 2: Boundary, 3: Combos, 4: Scenarios)
  --milestone <M1-M5>  Filter tests to features within the specified milestone and completed dependencies
  --issue <id>         Focus validation on specific monthly issue (e.g. 2026-09-eylul)
  --verbose            Print detailed test diagnostic messages and stacks
  --summary            Display only summary table
  --help, -h           Show this help manual
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const startTime = Date.now();
  console.log(`\n${colors.bold}${colors.blue}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  GALATA ROTARY BÜLTEN STÜDYOSU — E2E TEST HARNESS RUNNER${colors.reset}`);
  console.log(`${colors.dim}  Project Root: ${projectRoot}${colors.reset}`);
  if (options.tier) console.log(`${colors.yellow}  Target Tier: Tier ${options.tier}${colors.reset}`);
  if (options.milestone) console.log(`${colors.yellow}  Target Milestone: ${options.milestone}${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}========================================================================${colors.reset}\n`);

  const allSuites = getAllSuites(projectRoot);
  const results = [];
  let totalPassed = 0;
  let totalPending = 0;
  let totalFailed = 0;

  const milestoneOrder = ['M1', 'M2', 'M3', 'M4', 'M5'];

  for (const suite of allSuites) {
    if (options.tier && suite.tier !== options.tier) {
      continue;
    }

    if (!options.summaryOnly) {
      console.log(`${colors.bold}${colors.white}[TIER ${suite.tier}] ${suite.name}${colors.reset}`);
      console.log(`${colors.dim}${'─'.repeat(72)}${colors.reset}`);
    }

    for (const test of suite.tests) {
      // Filter by milestone if specified
      if (options.milestone && test.milestone) {
        const testIdx = milestoneOrder.indexOf(test.milestone);
        const targetIdx = milestoneOrder.indexOf(options.milestone);
        if (testIdx > targetIdx) {
          // Skip tests from future milestones
          continue;
        }
      }

      const tStart = Date.now();
      let status = 'PASS';
      let message = '';
      let error = null;

      try {
        const res = await test.run();
        if (res && res.status) {
          status = res.status;
          message = res.message || '';
        }
      } catch (err) {
        status = 'FAIL';
        error = err;
        message = err.message || String(err);
      }

      const duration = Date.now() - tStart;

      if (status === 'PASS') {
        totalPassed++;
        if (!options.summaryOnly) {
          console.log(`  ${colors.green}✔ [PASS]${colors.reset} ${colors.bold}${test.id}${colors.reset} - ${test.title} ${colors.dim}(${duration}ms)${colors.reset}`);
          if (options.verbose && message) {
            console.log(`    ${colors.dim}Detail: ${message}${colors.reset}`);
          }
        }
      } else if (status === 'PENDING') {
        totalPending++;
        if (!options.summaryOnly) {
          console.log(`  ${colors.yellow}○ [PENDING]${colors.reset} ${colors.bold}${test.id}${colors.reset} - ${test.title} ${colors.dim}[${test.milestone || 'NEXT'}]: ${message}${colors.reset}`);
        }
      } else {
        totalFailed++;
        if (!options.summaryOnly) {
          console.log(`  ${colors.red}✖ [FAIL]${colors.reset} ${colors.bold}${test.id}${colors.reset} - ${test.title} ${colors.dim}(${duration}ms)${colors.reset}`);
          console.log(`    ${colors.red}Error: ${message}${colors.reset}`);
          if (options.verbose && error && error.stack) {
            console.log(`    ${colors.dim}${error.stack}${colors.reset}`);
          }
        }
      }

      results.push({
        id: test.id,
        tier: suite.tier,
        title: test.title,
        milestone: test.milestone,
        status,
        duration,
        message
      });
    }

    if (!options.summaryOnly) {
      console.log();
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // Print Summary Table
  console.log(`${colors.bold}${colors.blue}========================================================================${colors.reset}`);
  console.log(`${colors.bold}  TEST EXECUTION SUMMARY${colors.reset}`);
  console.log(`${colors.blue}========================================================================${colors.reset}`);
  console.log(`  Total Evaluated Tests : ${results.length}`);
  console.log(`  Passed                : ${colors.green}${totalPassed}${colors.reset}`);
  console.log(`  Pending / Progressive : ${colors.yellow}${totalPending}${colors.reset}`);
  console.log(`  Failed                : ${totalFailed > 0 ? colors.red : colors.reset}${totalFailed}${colors.reset}`);
  console.log(`  Execution Time        : ${totalTime}s`);
  console.log(`${colors.blue}========================================================================${colors.reset}`);

  if (totalFailed > 0) {
    console.log(`\n${colors.red}${colors.bold}STATUS: FAILED (${totalFailed} failure(s) detected)${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}STATUS: PASSED (All evaluated tests compliant; ${totalPending} pending future milestone implementation)${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`\n${colors.red}Unhandled harness execution error:${colors.reset}`, err);
  process.exit(1);
});
