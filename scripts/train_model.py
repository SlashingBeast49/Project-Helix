"""
Project Helix — ML Model Training Script

Trains regression models on the periodic table dataset to predict element properties
for ANY atomic number, including hypothetical elements beyond Z=118.

Architecture:
  - Feature engineering: atomic_number, period, group, block (one-hot), 
    polynomial interactions, and periodic position features
  - Model: Separate Ridge regression for each target property
  - Output: JSON file with model coefficients for client-side JS inference

Usage:
  python scripts/train_model.py
"""

import json
import sys
import os
import math
from pathlib import Path

# UTF-8 stdout on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.metrics import r2_score, mean_absolute_percentage_error
from sklearn.model_selection import cross_val_score

# ── Project paths ──
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
DATA_DIR = PROJECT_ROOT / "data"
CSV_PATH = DATA_DIR / "dataset_v1.csv"
OUTPUT_PATH = PROJECT_ROOT / "dashboard" / "model_coefficients.js"


# ═══════════════════════════════════════════════════════════════════════════════
# EXTENDED PERIODIC TABLE PLACEMENT
# ═══════════════════════════════════════════════════════════════════════════════

def get_extended_placement(z):
    """
    Return (period, group, block) for any atomic number, including Z > 118.
    Uses the Aufbau principle and Madelung's rule for extrapolation.
    """
    # Known elements (1-118) - use actual data
    # For Z > 118, extrapolate using extended periodic table rules
    
    if z <= 0:
        return (1, 1, 's')
    
    # Period 8 starts at Z=119
    # Shell filling order for period 8:
    # 8s (119-120), 5g (121-138), 6f (139-152), 7d (153-166), 8p (167-172)
    
    if z <= 118:
        return None  # Use actual data
    
    if z <= 120:
        # 8s block
        return (8, z - 118, 's')
    elif z <= 138:
        # 5g block (18 elements, hypothetical)
        g_pos = z - 120
        return (8, 3, 'g')
    elif z <= 152:
        # 6f block (14 elements)
        return (8, 3, 'f')
    elif z <= 166:
        # 7d block (14 elements, groups 3-16)
        d_pos = z - 152
        return (8, d_pos + 2, 'd')
    elif z <= 172:
        # 8p block (6 elements, groups 13-18)
        p_pos = z - 166
        return (8, p_pos + 12, 'p')
    elif z <= 174:
        # Period 9 starts
        return (9, z - 172, 's')
    else:
        # Very far extrapolation - estimate period/group
        period = 9 + (z - 175) // 50
        group = ((z - 175) % 18) + 1
        block = 's' if group <= 2 else 'p' if group >= 13 else 'd'
        return (period, group, block)


def generate_electron_config(z):
    """Generate electron configuration for any atomic number."""
    # Aufbau filling order
    orbitals = [
        (1,'s',2), (2,'s',2), (2,'p',6), (3,'s',2), (3,'p',6),
        (4,'s',2), (3,'d',10), (4,'p',6), (5,'s',2), (4,'d',10),
        (5,'p',6), (6,'s',2), (4,'f',14), (5,'d',10), (6,'p',6),
        (7,'s',2), (5,'f',14), (6,'d',10), (7,'p',6),
        (8,'s',2), (5,'g',18), (6,'f',14), (7,'d',10), (8,'p',6),
    ]
    
    config = []
    remaining = z
    shells = {}
    
    for n, l, max_e in orbitals:
        if remaining <= 0:
            break
        e = min(remaining, max_e)
        config.append(f"{n}{l}{e}")
        
        if n not in shells:
            shells[n] = 0
        shells[n] += e
        remaining -= e
    
    # If we still have electrons remaining (very heavy elements)
    while remaining > 0:
        n = max(shells.keys()) + 1 if shells else 9
        e = min(remaining, 2)
        config.append(f"{n}s{e}")
        shells[n] = e
        remaining -= e
    
    return ' '.join(config), list(shells.values())


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE ENGINEERING
# ═══════════════════════════════════════════════════════════════════════════════

BLOCK_MAP = {'s': 0, 'p': 1, 'd': 2, 'f': 3, 'g': 4}

