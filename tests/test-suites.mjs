/**
 * Test Suites Aggregator
 * Consolidates all 4 test tiers into a unified registry.
 */

import { createTier1Suites } from './tier1-features.mjs';
import { createTier2Suites } from './tier2-boundary.mjs';
import { createTier3Suites } from './tier3-combinations.mjs';
import { createTier4Suites } from './tier4-scenarios.mjs';

export function getAllSuites(projectRoot) {
  return [
    {
      tier: 1,
      name: 'Tier 1: Feature Coverage (Features 1–21 in isolation)',
      tests: createTier1Suites(projectRoot)
    },
    {
      tier: 2,
      name: 'Tier 2: Boundary & Corner Cases (Turkish glyphs, 0 Rotary Sihri, overflows, limits)',
      tests: createTier2Suites(projectRoot)
    },
    {
      tier: 3,
      name: 'Tier 3: Cross-Feature Combinations (Bento grids, calendar sync, preview/print parity)',
      tests: createTier3Suites(projectRoot)
    },
    {
      tier: 4,
      name: 'Tier 4: Real-World Application Scenarios (Full pipeline, 4 PDFs, back cover, books)',
      tests: createTier4Suites(projectRoot)
    }
  ];
}
