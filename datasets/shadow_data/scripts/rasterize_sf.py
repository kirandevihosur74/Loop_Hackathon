import json, os, math, glob, time
import numpy as np
from PIL import Image, ImageDraw
from datetime import datetime, timezone, timedelta

BASE = "C:/Users/joebi/AppData/Local/Temp/claude/C--users-joebi/b9780df1-48c6-4d36-9d2f-081798f49c44/scratchpad/"
TILES = BASE + "tiles/"
OUT = BASE + "sf_out/"
os.makedirs(OUT, exist_ok=True)

# ---- extent (must match downloader) ----
N, S, W, E = 37.870, 37.680, -122.525, -122.355
CLAT = (N + S) / 2
M_LAT = 111320.0
M_LON = 111320.0 * math.cos(math.radians(CLAT))
MPP = 8.0  # meters per pixel

# meter extent (x east from W, y north from S) -> image with y flipped (north up)
Wm = (E - W) * M_LON
Hm = (N - S) * M_LAT
WIDTH = int(math.ceil(Wm / MPP))
HEIGHT = int(math.ceil(Hm / MPP))

def ll_to_px(lat, lon):
    x = (lon - W) * M_LON / MPP
    y = (N - lat) * M_LAT / MPP  # north at top
    return x, y

# ---- load + dedup buildings ----
t0 = time.time()
seen = set()
blds = []  # (height, [(px,py),...])
for fn in sorted(glob.glob(TILES + "t_*.json")):
    try:
        arr = json.load(open(fn))["b"]
    except Exception:
        continue
    for b in arr:
        if b["id"] in seen:
            continue
        seen.add(b["id"])
        pts = [ll_to_px(la, lo) for la, lo in b["r"]]
        blds.append((b["h"], pts))
print(f"buildings (deduped) = {len(blds)}  raster = {WIDTH}x{HEIGHT}px @ {MPP}m  load {time.time()-t0:.1f}s")

# precompute building bbox in meters-as-pixels and base arrays
base_polys = []
for h, pts in blds:
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    base_polys.append((h, pts))

def convex_hull(pts):
    pts = sorted(set((round(x, 2), round(y, 2)) for x, y in pts))
    if len(pts) <= 2:
        return pts
    def cr(o, a, b): return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo = []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    up = []
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

# ---- solar ----
def sun_pos(dt, lat, lon):
    jd = (dt - datetime(2000,1,1,12,tzinfo=timezone.utc)).total_seconds()/86400.0+2451545.0
    jc = (jd-2451545.0)/36525.0
    L0=(280.46646+jc*(36000.76983+jc*0.0003032))%360
    M=357.52911+jc*(35999.05029-0.0001537*jc); Mr=math.radians(M)
    e=0.016708634-jc*(0.000042037+0.0000001267*jc)
    C=(math.sin(Mr)*(1.914602-jc*(0.004817+0.000014*jc))+math.sin(2*Mr)*(0.019993-0.000101*jc)+math.sin(3*Mr)*0.000289)
    app=L0+C-0.00569-0.00478*math.sin(math.radians(125.04-1934.136*jc))
    mo=23+(26+((21.448-jc*(46.815+jc*(0.00059-jc*0.001813))))/60)/60
    ob=mo+0.00256*math.cos(math.radians(125.04-1934.136*jc))
    decl=math.degrees(math.asin(math.sin(math.radians(ob))*math.sin(math.radians(app))))
    y=math.tan(math.radians(ob/2))**2
    eqt=4*math.degrees(y*math.sin(2*math.radians(L0))-2*e*math.sin(Mr)+4*e*y*math.sin(Mr)*math.cos(2*math.radians(L0))-0.5*y*y*math.sin(4*math.radians(L0))-1.25*e*e*math.sin(2*Mr))
    tst=((dt.hour*60+dt.minute+dt.second/60.0)+eqt+4*lon)%1440
    ha=tst/4-180
    latR,declR,haR=math.radians(lat),math.radians(decl),math.radians(ha)
    zen=math.acos(max(-1,min(1,math.sin(latR)*math.sin(declR)+math.cos(latR)*math.cos(declR)*math.cos(haR))))
    elev=90-math.degrees(zen); den=math.cos(latR)*math.sin(zen)
    if abs(den)>1e-9:
        az=math.degrees(math.acos(max(-1,min(1,(math.sin(latR)*math.cos(zen)-math.sin(declR))/den))))
        az=(az+180)%360 if ha>0 else (540-az)%360
    else: az=180.0
    return elev,az

# base layer: building footprints (for orientation), RGBA transparent bg
base_img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
bd = ImageDraw.Draw(base_img)
for h, pts in base_polys:
    bd.polygon([(int(x), int(y)) for x, y in pts], fill=(74, 85, 104, 255))
base_img.save(OUT + "base_buildings.png")

DATE=(2025,4,15); TZ=-7
meta = {"extent_ll": [S, W, N, E], "center": [CLAT, (W+E)/2], "mpp": MPP,
        "width": WIDTH, "height": HEIGHT, "date": "2025-04-15", "tz": "PDT",
        "M_LAT": M_LAT, "M_LON": M_LON, "W": W, "N": N,
        "building_count": len(blds), "area_km2": round(Wm * Hm / 1e6, 1), "times": []}

print("hour  elev   az     %shaded   sec")
for h in range(7, 19):
    ts = time.time()
    dt = datetime(DATE[0],DATE[1],DATE[2],0,0,0,tzinfo=timezone.utc)+timedelta(hours=h-TZ)
    elev, az = sun_pos(dt, CLAT, (W+E)/2)
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if elev > 0.5:
        # shadow offset in pixels: shadow cast opposite the sun
        L = 1.0 / math.tan(math.radians(elev))  # meters of shadow per meter of height
        # sun az clockwise from north; shadow dir (E,N) = (-sin az, -cos az)
        dxm = -math.sin(math.radians(az))
        dym = -math.cos(math.radians(az))
        # in pixel space: +x = east, +y = south (north up). east->+x, north->-y
        for hgt, pts in base_polys:
            shift = hgt * L / MPP
            ox = dxm * shift
            oy = -dym * shift  # north component flips sign in pixel-y
            moved = [(x + ox, y + oy) for x, y in pts]
            hull = convex_hull(pts + moved)
            if len(hull) >= 3:
                d.polygon([(int(x), int(y)) for x, y in hull], fill=(11, 17, 38, 200))
    arr = np.asarray(img)[..., 3]
    shaded_px = int((arr > 0).sum())
    shaded_km2 = round(shaded_px * MPP * MPP / 1e6, 2)
    img.save(OUT + f"shade_{h:02d}00.png")
    meta["times"].append({"hour": h, "label": f"{h:02d}:00", "elev": round(elev,2),
                          "az": round(az,2), "shaded_km2": shaded_km2})
    print(f"{h:02d}00  {elev:5.2f}  {az:6.2f}  {shaded_km2:7.2f}km2  {time.time()-ts:.1f}")

json.dump(meta, open(OUT + "meta.json", "w"), indent=1)
print(f"\nwrote {OUT} : base_buildings.png, shade_0700..1800.png, meta.json")
print(f"total {time.time()-t0:.1f}s")