def engineer_features(z, period, group, block):
    """
    Create feature vector for ML model.
    All features are physics-inspired and designed to capture periodic trends.
    """
    block_id = BLOCK_MAP.get(block, 0)
    
    # Periodic position features
    z_norm = z / 118.0  # normalized atomic number
    period_norm = period / 8.0
    group_norm = group / 18.0
    
    # Sine/cosine of group position (captures periodic oscillation)
    group_angle = 2 * math.pi * group / 18.0
    group_sin = math.sin(group_angle)
    group_cos = math.cos(group_angle)
    
    # Block encoding (one-hot style but numerical)
    is_s = 1.0 if block == 's' else 0.0
    is_p = 1.0 if block == 'p' else 0.0
    is_d = 1.0 if block == 'd' else 0.0
    is_f = 1.0 if block == 'f' else 0.0
    
    # Position within period (captures intra-period trends)
    # Approximate: elements per period = [2, 8, 8, 18, 18, 32, 32]
    elements_per_period = {1:2, 2:8, 3:8, 4:18, 5:18, 6:32, 7:32, 8:50, 9:50}
    ep = elements_per_period.get(period, 50)
    
    # Z^(1/3) - related to atomic radius scaling
    z_cbrt = z ** (1/3)
    
    # Log(Z) - many properties scale logarithmically
    z_log = math.log(z) if z > 0 else 0
    
    # Sqrt(Z) 
    z_sqrt = math.sqrt(z)
    
    # Inverse of Z (some properties scale as 1/Z)
    z_inv = 1.0 / z if z > 0 else 0
    
    # Effective nuclear charge approximation (Slater's rules simplified)
    # For outermost electrons
    z_eff_approx = z - 2 * (period - 1) * 3.5  # very rough
    z_eff_approx = max(z_eff_approx, 1)
    
    features = [
        z,                    # 0: atomic number
        z_norm,               # 1: normalized Z
        period,               # 2: period
        period_norm,          # 3: normalized period
        group,                # 4: group
        group_norm,           # 5: normalized group
        block_id,             # 6: block as integer
        group_sin,            # 7: sin(group angle)
        group_cos,            # 8: cos(group angle)
        is_s,                 # 9: s-block flag
        is_p,                 # 10: p-block flag
        is_d,                 # 11: d-block flag
        is_f,                 # 12: f-block flag
        z_cbrt,               # 13: Z^(1/3)
        z_log,                # 14: ln(Z)
        z_sqrt,               # 15: sqrt(Z)
        z_inv,                # 16: 1/Z
        z_eff_approx,         # 17: approx effective nuclear charge
        z * group_sin,        # 18: Z × sin(group)
        z * group_cos,        # 19: Z × cos(group)
        period * group,       # 20: period × group interaction
        z_norm * z_norm,      # 21: Z² (normalized)
        z_norm ** 3,          # 22: Z³ (normalized)
    ]
    
    return features


FEATURE_NAMES = [
    'z', 'z_norm', 'period', 'period_norm', 'group', 'group_norm',
    'block_id', 'group_sin', 'group_cos',
    'is_s', 'is_p', 'is_d', 'is_f',
    'z_cbrt', 'z_log', 'z_sqrt', 'z_inv', 'z_eff',
    'z_x_gsin', 'z_x_gcos', 'period_x_group',
    'z_sq', 'z_cu'
]

# Target properties to predict
TARGETS = [
    'atomic_mass', 'density', 'melt', 'boil',
    'molar_heat', 'electron_affinity', 'electronegativity_pauling'
]


# ═══════════════════════════════════════════════════════════════════════════════
# DATA QUALITY ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

