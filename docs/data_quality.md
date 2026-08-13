# Project Helix — Data Quality Report

## Dataset

- Elements: 118
- Features: 15
- Current status: Initial / Raw

## Source

The initial dataset was derived from a JSON periodic-table dataset.
The dataset's `source` field points to individual Wikipedia pages
for chemical elements.

## Missing Values

| Feature | Missing | Percentage |
|---|---:|---:|
| density | 4 | 3.4% |
| melt | 11 | 9.3% |
| boil | 14 | 11.9% |
| molar_heat | 40 | 33.9% |
| electron_affinity | 9 | 7.6% |
| electronegativity_pauling | 18 | 15.3% |

## Current Decisions

No missing values have been imputed or replaced.

Further investigation is required before cleaning.

## Known Concerns

- Some properties have substantial missingness.
- Source provenance needs to be evaluated for individual properties.
- Heavy/synthetic elements require particular attention.