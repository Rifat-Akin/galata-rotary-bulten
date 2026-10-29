# Galata Rotary Bülten Stüdyosu — E2E Test Infrastructure (TEST_INFRA)

## 1. Overview & Test Methodology

This document outlines the opaque-box End-to-End (E2E) testing infrastructure for the **Galata Rotary Bülten Stüdyosu** web application, rendering engine, and the 2026–2027 monthly bulletins production pipeline.

The testing architecture follows a strict **4-Tier Progressive Verification Methodology** designed to ensure both isolated feature compliance and full-pipeline end-to-end integration without relying on fragile implementation internals:

1. **Tier 1: Feature Coverage (Isolation)**
   - Verifies each of the 21 project features listed in `PROJECT.md § Feature Inventory` in isolation.
   - Validates existence, functional contracts, schemas, and error behavior of individual components (REST API, standalone renderer, PDF scripts, UI files, theme validation, and corporate masthead).

2. **Tier 2: Boundary & Corner Cases**
   - Tests extreme inputs, edge values, and constraint limits.
   - Rigorously validates Turkish UTF-8 typography (`ğ, ü, ş, ı, İ, ö, ç`, preserving uppercase/lowercase dotted/dotless I), strict 0 "Rotary Sihri" veto (adversarial rejection of legacy theme tokens), A4 height overflow triggers (>297mm), missing image fallbacks, and 7–9 page count compliance.

3. **Tier 3: Cross-Feature Combinations**
   - Tests interactions across multiple subsystems.
   - Validates Bento layout modes (`single-col`, `two-col`, `bento-3`, `bento-4`) paired with variable photo counts (1–4), 12-month Rotary Calendar synchronization (only Page 2 active, active month highlighted with gold border `#F7A81B`), and CSS parity between live studio preview and headless print media.

4. **Tier 4: Real-World Application Scenarios**
   - Full pipeline execution: JSON data models -> DOM rendering -> Chrome Headless (`--headless=new --print-to-pdf`) -> 300 DPI vector PDF generation for all 4 issues (July, August, September, October 2026).
   - Validates generated PDF signatures (`%PDF-`), non-empty sizes (>100 KB), full-page crimson (`#E01E26`) "ÇOCUK FELCİNE SON" back cover, and editorial book accuracy.

---

## 2. Progressive Testability & Milestone Lifecycle

During project execution, features are delivered incrementally across milestones:
- **M1**: Data Pipeline, WhatsApp selective photo extraction, brand assets, 4 monthly JSON models, and `validate-issues.mjs`.
- **M2**: Decoupled A4 renderer (`public/renderer.js`), print CSS (`bulletin-print.css`), and native Chrome PDF generator CLI (`scripts/export-pdf.mjs`).
- **M3**: Web-based Bülten Stüdyosu (`server.mjs`, `public/index.html`, `public/studio.js`, `public/styles/studio.css`, `baslat.bat`).
- **M4**: Magazine issues generation and verification in `output/` (4 A4 PDFs, 7–9 pages each).
- **M5**: GitHub repo, live GitHub Pages deployment (`.github/workflows/deploy.yml`), and disk hygiene.

### Progressive Test Execution Policy
To prevent false failures when testing an early milestone while maintaining complete forward test coverage:
1. Every test declares its **Milestone Dependency** (`M1`, `M2`, `M3`, `M4`, `M5`).
2. When running with `--milestone <MX>`, only tests matching that milestone and its completed dependencies are evaluated.
3. When running in default mode (`node tests/e2e-harness.mjs`), if a test's target implementation artifact is not yet created in the workspace, the test is cleanly marked as `[PENDING - Milestone MX]` with an informative explanation rather than failing the run.
4. Once the target milestone is implemented, the same test automatically switches to active assertion mode, validating the real implementation without modifying test code.
5. In addition to artifact tests, self-contained **oracle and adversarial specification tests** run in all environments to continuously verify the validity of contracts, schemas, and boundary assertions.

---

## 3. Directory Layout

The E2E testing infrastructure is organized under `tests/`:

