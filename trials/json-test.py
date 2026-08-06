import json
with open("src/PeriodicTableJSON.json", "r", encoding="utf-8") as f:
    data = json.load(f)
print(data["elements"][-5:])