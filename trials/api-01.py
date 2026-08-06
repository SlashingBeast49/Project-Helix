import requests
git_url = "https://api.github.com/"
response = requests.get(git_url)
print(response.status_code)
#print(response.json())
# Importing the response to a CSV
import pandas as pd
data = response.json()
pf = pd.DataFrame([data])
pf.to_csv("test.csv", index=False)