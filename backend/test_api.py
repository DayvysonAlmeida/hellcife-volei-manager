import urllib.request, json
req = urllib.request.Request('http://127.0.0.1:8000/api/players/', headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        for p in data['results'][:10]:
            print(f"{p['name']} - Rank: {p['stats'].get('win_rank')}")
except Exception as e:
    print(e)
