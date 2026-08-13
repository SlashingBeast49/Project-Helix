import json
import pandas as pd
with open("src/PeriodicTableJSON.json", "r", encoding="utf-8") as f:
    data = json.load(f)
elements = [e for e in data["elements"] if e["number"] <= 118]
df = pd.DataFrame(elements)


print(df.head())



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
    "electron_configuration",
]

df = df[columns]
print(df.shape)
# df.to_csv("elements.csv", index=False)
'''print(df.info())
print(df.isnull().sum())'''
print(df[df["molar_heat"].isna()][["number", "symbol", "name"]])
print(df[df["electronegativity_pauling"].isna()][["number", "symbol", "name"]])