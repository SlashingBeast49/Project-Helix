# ==============================
# HELIX BASIC IMPORTS
# ==============================
import pandas as pd
import json
# ==============================
# HELIX DATA IMPORT
# ==============================
with open("src/PeriodicTableJSON.json", "r", encoding="utf-8") as f:
    data = json.load(f)
elements = [e for e in data["elements"] if e["number"] <= 118]
df = pd.DataFrame(elements)


columns = [
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
    "electron_configuration"
]

df = df[columns]

print(df.shape)

# ==============================
# HELIX DATA QUALITY CHECKS
# ==============================

assert len(df) == 118

assert df["number"].nunique() == 118
assert df["symbol"].nunique() == 118
assert df["name"].nunique() == 118

expected_numbers = set(range(1, 119))
actual_numbers = set(df["number"])

assert actual_numbers == expected_numbers

assert df["period"].between(1, 7).all()

assert df["group"].between(1, 18).all()

valid_blocks = {"s", "p", "d", "f"}
assert set(df["block"]).issubset(valid_blocks)

assert (df["atomic_mass"] > 0).all()

assert df["symbol"].notna().all()
assert df["name"].notna().all()

print("✓ All mandatory data-quality checks passed!")

print("\nMissing values:")
missing = df.isnull().sum()
print(missing[missing > 0])