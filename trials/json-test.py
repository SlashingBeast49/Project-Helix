import json
with open("src/PeriodicTableJSON.json", "r", encoding="utf-8") as f:
    data = json.load(f)
print(data["elements"][-5:])
elements = [e for e in data["elements"] if e["number"] <= 118]

print(len(elements))
print(elements[0].keys())