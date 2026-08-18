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
# Source validation

sources = [e["source"] for e in elements]

assert len(sources) == 118
assert all(isinstance(s, str) and s.startswith("https://") for s in sources)
assert len(set(sources)) == 118

print("✓ All 118 elements have unique source URLs!")