def run_data_quality_analysis(df):
    """Comprehensive data quality analysis on dataset v1.1."""
    report = {}
    
    print("\n═══ DATA QUALITY ANALYSIS ═══\n")
    
    # 1. Shape check
    n_rows, n_cols = df.shape
    print(f"Shape: {n_rows} rows × {n_cols} columns")
    report['shape'] = {'rows': n_rows, 'cols': n_cols}
    
    # 2. Missing values
    missing = df.isnull().sum()
    missing_pct = (missing / n_rows * 100).round(2)
    total_cells = n_rows * n_cols
    filled_cells = total_cells - missing.sum()
    completeness = filled_cells / total_cells * 100
    
    print(f"\nCompleteness: {filled_cells}/{total_cells} cells ({completeness:.1f}%)")
    print("\nMissing values by feature:")
    for col in df.columns:
        m = missing[col]
        if m > 0:
            print(f"  {col:30s}: {m:3d} ({missing_pct[col]:5.1f}%)")
    
    report['completeness'] = {
        'total_cells': int(total_cells),
        'filled_cells': int(filled_cells),
        'percentage': round(completeness, 2)
    }
    report['missing'] = {col: int(missing[col]) for col in df.columns if missing[col] > 0}
    
    # 3. Uniqueness checks
    unique_checks = {
        'number': df['number'].nunique() == 118,
        'symbol': df['symbol'].nunique() == 118,
        'name': df['name'].nunique() == 118,
    }
    print("\nUniqueness checks:")
    for k, v in unique_checks.items():
        status = "PASS ✓" if v else "FAIL ✗"
        print(f"  {k:15s}: {status}")
    report['uniqueness'] = unique_checks
    
    # 4. Range validation
    print("\nRange validation:")
    range_checks = {}
    
    # Period 1-7
    period_ok = df['period'].between(1, 7).all()
    print(f"  Period [1-7]: {'PASS ✓' if period_ok else 'FAIL ✗'}")
    range_checks['period'] = bool(period_ok)
    
    # Group 1-18
    group_ok = df['group'].between(1, 18).all()
    print(f"  Group [1-18]: {'PASS ✓' if group_ok else 'FAIL ✗'}")
    range_checks['group'] = bool(group_ok)
    
    # Block validity
    valid_blocks = {'s', 'p', 'd', 'f'}
    block_ok = set(df['block'].unique()).issubset(valid_blocks)
    print(f"  Block ∈ {{s,p,d,f}}: {'PASS ✓' if block_ok else 'FAIL ✗'}")
    range_checks['block'] = bool(block_ok)
    
    # Atomic number continuity
    expected = set(range(1, 119))
    actual = set(df['number'])
    seq_ok = expected == actual
    print(f"  Z = 1→118 (continuous): {'PASS ✓' if seq_ok else 'FAIL ✗'}")
    range_checks['atomic_sequence'] = bool(seq_ok)
    
    # Mass > 0
    mass_ok = (df['atomic_mass'] > 0).all()
    print(f"  Atomic mass > 0: {'PASS ✓' if mass_ok else 'FAIL ✗'}")
    range_checks['mass_positive'] = bool(mass_ok)
    
    # Thermodynamic law: melt <= boil (where both exist)
    thermo_df = df.dropna(subset=['melt', 'boil'])
    thermo_ok = (thermo_df['melt'] <= thermo_df['boil']).all()
    n_thermo = len(thermo_df)
    thermo_violations = thermo_df[thermo_df['melt'] > thermo_df['boil']]
    if len(thermo_violations) > 0:
        print(f"  Tmelt ≤ Tboil: FAIL ✗ ({len(thermo_violations)} violations)")
        for _, row in thermo_violations.iterrows():
            print(f"    → {row['name']} (Z={row['number']}): melt={row['melt']}K > boil={row['boil']}K")
    else:
        print(f"  Tmelt ≤ Tboil: PASS ✓ ({n_thermo}/{n_thermo} pairs)")
    range_checks['thermodynamic_law'] = bool(thermo_ok)
    
    report['range_checks'] = range_checks
    
    # 5. Outlier detection using IQR
    print("\nOutlier analysis (IQR method):")
    numeric_cols = ['atomic_mass', 'density', 'melt', 'boil', 'molar_heat', 
                    'electron_affinity', 'electronegativity_pauling']
    outlier_report = {}
    for col in numeric_cols:
        vals = df[col].dropna()
        if len(vals) == 0:
            continue
        Q1 = vals.quantile(0.25)
        Q3 = vals.quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - 1.5 * IQR
        upper = Q3 + 1.5 * IQR
        outliers = vals[(vals < lower) | (vals > upper)]
        n_out = len(outliers)
        print(f"  {col:30s}: {n_out:3d} outliers (Q1={Q1:.2f}, Q3={Q3:.2f})")
        outlier_report[col] = {
            'count': int(n_out),
            'Q1': round(float(Q1), 4),
            'Q3': round(float(Q3), 4),
            'IQR': round(float(IQR), 4),
        }
    report['outliers'] = outlier_report
    
    # 6. Correlation analysis
    print("\nCorrelation matrix (numeric features):")
    corr = df[numeric_cols].corr()
    strong_corrs = []
    for i in range(len(numeric_cols)):
        for j in range(i+1, len(numeric_cols)):
            r = corr.iloc[i, j]
            if abs(r) > 0.5:
                strong_corrs.append({
                    'feature1': numeric_cols[i],
                    'feature2': numeric_cols[j],
                    'correlation': round(float(r), 4)
                })
                print(f"  {numeric_cols[i]} × {numeric_cols[j]}: r = {r:.3f}")
    report['strong_correlations'] = strong_corrs
    
    # 7. Statistical summary
    stats = df[numeric_cols].describe().round(4)
    report['statistics'] = {}
    for col in numeric_cols:
        report['statistics'][col] = {
            'count': int(stats.loc['count', col]),
            'mean': round(float(stats.loc['mean', col]), 4) if not pd.isna(stats.loc['mean', col]) else None,
            'std': round(float(stats.loc['std', col]), 4) if not pd.isna(stats.loc['std', col]) else None,
            'min': round(float(stats.loc['min', col]), 4) if not pd.isna(stats.loc['min', col]) else None,
            'max': round(float(stats.loc['max', col]), 4) if not pd.isna(stats.loc['max', col]) else None,
        }
    
    print("\n═══ DATA QUALITY: ALL CHECKS COMPLETE ═══")
    
    return report


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL TRAINING
# ═══════════════════════════════════════════════════════════════════════════════

