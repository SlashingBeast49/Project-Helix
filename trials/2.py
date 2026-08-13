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
print(df[["number", "symbol", "name"]].head())
for element in data["elements"][:5]:
    print(element["name"], "→", element["source"])