```
C:\Users\Asus\.gemini\antigravity\scratch\galata-rotary-bulten/
├── tests/
│   ├── e2e-harness.mjs            # Standalone Test Runner CLI and assertion engine
│   ├── test-suites.mjs            # Aggregator registry combining all 4 test tiers
│   ├── tier1-features.mjs         # Tier 1: 21 Isolated Feature Coverage Tests
│   ├── tier2-boundary.mjs         # Tier 2: Boundary, Turkish glyphs & Adversarial Tests
│   ├── tier3-combinations.mjs     # Tier 3: Bento layout, calendar & preview-print parity
│   ├── tier4-scenarios.mjs        # Tier 4: Full-pipeline PDF generation & Real-world checks
│   └── fixtures/
│       └── mock-issues.mjs        # Reference mock issues, adversarial poison models, and edge data
├── TEST_INFRA.md                  # This specification document
└── TEST_READY.md                  # Test suite readiness sign-off report
```

---

## 4. Test Catalog

### Tier 1: Feature Coverage (Features 1–21)
| ID | Feature | Target Artifact | Expected Behavior / Contract | Milestone |
|---|---------|-----------------|------------------------------|-----------|
| T1-F01 | Launcher & Start Script | `baslat.bat`, `package.json` | Script launches server on port 3420; `package.json` defines `"start": "node server.mjs"` | M3 |
| T1-F02 | Modular REST API | `server.mjs` | Routes `GET /api/issues`, `GET /api/issues/:id`, `PUT /api/issues/:id`, `/api/upload`, `/api/rotaclub/sync` | M3 |
| T1-F03 | Decoupled Renderer | `public/renderer.js` | Exports pure JS rendering function generating A4 semantic DOM from issue JSON | M2 |
| T1-F04 | Split-Screen Studio UI | `public/index.html`, `studio.js` | Two-pane layout: left edit forms, right live A4 preview with zoom controls | M3 |
| T1-F05 | Bento Grid Classes | `public/styles/bulletin-print.css` | Implements `.single-col`, `.two-col`, `.bento-3`, `.bento-4` CSS grid rules | M2 |
| T1-F06 | A4 Overflow Detection | `public/studio.js` | Contains height checking logic warning when content exceeds 297mm | M3 |
| T1-F07 | New Month Initializer | `server.mjs`, `studio.js` | Generates next month issue JSON template with standard masthead | M3 |
| T1-F08 | Headless Chrome Generator | `scripts/export-pdf.mjs` | CLI script invoking Chrome with `--headless=new --print-to-pdf` | M2 |
| T1-F09 | Batch PDF CLI | `scripts/export-pdf.mjs` | Supports `--all` flag to export all 4 monthly issues in a single batch | M2 |
| T1-F10 | Corporate Theme Veto | `scripts/validate-issues.mjs` | Enforces "KALICI ETKİ YARAT" and strictly forbids "Rotary Sihri" (0 occurrences) | M1 |
| T1-F11 | Page 1 Cover & Künye | Issue JSONs & Renderer | Künye contains RI President Olayinka Babalola, Dist. Gov Erden Gökmen, Club President Sevilay Aksel, 7 Focus Areas | M1, M2 |
| T1-F12 | Page 2 President Message | Issue JSONs & Renderer | 2/3 President Message + 1/3 12-Month Calendar; active month highlighted in gold `#F7A81B` | M1, M2 |
| T1-F13 | Back Cover Polio Theme | Issue JSONs & Renderer | Full-page crimson `#E01E26` closing page with "ÇOCUK FELCİNE SON" and `@galatarotarykulubu` | M1, M2 |
| T1-F14 | July 2026 Issue (Sayı 1) | `data/issues/2026-07-temmuz.json` | Maternal & Child Health; meeting 1008, Czech exchange, Sıla, İlhan Eksen book | M1 |
| T1-F15 | August 2026 Issue (Sayı 2) | `data/issues/2026-08-agustos.json` | Membership Month; Grand Hyatt move, Gaye Binark, medical donations, 30 August, Pera book | M1 |
| T1-F16 | September 2026 Issue (Sayı 3) | `data/issues/2026-09-eylul.json` | Basic Education; Ritz cinema, Pınar Pirim, CP stroller, 23rd anniv, Timurtaş Onan book | M1 |
| T1-F17 | October 2026 Issue (Sayı 4) | `data/issues/2026-10-ekim.json` | Economic Dev & Polio; RYLA, wheelchair, 4000 TL burs, Sibel Usanma, Celali Yılmaz book | M1 |
| T1-F18 | Photo Selective Extractor | `scripts/extract-curated-photos.py` | Extracts only curated photos into `public/assets/photos/` without unzipping full 919 MB | M1 |
| T1-F19 | Validation Script CLI | `scripts/validate-issues.mjs` | Standalone CLI verifying schema, Turkish encoding, and theme rules (exit code 0 on pass) | M1 |
| T1-F20 | Git Repo & CI/CD Workflow | `.github/workflows/deploy.yml` | Valid GitHub Actions workflow deploying to GitHub Pages | M5 |
| T1-F21 | Disk Hygiene & Cleanup | Project Root / `.gitignore` | Workspace free of bloated temporary archives; `.gitignore` ignores zips, logs, temp | M5 |

