import json
with open("src/PeriodicTableJSON.json", "r", encoding="utf-8") as f:
    data = json.load(f)
elements = [e for e in data["elements"] if e["number"] <= 118]

import pandas as pd
df = pd.DataFrame(elements)

#print(df["atomic_mass"].describe())


print(df.sort_values("atomic_mass")[["number", "symbol", "atomic_mass"]].head())
print(df.sort_values("atomic_mass")[["number", "symbol", "atomic_mass"]].tail())
print(df[df["atomic_mass"] <= 0])