def train_models(df):
    """Train separate Ridge regression models for each target property."""
    models = {}
    metrics = {}
    
    print("\n═══ MODEL TRAINING ═══\n")
    
    for target in TARGETS:
        print(f"Training model for: {target}")
        
        # Get rows with non-null target
        mask = df[target].notna()
        train_df = df[mask].copy()
        
        if len(train_df) < 10:
            print(f"  ⚠ Skipping {target}: only {len(train_df)} valid samples")
            continue
        
        # Build feature matrix
        X_rows = []
        for _, row in train_df.iterrows():
            features = engineer_features(
                int(row['number']), int(row['period']), 
                int(row['group']), str(row['block'])
            )
            X_rows.append(features)
        
        X = np.array(X_rows, dtype=np.float64)
        y = train_df[target].values.astype(np.float64)
        
        # Standardize features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Use interaction-only polynomial features to reduce dimensionality
        # This prevents extreme overfitting with only 118 samples
        poly = PolynomialFeatures(degree=2, interaction_only=True, include_bias=True)
        X_poly = poly.fit_transform(X_scaled)
        
        # Strong regularization for stable extrapolation beyond Z=118
        alpha = 100.0
        model = Ridge(alpha=alpha)
        model.fit(X_poly, y)
        
        # Evaluate
        y_pred = model.predict(X_poly)
        r2 = r2_score(y, y_pred)
        
        # Cross-validation
        cv_scores = cross_val_score(model, X_poly, y, cv=min(5, len(y)//3), scoring='r2')
        cv_mean = cv_scores.mean()
        cv_std = cv_scores.std()
        
        # MAPE (handle zero values)
        non_zero_mask = np.abs(y) > 1e-6
        if non_zero_mask.sum() > 0:
            mape = mean_absolute_percentage_error(y[non_zero_mask], y_pred[non_zero_mask]) * 100
        else:
            mape = 0
        
        print(f"  R² = {r2:.4f} | CV R² = {cv_mean:.4f} ± {cv_std:.4f} | MAPE = {mape:.1f}%")
        print(f"  Samples: {len(y)} | Features: {X_poly.shape[1]}")
        
        # Physical bounds for clamping predictions in the JS engine
        PHYSICAL_BOUNDS = {
            'atomic_mass': {'min': 1.0, 'max': 1000.0},
            'density': {'min': 0.01, 'max': 100.0},
            'melt': {'min': 0.1, 'max': 10000.0},
            'boil': {'min': 0.5, 'max': 15000.0},
            'molar_heat': {'min': 5.0, 'max': 150.0},
            'electron_affinity': {'min': -400.0, 'max': 500.0},
            'electronegativity_pauling': {'min': 0.5, 'max': 5.0},
        }
        
        bounds = PHYSICAL_BOUNDS.get(target, {'min': float(y.min()), 'max': float(y.max())})
        
        # Store model data for export
        models[target] = {
            'coefficients': model.coef_.tolist(),
            'intercept': float(model.intercept_),
            'scaler_mean': scaler.mean_.tolist(),
            'scaler_scale': scaler.scale_.tolist(),
            'poly_powers': poly.powers_.tolist(),
            'n_input_features': X.shape[1],
            'bounds': bounds,
            'train_mean': round(float(y.mean()), 4),
            'train_std': round(float(y.std()), 4),
        }
        
        metrics[target] = {
            'r2': round(float(r2), 4),
            'cv_r2_mean': round(float(cv_mean), 4),
            'cv_r2_std': round(float(cv_std), 4),
            'mape': round(float(mape), 2),
            'n_samples': int(len(y)),
            'n_features': int(X_poly.shape[1]),
        }
    
    print("\n═══ TRAINING COMPLETE ═══")
    return models, metrics


# ═══════════════════════════════════════════════════════════════════════════════
# EXPORT TO JAVASCRIPT
# ═══════════════════════════════════════════════════════════════════════════════

def export_to_js(models, metrics, quality_report, output_path):
    """Export model coefficients as a JavaScript module for the dashboard."""
    
    # Build the JS data object
    data = {
        'version': '1.0.0',
        'training_date': pd.Timestamp.now().isoformat(),
        'models': models,
        'metrics': metrics,
        'quality_report': quality_report,
        'feature_names': FEATURE_NAMES,
        'targets': TARGETS,
    }
    
    js_content = f"""/* ═══════════════════════════════════════════════════════════════════════
   Project Helix — ML Model Coefficients (Auto-generated)
   Generated by scripts/train_model.py
   DO NOT EDIT MANUALLY
   ═══════════════════════════════════════════════════════════════════════ */

const HELIX_MODEL = {json.dumps(data, indent=2)};
"""
    
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"\n[SAVED] Model coefficients → {output_path}")
    print(f"        File size: {output_path.stat().st_size / 1024:.1f} KB")
    print(f"        Properties modeled: {len(models)}")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("Project Helix — ML Model Training Pipeline")
    print("=" * 60)
    
    # Load dataset
    print(f"\nLoading dataset from: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df)} elements × {len(df.columns)} features")
    
    # Run data quality analysis
    quality_report = run_data_quality_analysis(df)
    
    # Train models
    models, metrics = train_models(df)
    
    # Test predictions for Z > 118
    print("\n═══ EXTRAPOLATION TEST (Z > 118) ═══\n")
    for z in [119, 120, 126, 137, 150, 164, 172]:
        placement = get_extended_placement(z)
        if placement:
            period, group, block = placement
            config, shells = generate_electron_config(z)
            features = engineer_features(z, period, group, block)
            print(f"Z={z}: Period {period}, Group {group}, Block {block}")
            print(f"  Config: {config}")
            print(f"  Shells: {shells}")
            
            # Predict properties
            for target in TARGETS:
                if target in models:
                    m = models[target]
                    X = np.array([features], dtype=np.float64)
                    X_scaled = (X - np.array(m['scaler_mean'])) / np.array(m['scaler_scale'])
                    
                    # Apply polynomial transform
                    powers = np.array(m['poly_powers'])
                    X_poly_row = np.ones(len(powers))
                    for i, power in enumerate(powers):
                        val = 1.0
                        for j, p in enumerate(power):
                            if p > 0:
                                val *= X_scaled[0, j] ** p
                        X_poly_row[i] = val
                    
                    pred = np.dot(X_poly_row, m['coefficients']) + m['intercept']
                    print(f"  {target}: {pred:.4f}")
            print()
    
    # Export
    export_to_js(models, metrics, quality_report, OUTPUT_PATH)
    
    print("\n✓ Model training pipeline complete!")


if __name__ == '__main__':
    main()