---

### Tier 2: Boundary & Corner Cases
| ID | Test Case | Target / Method | Expected Output / Assertion |
|---|-----------|-----------------|-----------------------------|
| T2-01 | Turkish UTF-8 Glyph Integrity | Issue JSONs & Renderer | All Turkish characters (`ğ, ü, ş, ı, İ, ö, ç, Ğ, Ü, Ş, I, İ, Ö, Ç`) encoded cleanly. 0 mojibake strings (`Ã§`, `Ã¼`, `ÅŸ`, `Ã¶`, `ÄŸ`, `Ä±`). |
| T2-02 | Adversarial Theme Veto | Poisoned Issue Model | Injecting "Rotary Sihri" into issue title/body triggers immediate validation error / rejection. |
| T2-03 | Empty & Ultra-Long Text Fields | Article Summaries | Empty summary handled gracefully; long 1500+ character text renders safely without breaking DOM. |
| T2-04 | Variable Photo Count Bounds | Article Photos Array | Handles 0, 1, 2, 3, and 4 photos without throwing exceptions or unstyled gaps. |
| T2-05 | Missing Image Graceful Fallback | Image Loader | When image path is missing/broken, renderer applies placeholder styling and does not abort layout. |
| T2-06 | A4 Height Overflow Indicator | Studio Preview Controller | Content exceeding 297mm height boundary on an A4 page flags a visual warning or `.has-overflow` class. |
| T2-07 | Strict 7–9 Page Count Bounds | Issue Page Count | Validates total pages are strictly between 7 and 9 inclusive. Rejects <7 or >9 pages. |

---

### Tier 3: Cross-Feature Combinations
| ID | Test Case | Subsystems Verified | Expected Output / Assertion |
|---|-----------|---------------------|-----------------------------|
| T3-01 | Bento Layout Combinations | Layout Modes x Photo Counts | Tests all matrix combinations (`single-col` with 1 photo, `two-col` with 2 photos, `bento-3` with 3 photos, `bento-4` with 4 photos). CSS grid template rules verified. |
| T3-02 | Calendar Month Highlighting Sync | Month Field x Calendar Matrix | Verifies that for each monthly issue (Temmuz=7, Ağustos=8, Eylül=9, Ekim=10), ONLY that specific month gets gold border `#F7A81B`; other 11 months have standard borders; calendar is strictly on Page 2. |
| T3-03 | Live Preview & Print CSS Parity | `studio.css` x `bulletin-print.css` | Verifies `@page { size: 210mm 297mm; margin: 0; }`, `.a4-page` dimensions (`210mm x 297mm`), `print-color-adjust: exact`, and ivory `#FAF8F3` background match in both views. |

---

