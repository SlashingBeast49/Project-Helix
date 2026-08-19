# Project Helix 🧪

**Project Helix** is a personal data-science and software project focused on building, validating, documenting, and eventually analyzing structured data about the chemical elements.

The project is being developed publicly with an emphasis on **understanding the data and code**, rather than simply producing an end result.

---

## 🚧 Current Status

**Dataset v1 — Complete**

The current dataset contains:

* **118 chemical elements**
* **15 features**
* JSON → pandas DataFrame → CSV pipeline
* Automated structural and data-quality validation
* Missing-value analysis
* Source/provenance coverage validation
* Documentation of known data-quality concerns

Dataset v1 is currently classified as:

> **Initial / Raw**

No missing values have been imputed or artificially replaced.

---

## 🎯 Project Goals

Helix aims to progress through several stages:

1. Build a reliable structured dataset of the chemical elements.
2. Understand and document every feature in the dataset.
3. Audit the provenance and quality of the data.
4. Perform exploratory data analysis.
5. Identify meaningful relationships and patterns.
6. Build software tools around the dataset.
7. Eventually explore appropriate data-science or machine-learning applications.

The project will prioritize **data quality and understanding before modeling**.

---

## 📊 Dataset v1

Dataset v1 contains **118 elements and 15 features**.

### Features

| Feature                     | Description                                            |
| --------------------------- | ------------------------------------------------------ |
| `number`                    | Atomic number                                          |
| `symbol`                    | Chemical symbol                                        |
| `name`                      | Element name                                           |
| `atomic_mass`               | Atomic mass value provided by the source dataset       |
| `category`                  | Element classification/category                        |
| `period`                    | Periodic-table period                                  |
| `group`                     | Periodic-table group                                   |
| `block`                     | Periodic-table block                                   |
| `density`                   | Density value provided by the source dataset           |
| `melt`                      | Melting-point value provided by the source dataset     |
| `boil`                      | Boiling-point value provided by the source dataset     |
| `molar_heat`                | Molar heat value provided by the source dataset        |
| `electron_affinity`         | Electron-affinity value provided by the source dataset |
| `electronegativity_pauling` | Pauling electronegativity value                        |
| `electron_configuration`    | Electron configuration                                 |

> **Note:** Feature definitions, units, and provenance are still being formally audited. Values should not be assumed to have been independently verified yet.

---

## 🔬 Data Pipeline

The current pipeline is:

```text
PeriodicTableJSON.json
        │
        ▼
     Python
        │
        ▼
   Filter elements
   (atomic number ≤ 118)
        │
        ▼
   pandas DataFrame
        │
        ▼
 Select 15 features
        │
        ▼
 Data-quality checks
        │
        ▼
     Dataset v1
        │
        ▼
        CSV
```

---

## ✅ Data Quality Checks

The current validation pipeline checks:

### Dataset size

* Exactly 118 elements are present.

### Uniqueness

The following fields must contain 118 unique values:

* `number`
* `symbol`
* `name`

### Atomic numbers

The dataset must contain every atomic number from:

```text
1 → 118
```

### Period

Values must fall within:

```text
1 → 7
```

### Group

Values must fall within:

```text
1 → 18
```

### Block

Allowed values are:

```text
s
p
d
f
```

### Atomic mass

All available atomic-mass values must be greater than zero.

### Required identifiers

`symbol` and `name` must not be missing.

---

## 📉 Missing Values

Dataset v1 currently contains missing values in six features:

| Feature                     | Missing | Percentage |
| --------------------------- | ------: | ---------: |
| `density`                   |       4 |       3.4% |
| `melt`                      |      11 |       9.3% |
| `boil`                      |      14 |      11.9% |
| `molar_heat`                |      40 |      33.9% |
| `electron_affinity`         |       9 |       7.6% |
| `electronegativity_pauling` |      18 |      15.3% |

### Current policy

