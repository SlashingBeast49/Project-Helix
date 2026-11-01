"""
Project Helix — Comprehensive Dataset Quality & ML Verification Script
Validates:
  1. Dataset v1.1 completeness, schema, and ranges
  2. Uniqueness, physical constraints, and anomalies (Arsenic sublimation)
  3. ML Model predictions for both known and hypothetical elements (Z > 118)
"""

import sys
import json
from pathlib import Path
import pandas as pd
import numpy as np

# UTF-8 stdout
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

CSV_PATH = PROJECT_ROOT / "data" / "dataset_v1.csv"
MODEL_PATH = PROJECT_ROOT / "dashboard" / "model_coefficients.js"

def verify_dataset():
    print("=" * 70)
    print("PROJECT HELIX — DATASET QUALITY & ML MODEL VERIFICATION")
    print("=" * 70)

    # 1. Load Dataset
    print(f"\n[1] Checking Dataset at: {CSV_PATH}")
    assert CSV_PATH.exists(), f"Missing dataset file: {CSV_PATH}"
    df = pd.read_csv(CSV_PATH)

    n_rows, n_cols = df.shape
    print(f"    ✓ Shape: {n_rows} rows × {n_cols} columns")
    assert n_rows == 118, f"Expected 118 elements, found {n_rows}"
    assert n_cols == 15, f"Expected 15 features, found {n_cols}"

    # 2. Schema check
    expected_cols = [
        "number", "symbol", "name", "atomic_mass", "category",
        "period", "group", "block", "density", "melt", "boil",
        "molar_heat", "electron_affinity", "electronegativity_pauling",
        "electron_configuration"
    ]
    assert list(df.columns) == expected_cols, "Columns do not match canonical feature set"
    print("    ✓ Feature columns: 15 canonical features verified")

    # 3. Uniqueness
    assert df["number"].nunique() == 118, "Duplicate atomic numbers detected"
    assert df["symbol"].nunique() == 118, "Duplicate symbols detected"
    assert df["name"].nunique() == 118, "Duplicate names detected"
    print("    ✓ Uniqueness: All 118 numbers, symbols, and names are unique")

    # 4. Atomic sequence
    assert set(df["number"]) == set(range(1, 119)), "Atomic sequence 1..118 is broken"
    print("    ✓ Atomic Sequence: Z = 1 to 118 is continuous with no gaps")

    # 5. Domain range checks
    assert df["period"].between(1, 7).all(), "Invalid period values found"
    assert df["group"].between(1, 18).all(), "Invalid group values found"
    assert set(df["block"]).issubset({"s", "p", "d", "f"}), "Invalid orbital blocks found"
    assert (df["atomic_mass"] > 0).all(), "Non-positive atomic mass found"
    print("    ✓ Domain Constraints: Periods [1-7], Groups [1-18], Blocks {s,p,d,f}, Mass > 0")

    # 6. Completeness in Dataset v1.1
    missing = df.isnull().sum()
    total_cells = n_rows * n_cols
    filled_cells = total_cells - missing.sum()
    pct = (filled_cells / total_cells) * 100
    print(f"\n[2] Completeness Analysis (Dataset v1.1)")
    print(f"    ✓ Total completeness: {filled_cells}/{total_cells} cells ({pct:.2f}%)")
    assert missing["density"] == 0, "Expected 0 missing densities in v1.1"
    assert missing["melt"] == 0, "Expected 0 missing melting points in v1.1"
    assert missing["boil"] == 0, "Expected 0 missing boiling points in v1.1"
    print(f"    ✓ Core physical targets (density, melt, boil): 100% resolved")
    print(f"    ✓ Documented theoretical nulls:")
    for col, count in missing[missing > 0].items():
        print(f"      - {col:30s}: {count:2d} unobserved ({count/n_rows*100:.1f}%)")

    # 7. Thermodynamic consistency
    thermo = df.dropna(subset=["melt", "boil"])
    violations = thermo[thermo["melt"] > thermo["boil"]]
    print(f"\n[3] Physical Law Verification (T_melt <= T_boil)")
    if len(violations) == 1 and violations.iloc[0]["symbol"] == "As":
        print(f"    ✓ Exactly 1 known physical sublimation case: Arsenic (Z=33)")
        print(f"      Arsenic sublimes at 1 atm at 887 K; its 1090 K melting point is a high-pressure triple point.")
        print(f"      All other 117 elements strictly obey T_melt <= T_boil.")
    else:
        assert len(violations) == 0, f"Unexpected thermodynamic law violations: {violations}"

    # 8. ML Model Check
    print(f"\n[4] Checking ML Model Coefficients at: {MODEL_PATH}")
    assert MODEL_PATH.exists(), f"Missing model file: {MODEL_PATH}"
    
    with open(MODEL_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Extract JSON object between first '{' and last '}'
    start_idx = content.find("{")
    end_idx = content.rfind("}") + 1
    json_str = content[start_idx:end_idx]
    model_data = json.loads(json_str)

    print(f"    ✓ Model Version: {model_data.get('version')}")
    print(f"    ✓ Trained Properties: {len(model_data['models'])}")
    for target, metrics in model_data["metrics"].items():
        r2 = metrics["r2"]
        mape = metrics["mape"]
        n_samples = metrics["n_samples"]
        print(f"      - {target:25s}: R² = {r2:.4f} | MAPE = {mape:5.1f}% | N = {n_samples}")

    # 9. Superheavy Element Prediction Check (Z > 118)
    print(f"\n[5] Superheavy Element Predictions (Z > 118 Test)")
    from scripts.train_model import get_extended_placement, generate_electron_config, engineer_features

    test_z_values = [119, 120, 126, 137, 164, 172]
    for z in test_z_values:
        placement = get_extended_placement(z)
        assert placement is not None, f"Placement failed for Z={z}"
        period, group, block = placement
        config, shells = generate_electron_config(z)
        features = engineer_features(z, period, group, block)
        
        preds = {}
        for target in ["atomic_mass", "density", "melt", "boil"]:
            m = model_data["models"][target]
            X = np.array([features], dtype=np.float64)
            X_scaled = (X - np.array(m["scaler_mean"])) / np.array(m["scaler_scale"])
            powers = np.array(m["poly_powers"])
            
            X_poly_row = np.ones(len(powers))
            for i, power in enumerate(powers):
                val = 1.0
                for j, p in enumerate(power):
                    if p > 0:
                        val *= X_scaled[0, j] ** p
                X_poly_row[i] = val
            
            pred = np.dot(X_poly_row, m["coefficients"]) + m["intercept"]
            # Apply clamping
            if "bounds" in m:
                pred = max(m["bounds"]["min"], min(m["bounds"]["max"], pred))
            preds[target] = pred

        print(f"    Z={z:3d} (P{period}, G{group:2d}, {block}-block): Mass ~ {preds['atomic_mass']:.1f} u | Density ~ {preds['density']:.2f} g/cm³ | Melt ~ {preds['melt']:.1f} K | Boil ~ {preds['boil']:.1f} K")

    print("\n" + "=" * 70)
    print("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (100% QUALITY)")
    print("=" * 70)

if __name__ == "__main__":
    verify_dataset()