### Tier 4: Real-World Application Scenarios
| ID | Test Case | Target / Method | Expected Output / Assertion |
|---|-----------|-----------------|-----------------------------|
| T4-01 | Full Headless Chrome Pipeline | `scripts/export-pdf.mjs` Execution | Invokes native Chrome headless (`--headless=new --print-to-pdf`) to generate PDF. Verifies process exit code 0. |
| T4-02 | 4 Monthly PDFs Integrity Check | `output/Galata_Rotary_Bulten_*.pdf` | All 4 PDFs exist in `output/`, binary header starts with `%PDF-`, size > 100 KB each. |
| T4-03 | Back Cover Polio Closing Verification | Issue JSONs & Rendered HTML | Verifies full-page crimson `#E01E26` closing page with exact text `"ÇOCUK FELCİNE SON"`, `"End Polio Now"`, and `@galatarotarykulubu`. |
| T4-04 | Cultural Book Recommendation Accuracy | Issue JSONs & Books Metadata | Verifies correct editorial books: July (İlhan Eksen), August (Pera Hatıratı), September (Timurtaş Onan – Beyoğlu: Eski Yeni), October (Celali Yılmaz – Galata Hanları 1868–1945). |

---

## 5. Authoritative Expected Output Derivations & Tolerances

| Metric / Field | Authoritative Source | Value / Specification | Tolerance |
|---|---|---|---|
| 2026–2027 Theme | `PROJECT.md`, WhatsApp archive | `"KALICI ETKİ YARAT"` | Strict exact match |
| Legacy Theme Veto | `PROJECT.md`, Approved Plan | `"Rotary Sihri"` | Strictly 0 occurrences |
| District & Club No | Approved Plan, Künye | `UR 2420. Bölge`, `No: 64336` | Strict exact match |
| Page Dimensions | W3C CSS Paged Media, Plan §2 | `210mm × 297mm` (A4 Portrait) | Exact mm units |
| Page Margins | Headless Chrome `@page` | `margin: 0` | Strict 0 margins |
| Page Count | Approved Plan §2 | `7 to 9 pages` | Integer range `[7, 9]` |
| Back Cover Title | Approved Plan §2, Turkish rules | `"ÇOCUK FELCİNE SON"` | Exact UTF-8 string |
| Back Cover Color | Corporate identity guidelines | `#E01E26` (Polio Crimson) | Exact hex |
| Page Background | Corporate identity guidelines | `#FAF8F3` (Sıcak Fildişi) | Exact hex |
| Active Month Highlight | Corporate identity guidelines | `#F7A81B` (Rotary Altını) | Exact hex |
| PDF Byte Signature | PDF Specification ISO 32000 | Starts with `%PDF-` | Exact prefix |
| PDF File Size | Chrome Print Engine Output | `> 100,000 bytes` | Min threshold |

---

## 6. How to Run Tests

The test runner is implemented in native Node.js ES Modules (`tests/e2e-harness.mjs`). No external testing framework dependencies are required.

### Basic Execution (All Suites with Progressive Reporting)
```powershell
node tests/e2e-harness.mjs
```

### Run by Tier
```powershell
# Run Tier 1 (Feature Coverage)
node tests/e2e-harness.mjs --tier 1

# Run Tier 2 (Boundary & Corner Cases)
node tests/e2e-harness.mjs --tier 2

# Run Tier 3 (Cross-Feature Combinations)
node tests/e2e-harness.mjs --tier 3

# Run Tier 4 (Real-World Application Scenarios)
node tests/e2e-harness.mjs --tier 4
```

### Run by Milestone
```powershell
# Run tests applicable to Milestone 1
node tests/e2e-harness.mjs --milestone M1

# Run tests applicable to Milestone 2
node tests/e2e-harness.mjs --milestone M2
```

### Additional Options
```powershell
# Verbose output with full assertion details
node tests/e2e-harness.mjs --verbose

# Run specific issue validation
node tests/e2e-harness.mjs --issue 2026-09-eylul

# Compact summary table only
node tests/e2e-harness.mjs --summary
```

### Exit Codes
- `0`: All executed tests passed (or are pending future milestones).
- `1`: One or more executed tests failed due to assertion errors or regressions.