Missing values are **not** currently imputed, replaced, or fabricated.

This is intentional.

Before any cleaning or imputation is performed, the project will investigate:

* Why the value is missing.
* Whether the property is meaningful for the element.
* Whether a reliable value exists elsewhere.
* Whether different sources use different conventions.
* Whether the missingness is associated with particular types of elements.

---

## 🔗 Source & Provenance

The initial dataset is derived from a periodic-table JSON dataset.

Each element record contains a `source` field.

Current validation has established that:

* 118 source entries exist for the 118 elements.
* All 118 source entries are unique.
* Each source points to the corresponding element's Wikipedia page.

For example, the Hydrogen record points to its Wikipedia page.

### Important distinction

The presence of an element-level source URL does **not yet establish that every individual property was independently verified against that source**.

Property-level provenance is therefore an ongoing part of the project.

---

## 🧪 Current Data Concerns

Known concerns include:

* Some properties have substantial missingness.
* Property-level provenance has not yet been fully audited.
* Units and definitions need to be documented systematically.
* Heavy and synthetic elements require particular attention.
* The original source dataset should not automatically be treated as authoritative for every individual property.

These concerns are documented rather than hidden.

---

## 🗺️ Roadmap

### Phase 1 — Dataset v1

* [x] Obtain initial element dataset
* [x] Parse JSON
* [x] Build pandas DataFrame
* [x] Select 15 features
* [x] Validate 118 elements
* [x] Validate identifiers
* [x] Validate periodic-table structure
* [x] Analyze missing values
* [x] Document data-quality concerns
* [x] Validate source coverage

### Phase 2 — Data Verification

* [ ] Build complete data dictionary
* [ ] Define every feature precisely
* [ ] Document units
* [ ] Audit property-level provenance
* [ ] Investigate missing values
* [ ] Identify potential inconsistencies
* [ ] Determine whether Dataset v1 requires a verified v1.1 release

### Phase 3 — Exploratory Data Analysis

* [ ] Statistical summaries
* [ ] Distribution analysis
* [ ] Correlation analysis where appropriate
* [ ] Visualizations
* [ ] Investigate relationships between chemical properties

### Phase 4 — Helix Software

* [ ] Create reusable data-loading layer
* [ ] Build a Python API
* [ ] Expose validated element data
* [ ] Create documentation for using the API

### Phase 5 — Data Science

* [ ] Identify meaningful analytical questions
* [ ] Feature engineering
* [ ] Statistical modeling
* [ ] Explore suitable machine-learning applications
* [ ] Evaluate models rigorously

---

## 🛠️ Technology

Current technologies include:

* **Python**
* **pandas**
* **JSON**
* **CSV**
* Git / GitHub for version control and public development

Additional technologies will be introduced only when they serve a clear purpose in the project.

---

## 📁 Project Structure

The project currently follows a structure similar to:

```text
Project-Helix/
│
├── src/
│   └── PeriodicTableJSON.json
│
├── data/
│   └── dataset_v1.csv
│
├── docs/
│   └── data-quality-report.md
│
├── ...
│
└── README.md
```

The exact structure may evolve as the project grows.

---

## 📌 Philosophy

Helix follows a simple principle:

> **Understand the data before trying to model it.**

The project intentionally avoids jumping directly into machine learning.

A model built on poorly understood or poorly documented data can produce impressive-looking results that are fundamentally unreliable.

Therefore, Helix prioritizes:

**Data → Validation → Documentation → Understanding → Analysis → Modeling**

---

## 📜 Dataset Status

**Version:** Dataset v1
**Elements:** 118
**Features:** 15
**Status:** Initial / Raw
**Missing values:** Documented, not imputed
**Source coverage:** Validated
**Property-level provenance:** Under investigation

---

## 👤 Project

Project Helix is being developed as a personal data-science/software project with a focus on learning, experimentation, reproducibility, and public development.
