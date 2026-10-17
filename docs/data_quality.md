# Project Helix — Data Quality & Accuracy Summary

> Full comprehensive report available at: [docs/data-quality-report.md](file:///c:/Users/H%20Siddarth/Documents/GitHub/Project-Helix/docs/data-quality-report.md)

## Verification Scorecard

| Dimension | Target | Result | Accuracy Rate |
|---|---|---|:---:|
| Total Elements | 118 | 118 | **100% PASS** |
| Feature Columns | 15 | 15 | **100% PASS** |
| Identifier Uniqueness | `number`, `symbol`, `name` | All unique | **100% PASS** |
| Atomic Number Contiguity | 1 → 118 continuous | 1 → 118 continuous | **100% PASS** |
| Spatial / Block Validity | Periods 1–7, Groups 1–18, Blocks s/p/d/f | 100% valid | **100% PASS** |
| Thermodynamic Consistency | $T_{\text{melt}} \le T_{\text{boil}}$ | 102 / 102 pairs | **100% PASS** |
| Physical Bounds | Mass, Density, Temperatures $> 0$ | 0 violations | **100% PASS** |
| Source Coverage | 118 Wikipedia URLs | 118 unique HTTPS URLs | **100% PASS** |
| Data Completeness | 1,770 cells | 1,674 populated (94.6%) | **Unimputed** |

## Missing Values Breakdown

| Feature | Missing | Percentage | Primary Scientific Reason |
|---|---:|---:|---|
| `density` | 4 | 3.4% | Transuranic synthetic elements (Fm, Md, No, Lr) |
| `electron_affinity` | 9 | 7.6% | Noble gases and short-lived actinides |
| `melt` | 11 | 9.3% | Synthetic elements with microsecond half-lives |
| `boil` | 14 | 11.9% | Synthetic elements lacking macroscopic phase data |
| `electronegativity_pauling` | 18 | 15.3% | Inert noble gases and transactinides |
| `molar_heat` | 40 | 33.9% | Requires macroscopic bulk solid sample |

## Policy Decision

No missing values have been fabricated, interpolated, or imputed. All missing data points reflect legitimate physical or radiological constraints.