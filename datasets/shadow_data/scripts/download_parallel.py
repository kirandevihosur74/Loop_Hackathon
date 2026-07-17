import json, os, time, urllib.request, threading
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "C:/Users/joebi/AppData/Local/Temp/claude/C--users-joebi/b9780df1-48c6-4d36-9d2f-081798f49c44/scratchpad/"
TILES = BASE + "tiles/"
os.makedirs(TILES, exist_ok=True)
PROG = BASE + "download_progress.txt"
lock = threading.Lock()

N, S, W, E = 37.870, 37.680, -122.525, -122.355
CELL = 0.050

def log(m):
    with lock:
        with open(PROG, "a") as f:
            f.write(m + "\n")
        print(m, flush=True)

lat_edges = []
la = S
while la < N:
    lat_edges.append((la, min(la + CELL, N))); la += CELL
lon_edges = []
lo = W
while lo < E:
    lon_edges.append((lo, min(lo + CELL, E))); lo += CELL
tiles = [(i, j, s, n, w, e) for i, (s, n) in enumerate(lat_edges)
                              for j, (w, e) in enumerate(lon_edges)]

ENDPOINTS = ["https://overpass-api.de/api/interpreter",
             "https://overpass.kumi.systems/api/interpreter",
             "https://overpass.private.coffee/api/interpreter"]

def parse_height(t):
    if "height" in t:
        s = "".join(c for c in t["height"] if c.isdigit() or c == ".")
        try:
            v = float(s)
            if v > 0: return v
        except: pass
    if "building:levels" in t:
        try:
            v = float(t["building:levels"]) * 3.2
            if v > 0: return v
        except: pass
    return 6.0

def fetch(s, n, w, e, idx):
    q = f"[out:json][timeout:240];(way[\"building\"]({s},{w},{n},{e}););out body;>;out skel qt;"
    last = None
    for attempt in range(5):
        url = ENDPOINTS[(idx + attempt) % len(ENDPOINTS)]
        try:
            req = urllib.request.Request(url, data=q.encode(),
                                         headers={"User-Agent": "sf-shadow/0.3"})
            with urllib.request.urlopen(req, timeout=260) as r:
                return json.loads(r.read().decode())
        except Exception as ex:
            last = ex
            time.sleep(4 * (attempt + 1))
    raise RuntimeError(str(last))

def work(t):
    i, j, s, n, w, e = t
    fn = TILES + f"t_{i:02d}_{j:02d}.json"
    if os.path.exists(fn):
        try:
            json.load(open(fn)); return (i, j, "cached", 0)
        except: pass
    try:
        data = fetch(s, n, w, e, i * 3 + j)
    except Exception as ex:
        log(f"  ERR tile {i},{j}: {ex}"); return (i, j, "err", 0)
    els = data.get("elements", [])
    nodes = {el["id"]: (el["lat"], el["lon"]) for el in els if el["type"] == "node"}
    blds = []
    for el in els:
        if el["type"] == "way" and "building" in el.get("tags", {}):
            ring = [nodes[k] for k in el.get("nodes", []) if k in nodes]
            if len(ring) >= 3:
                blds.append({"id": el["id"], "h": round(parse_height(el["tags"]), 1),
                             "r": [[round(a, 6), round(o, 6)] for a, o in ring]})
    json.dump({"b": blds}, open(fn, "w"), separators=(",", ":"))
    log(f"  tile {i},{j}  buildings={len(blds)}")
    return (i, j, "ok", len(blds))

remaining = [t for t in tiles if not os.path.exists(TILES + f"t_{t[0]:02d}_{t[1]:02d}.json")]
log(f"PARALLEL start remaining={len(remaining)}/{len(tiles)}")
total = 0
with ThreadPoolExecutor(max_workers=3) as ex:
    futs = [ex.submit(work, t) for t in remaining]
    for f in as_completed(futs):
        i, j, st, c = f.result()
        total += c

# report any still-missing
missing = [(t[0], t[1]) for t in tiles if not os.path.exists(TILES + f"t_{t[0]:02d}_{t[1]:02d}.json")]
log(f"PARALLEL done new_buildings={total} missing={missing}")
