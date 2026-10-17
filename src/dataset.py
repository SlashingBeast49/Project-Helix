"""
Project Helix — Chemical Elements Dataset Pipeline & Loader.

This module implements the core data pipeline for Project Helix:
PeriodicTableJSON.json -> Filter (atomic number <= 118) -> pandas DataFrame ->
Select 15 features -> Validate -> Dataset v1 -> CSV (data/dataset_v1.csv).

Philosophy:
Understand the data before trying to model it.
Data -> Validation -> Documentation -> Understanding -> Analysis -> Modeling
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import pandas as pd

# Fix Windows console encoding if needed
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ==============================================================================
# CONSTANTS & CONFIGURATION
# ==============================================================================

# Project directory paths
PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_JSON_PATH = PACKAGE_DIR / "PeriodicTableJSON.json"
FALLBACK_JSON_PATH = DATA_DIR / "raw" / "PeriodicTableJSON.json"
DEFAULT_CSV_PATH = DATA_DIR / "dataset_v1.csv"
LEGACY_CSV_PATH = DATA_DIR / "processed" / "elements.csv"

# Canonical 15 features for Dataset v1 (as specified in README.md)
FEATURES: List[str] = [
    "number",
    "symbol",
    "name",
    "atomic_mass",
    "category",
    "period",
    "group",
    "block",
    "density",
    "melt",
    "boil",
    "molar_heat",
    "electron_affinity",
    "electronegativity_pauling",
    "electron_configuration",
]

# Validation rules
TOTAL_ELEMENTS: int = 118
VALID_BLOCKS: set[str] = {"s", "p", "d", "f"}
PERIOD_MIN, PERIOD_MAX = 1, 7
GROUP_MIN, GROUP_MAX = 1, 18


# ==============================================================================
# PIPELINE FUNCTIONS
# ==============================================================================

def get_raw_json_path(custom_path: Optional[Union[str, Path]] = None) -> Path:
    """Resolve the path to the raw PeriodicTableJSON.json file."""
    if custom_path:
        p = Path(custom_path)
        if p.exists():
            return p
        raise FileNotFoundError(f"Raw JSON file not found at: {custom_path}")

    if DEFAULT_JSON_PATH.exists():
        return DEFAULT_JSON_PATH
    if FALLBACK_JSON_PATH.exists():
        return FALLBACK_JSON_PATH

    raise FileNotFoundError(
        f"PeriodicTableJSON.json not found in {DEFAULT_JSON_PATH} or {FALLBACK_JSON_PATH}"
    )


def load_raw_json(json_path: Optional[Union[str, Path]] = None) -> List[Dict[str, Any]]:
    """Load raw element records from PeriodicTableJSON.json."""
    path = get_raw_json_path(json_path)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "elements" not in data:
        raise KeyError(f"Expected 'elements' key in JSON file: {path}")

    return data["elements"]


def build_dataset(
    json_path: Optional[Union[str, Path]] = None,
    validate: bool = True,
) -> pd.DataFrame:
    """
    Build Dataset v1 from raw JSON according to the Helix pipeline:
      1. Load PeriodicTableJSON.json
      2. Filter elements where atomic number <= 118
      3. Select the canonical 15 features
      4. Validate data quality (optional, default: True)
      5. Return pandas DataFrame
    """
    raw_elements = load_raw_json(json_path)

    # 1. Filter elements where atomic number <= 118
    filtered_elements = [
        e for e in raw_elements if isinstance(e.get("number"), (int, float)) and e["number"] <= TOTAL_ELEMENTS
    ]

    # 2. Build DataFrame
    df = pd.DataFrame(filtered_elements)

    # 3. Select 15 features in exact canonical order
    missing_cols = [col for col in FEATURES if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns in source data: {missing_cols}")

    df = df[FEATURES].copy()

    # Ensure atomic number, period, group are integers
    df["number"] = df["number"].astype(int)
    df["period"] = df["period"].astype(int)
    df["group"] = df["group"].astype(int)

    # Sort deterministically by atomic number
    df = df.sort_values("number").reset_index(drop=True)

    # 4. Validate
    if validate:
        validate_dataset(df)

    return df


def validate_dataset(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Perform all mandatory data quality checks specified in Helix README:
      - Dataset size == 118
      - Uniqueness of number, symbol, name
      - Atomic numbers 1 -> 118
      - Period in [1, 7]
      - Group in [1, 18]
      - Block in {'s', 'p', 'd', 'f'}
      - atomic_mass > 0
      - symbol and name are non-null
    """
    results: Dict[str, Any] = {}

    # Dataset size
    size_ok = len(df) == TOTAL_ELEMENTS
    if not size_ok:
        raise AssertionError(f"Expected exactly {TOTAL_ELEMENTS} elements, got {len(df)}")
    results["size"] = True

    # Feature columns
    cols_ok = list(df.columns) == FEATURES
    if not cols_ok:
        raise AssertionError(f"Columns do not match expected features list:\nExpected: {FEATURES}\nGot: {list(df.columns)}")
    results["features"] = True

    # Uniqueness
    assert df["number"].nunique() == TOTAL_ELEMENTS, "Atomic numbers are not unique"
    assert df["symbol"].nunique() == TOTAL_ELEMENTS, "Symbols are not unique"
    assert df["name"].nunique() == TOTAL_ELEMENTS, "Names are not unique"
    results["uniqueness"] = True

    # Atomic numbers 1 to 118
    expected_numbers = set(range(1, TOTAL_ELEMENTS + 1))
    actual_numbers = set(df["number"])
    assert actual_numbers == expected_numbers, "Atomic numbers do not match 1..118 sequence"
    results["atomic_numbers"] = True

    # Periodic table structure
    assert df["period"].between(PERIOD_MIN, PERIOD_MAX).all(), f"Periods outside {PERIOD_MIN}-{PERIOD_MAX}"
    assert df["group"].between(GROUP_MIN, GROUP_MAX).all(), f"Groups outside {GROUP_MIN}-{GROUP_MAX}"
    assert set(df["block"]).issubset(VALID_BLOCKS), f"Invalid block values: {set(df['block']) - VALID_BLOCKS}"
    results["periodic_structure"] = True

    # Atomic mass > 0
    assert (df["atomic_mass"] > 0).all(), "Atomic mass contains non-positive or null values"
    results["atomic_mass"] = True

    # Required identifiers
    assert df["symbol"].notna().all(), "Missing symbol values found"
    assert df["name"].notna().all(), "Missing name values found"
    results["required_identifiers"] = True

    return results


