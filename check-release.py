import urllib.request, json
req = urllib.request.Request('https://api.github.com/repos/namnguyen119944/Review-Auto-Creator/releases')
res = urllib.request.urlopen(req)
data = json.loads(res.read())
for r in data:
    if r['name'] == '0.0.2':
        print(f"Release {r['name']} has {len(r['assets'])} assets:")
        for a in r['assets']:
            print(' - ' + a['name'])
