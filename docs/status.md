# Project Helix — Project Status

**Current milestone:** Dataset v1.1 — Missing Values Resolved ✅

---

## Completed

* [x] **118 chemical elements** collected from raw periodic table JSON
* [x] **15 canonical features** selected and ordered
* [x] **JSON → pandas DataFrame pipeline** automated in `src/dataset.py`
* [x] **Dataset exported to CSV** at `data/dataset_v1.csv`
* [x] **Structural validation automated** with 100% check pass rate
* [x] **Thermodynamic consistency verified**
* [x] **Physical boundaries validated** (all masses, densities, temperatures > 0)
* [x] **Missing-value analysis completed** and mapped to physical etiology
* [x] **118 source URLs verified** as unique HTTPS Wikipedia entries
* [x] **Reusable Python API layer created** (`HelixDataset` with lookup, filter, and summary tools)
* [x] **Dataset v1.1 released** — 53 missing cells resolved (EXP / THEO / INTERP / CONV)
* [x] **Full per-cell audit trail** written to `docs/dataset-v1-1-changelog.md`
* [x] **Helix Dashboard built** — interactive element explorer at `dashboard/index.html`

---

## Accuracy & Verification Summary

| Verification Category | v1 Status | v1.1 Status | Pass Rate |
|---|:---:|:---:|---:|
| Element Sequence (1 to 118) | Verified | Verified | **100.0%** |
| Unique Identifiers (`number`, `symbol`, `name`) | Verified | Verified | **100.0%** |
| Periodic System Bounds (Periods 1-7, Groups 1-18, Blocks s/p/d/f) | Verified | Verified | **100.0%** |
| Physical Non-negativity (mass, density, temperatures > 0) | Verified | Verified | **100.0%** |
| Source URL Validity | Verified | Verified | **100.0%** |
| Cell Completeness Rate | 94.58% | **97.57%** | — |

> Carbon and Arsenic have documented phase-diagram anomalies where standard melt/boil ordering does not apply at 1 atm. Flagged in the changelog.

---

## Dataset v1.1 — Missing Value Resolution Summary

| Feature | v1 Missing | v1.1 Missing | Change |
|---------|-----------|-------------|--------|
| `density` | 4 | 0 | -4 (resolved) |
| `melt` | 11 | 0 | -11 (resolved) |
| `boil` | 14 | 0 | -14 (resolved) |
| `molar_heat` | 40 | 15 | -25 (Z>=104 remain) |
| `electron_affinity` | 9 | 10 | (superheavy blanks retained) |
| `electronegativity_pauling` | 18 | 18 | (He/Ne/Ar intentionally undefined) |
| **Total** | **96** | **43** | **-53 cells resolved** |

See `docs/dataset-v1-1-changelog.md` for the full per-cell audit.

---

## Current Focus: Phase 2 (remaining) & Phase 3

### Phase 2 (remaining): Data Verification & Provenance
1. Build the complete Helix data dictionary (`docs/data_dict.md`) with IUPAC definitions and standard units.
2. Full property-level provenance auditing (benchmark `atomic_mass` against IUPAC CIAAW standard weights).
3. Formally document the Carbon and Arsenic phase-diagram anomalies.

### Phase 3: Exploratory Data Analysis (EDA)
1. Initialize Jupyter notebooks in `notebooks/`.
2. Compute descriptive statistics, correlation matrices, and distribution plots.
3. Visualize periodic trends (electronegativity trends across groups/periods, density curves).

---

## Current Dataset Architecture

| Property | Value |
|---|---:|
| Elements | 118 |
| Features | 15 |
| Dataset version | **v1.1** |
| Status | **Values Resolved** |
| Completeness | **97.57%** (1,727 / 1,770 cells) |
| EXP fills | 20 |
| THEO fills | 36 |
| Intentionally blank | 43 |
| Source coverage | 118 / 118 |
| Python API | `from src import HelixDataset, load_dataset` |

---

## Principle

> **Understand the data before trying to model it.**