def export_dataset(
    df: Optional[pd.DataFrame] = None,
    output_path: Optional[Union[str, Path]] = None,
    sync_legacy_csv: bool = True,
) -> Path:
    """
    Export Dataset v1 to CSV.
    Default destination: data/dataset_v1.csv
    Optionally syncs data/processed/elements.csv for backwards compatibility.
    """
    if df is None:
        df = build_dataset(validate=True)

    dest = Path(output_path) if output_path else DEFAULT_CSV_PATH
    dest.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(dest, index=False, encoding="utf-8")

    if sync_legacy_csv and dest != LEGACY_CSV_PATH:
        try:
            LEGACY_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
            df.to_csv(LEGACY_CSV_PATH, index=False, encoding="utf-8")
        except Exception:
            pass

    return dest


def load_dataset(
    csv_path: Optional[Union[str, Path]] = None,
    auto_build: bool = True,
) -> pd.DataFrame:
    """
    Load Dataset v1 from CSV.
    If the CSV does not exist and auto_build is True, it builds and saves it.
    """
    target_path = Path(csv_path) if csv_path else DEFAULT_CSV_PATH

    if not target_path.exists():
        # Fallback to legacy path if present
        if LEGACY_CSV_PATH.exists() and not csv_path:
            target_path = LEGACY_CSV_PATH
        elif auto_build:
            df = build_dataset(validate=True)
            export_dataset(df, target_path)
            return df
        else:
            raise FileNotFoundError(f"Dataset CSV not found at: {target_path}")

    df = pd.read_csv(target_path, encoding="utf-8")
    return df


