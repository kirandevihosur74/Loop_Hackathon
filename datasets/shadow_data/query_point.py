#!/usr/bin/env python3
"""Query the SF shadow dataset: is a given lat/lon in shade at a given hour?

Usage:
    python query_point.py <lat> <lon> [hour]     # hour 7..18 (default: all)

Example:
    python query_point.py 37.75944 -122.43351 8
    python query_point.py 37.79 -122.40          # prints the full dawn->dusk timeline

Dataset format (all files in this folder):
    meta.json           georeferencing + sun positions per hour
    shade_HH00.png      RGBA shade layer for that hour; a pixel is IN SHADOW
                        wherever alpha > 0 (transparent = in sun / no data)
    base_buildings.png  building footprints (for reference/rendering)

Georeferencing (equirectangular about the extent, north up):
    px_x = (lon - W) * M_LON / mpp
    px_y = (N  - lat) * M_LAT / mpp
where W, N, M_LON, M_LAT, mpp come from meta.json.
"""
import json, sys, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(os.path.join(HERE, "meta.json")))
W, N, MLON, MLAT, MPP = meta["W"], meta["N"], meta["M_LON"], meta["M_LAT"], meta["mpp"]
WIDTH, HEIGHT = meta["width"], meta["height"]

def ll_to_px(lat, lon):
    return (lon - W) * MLON / MPP, (N - lat) * MLAT / MPP

def shaded(lat, lon, hour):
    x, y = ll_to_px(lat, lon)
    if not (0 <= x < WIDTH and 0 <= y < HEIGHT):
        return None  # outside dataset extent
    img = Image.open(os.path.join(HERE, f"shade_{hour:02d}00.png")).convert("RGBA")
    a = img.getpixel((int(x), int(y)))[3]
    return a > 0

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    lat, lon = float(sys.argv[1]), float(sys.argv[2])
    hours = [int(sys.argv[3])] if len(sys.argv) > 3 else [t["hour"] for t in meta["times"]]
    print(f"point {lat:.5f}, {lon:.5f}   ({meta['date']} {meta['tz']})")
    for h in hours:
        s = shaded(lat, lon, h)
        tag = "OUTSIDE EXTENT" if s is None else ("SHADE" if s else "SUN")
        info = next((t for t in meta["times"] if t["hour"] == h), {})
        print(f"  {h:02d}:00   {tag:14s}  (sun elev {info.get('elev','?')}°, az {info.get('az','?')}°)")
