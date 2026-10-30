# Project: Galata Rotary Bülten Stüdyosu

## Architecture
- **Backend**: `server.mjs` (Node.js native HTTP REST API, validation guards, PDF generator wrapper)
- **Frontend Studio**: `public/studio.js` (Studio app, dual-mode storage adapter, DOM event bindings, zoom & overflow controllers)
- **Renderer & Layout**: `public/renderer.js` (Deterministic A4 magazine paginator, Bento grids, cultural section)
- **Styling**: `public/styles/studio.css`, `public/styles/bulletin-print.css` (210mm x 297mm exact print layout, #E01E26 Polio back cover)
- **Scripts**: `scripts/export-pdf.mjs` (Native headless Chrome A4 PDF printer), `scripts/validate-issues.mjs`
- **CI/CD**: `.github/workflows/deploy.yml` (GitHub Pages deploy on push to `main`)

## Feature Inventory
Every feature identified during the Step 0 Survey is assigned to a milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Reader Mode Keyboard Navigation | ArrowLeft/PageUp and ArrowRight/PageDown page flipping in Reader Mode | M1 | Survey (Explorer 1) |
| 2 | Ctrl+Wheel Zooming | Zooming viewport smoothly via Ctrl+MouseWheel | M1 | Survey (Explorer 1) |
| 3 | Issue Switch Page Reset | Reset `currentReaderPage` to 1 when changing issues | M1 | Survey (Explorer 1) |
| 4 | Multi-Page Overflow Cycling | Clicking overflow badge cycles through all overflowing pages sequentially | M1 | Survey (Explorer 1) |
| 5 | Month Numbering Resolution | Resolve `monthNumStr` from `targetMonth` in `MONTH_ORDER` in `server.mjs` | M1 | Survey (Explorer 1) |
| 6 | Test Script Harmonization | Add `test:all` script in `package.json` executing all suites | M1 | Survey (Explorer 1) |
| 7 | Static Issue Catalog Staging | Track `data/issues/index.json` in git for static mode | M1 | Survey (Explorer 1) |
| 8 | 4 Monthly A4 PDF Generation | Regenerate 4 PDFs in `output/` with 7–9 pages each | M2 | Survey (Explorer 2) |
| 9 | Visual Quality & Typography Verification | Zero text truncation, zero visual overflow, 300 DPI vector text | M2 | Survey (Explorer 2) |
| 10 | 2026–2027 Term Theme Enforcement | "KALICI ETKİ YARAT" across all models, UI, and outputs | M3 | Survey (Explorer 3) |
| 11 | Zero "Rotary Sihri" Veto | Absolute zero occurrence across repo, with multi-tier rejection guards | M3 | Survey (Explorer 3) |
| 12 | End Polio Now Back Cover | Full-page A4 crimson (`#E01E26`) back cover on final page | M3 | Survey (Explorer 3) |
| 13 | Digital Debris Cleanup | Remove temp files, scratch artifacts, ensure clean workspace | M3 | Survey (Explorer 3) |
| 14 | Git Synchronization & Pages Deployment | Commit all changes, push to main, verify live site | M4 | Survey (Explorer 3) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Application Review & UI/UX Enhancement | `public/studio.js`, `server.mjs`, `package.json`, `data/issues/index.json` | Survey | PLANNED |
| M2 | Output Generation & Visual Quality Verification | `scripts/export-pdf.mjs`, `output/*.pdf` verification | M1 | PLANNED |
| M3 | Corporate Identity & Digital Debris Cleanup | Strict governance validation, debris cleanup | M1, M2 | PLANNED |
| M4 | Git Synchronization & Deployment Verification | Git commit, push to main, verify GitHub Pages | M1, M2, M3 | PLANNED |

## Code Layout
- `public/`: Web frontend assets, studio app, layout engine, styles
- `data/issues/`: JSON models for monthly issues and catalog index
- `scripts/`: Validation and PDF export CLI tools
- `tests/`: 4-tier E2E harness and empirical challenger suites
- `output/`: Generated A4 monthly PDF bulletins
- `.github/workflows/`: CI/CD automation for GitHub Pages