def get_missing_values_report(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generate the missing values summary matching the README table.
    Returns DataFrame with [missing_count, percentage].
    """
    missing_counts = df.isnull().sum()
    missing_features = missing_counts[missing_counts > 0]

    report = pd.DataFrame(
        {
            "missing": missing_features,
            "percentage": (missing_features / len(df) * 100).round(1),
        }
    )
    report.index.name = "feature"
    return report.sort_values(by="missing", ascending=True)


# ==============================================================================
# HELIX DATASET API CLASS
# ==============================================================================

class HelixDataset:
    """
    High-level Python interface for interacting with Project Helix element data.
    Provides easy access, lookups, filtering, and summary statistics.
    """

    def __init__(
        self,
        df: Optional[pd.DataFrame] = None,
        csv_path: Optional[Union[str, Path]] = None,
    ):
        if df is not None:
            self._df = df.copy()
        else:
            self._df = load_dataset(csv_path=csv_path)

    @property
    def df(self) -> pd.DataFrame:
        """Return the underlying pandas DataFrame."""
        return self._df

    @property
    def features(self) -> List[str]:
        """List of feature names."""
        return list(self._df.columns)

    def __len__(self) -> int:
        return len(self._df)

    def get(self, identifier: Union[int, str]) -> Optional[pd.Series]:
        """
        Lookup an element by:
          - Atomic number (int or numeric string, e.g. 1, 26, "26")
          - Chemical symbol (e.g. "H", "Fe", "au")
          - Element name (e.g. "Hydrogen", "Iron", "gold")
        Returns a pandas Series or None if not found.
        """
        if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
            num = int(identifier)
            match = self._df[self._df["number"] == num]
            if not match.empty:
                return match.iloc[0]
            return None

        if isinstance(identifier, str):
            # Match by symbol (case-insensitive)
            match_symbol = self._df[self._df["symbol"].str.lower() == identifier.lower()]
            if not match_symbol.empty:
                return match_symbol.iloc[0]

            # Match by name (case-insensitive)
            match_name = self._df[self._df["name"].str.lower() == identifier.lower()]
            if not match_name.empty:
                return match_name.iloc[0]

        return None

    def filter(
        self,
        category: Optional[str] = None,
        period: Optional[int] = None,
        group: Optional[int] = None,
        block: Optional[str] = None,
    ) -> pd.DataFrame:
        """Filter elements by category, period, group, or block."""
        subset = self._df
        if category is not None:
            subset = subset[subset["category"].str.lower() == category.lower()]
        if period is not None:
            subset = subset[subset["period"] == period]
        if group is not None:
            subset = subset[subset["group"] == group]
        if block is not None:
            subset = subset[subset["block"].str.lower() == block.lower()]
        return subset

    def missing_summary(self) -> pd.DataFrame:
        """Return table of missing values across all features."""
        return get_missing_values_report(self._df)

    def summary(self) -> Dict[str, Any]:
        """Return high-level metadata summary."""
        return {
            "elements": len(self._df),
            "features": len(self.features),
            "version": "Dataset v1",
            "status": "Initial / Raw",
            "missing_features_count": int((self._df.isnull().sum() > 0).sum()),
        }


# ==============================================================================
# CLI EXECUTION & VERIFICATION
# ==============================================================================

def main() -> None:
    """Build, validate, and export Dataset v1."""
    print("=" * 60)
    print("Project Helix — Dataset Pipeline (Dataset v1)")
    print("=" * 60)

    print("\n1. Loading raw JSON and building DataFrame...")
    df = build_dataset(validate=False)
    print(f"   Extracted {len(df)} elements across {len(df.columns)} features.")

    print("\n2. Running automated data-quality checks...")
    results = validate_dataset(df)
    for check in results:
        print(f"   [PASS] {check.replace('_', ' ').title()}")
    print("   [OK] All mandatory data-quality checks passed!")

    print("\n3. Missing values analysis:")
    missing_rep = get_missing_values_report(df)
    for feature, row in missing_rep.iterrows():
        print(f"   - {feature:26s}: {int(row['missing']):2d} missing ({row['percentage']:4.1f}%)")

    print("\n4. Exporting dataset:")
    saved_path = export_dataset(df)
    print(f"   [SAVED] {saved_path}")
    print(f"   [SYNC]  {LEGACY_CSV_PATH}")

    print("\n5. Testing HelixDataset API:")
    api = HelixDataset(df)
    h = api.get("H")
    fe = api.get(26)
    print(f"   Lookup 'H' : {h['name']} (Atomic #{h['number']}, Mass: {h['atomic_mass']})")
    print(f"   Lookup  26 : {fe['name']} ({fe['symbol']}, Block: {fe['block']}, Period: {fe['period']})")

    print("\n✓ Project Helix Dataset v1 successfully built and verified!")


if __name__ == "__main__":
    main()
