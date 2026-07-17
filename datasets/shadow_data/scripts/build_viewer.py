import json, base64, os

BASE = "C:/Users/joebi/AppData/Local/Temp/claude/C--users-joebi/b9780df1-48c6-4d36-9d2f-081798f49c44/scratchpad/"
OUT = BASE + "sf_out/"
meta = json.load(open(OUT + "meta.json"))

def durl(fn):
    with open(OUT + fn, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()

assets = {
    "meta": meta,
    "base": durl("base_buildings.png"),
    "shades": [durl(f"shade_{t['hour']:02d}00.png") for t in meta["times"]],
}
tpl = open(BASE + "viewer_template.html", encoding="utf-8").read()
html = tpl.replace("__ASSETS__", json.dumps(assets))
outfn = BASE + "sf_shadow_atlas.html"
open(outfn, "w", encoding="utf-8").write(html)
print("wrote", outfn, "size_mb", round(os.path.getsize(outfn)/1e6, 2))
