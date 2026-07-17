# San Francisco Shadow Dataset (Dawn → Dusk)

Boolean **shade / sun** data for the San Francisco area — **Sausalito to Daly City** — for every hour from 7 AM to 6 PM, computed from open data with **no API keys**.

For any point (lat, lon) and any hour, you can ask: *is it in shadow or in sunlight?*

- **Date modeled:** 2025-04-15 (PDT) — same day encoded in the reference ShadeMap URL
- **Extent:** 37.680–37.870 N, −122.525–−122.355 W (~316 km²)
- **Buildings:** 184,633 (OpenStreetMap footprints + heights)
- **Grid resolution:** 8 m/pixel, raster 1870 × 2644
- **Hours:** 07:00 – 18:00, hourly (12 layers)

## Files

| File | What it is |
|------|-----------|
| `meta.json` | Georeferencing + sun elevation/azimuth + shaded-area (km²) per hour |
| `shade_0700.png` … `shade_1800.png` | One RGBA layer per hour. **A pixel is IN SHADOW where alpha > 0**; transparent = in sun / no data. Shaded pixels are tinted deep indigo. |
| `base_buildings.png` | Building footprints, for reference / rendering |
| `query_point.py` | CLI + importable helper: given lat/lon (and optional hour), prints SHADE/SUN |
| `sf_shadow_atlas.html` | Self-contained interactive viewer — scrub the day, click any point for its dawn→dusk timeline. Open in any browser. |

## How the shade layers encode data

Each `shade_HH00.png` is a georeferenced boolean mask. To test a point:

```
px_x = (lon - W)      * M_LON / mpp
px_y = (N   - lat)    * M_LAT / mpp      # north is up
in_shadow = (alpha_at(px_x, px_y) > 0)
```

where `W`, `N`, `M_LON`, `M_LAT`, `mpp` are in `meta.json` (equirectangular projection about the extent center — accurate to a few metres across the city).

## Quick start

```bash
# is the point in shade/sun across the whole day?
python query_point.py 37.75944 -122.43351

# just one hour
python query_point.py 37.7694 -122.4862 12       # Golden Gate Park, noon -> SUN
```

Or open `sf_shadow_atlas.html` in a browser and click the map.

## Method

1. **Buildings** — footprints and heights pulled from OpenStreetMap via the Overpass API (tiled). Heights use the `height` tag, else `building:levels × 3.2 m`, else a 6 m default.
2. **Sun position** — elevation and azimuth from the NOAA solar-position algorithm for each hour (no external service).
3. **Shadows** — each building footprint is projected away from the sun by `height / tan(sun_elevation)` and unioned with its footprint; the result is rasterized into the hourly mask. A ground point is in shadow if it falls inside any building's projected shadow.

## Known limitations

- **Flat-ground model.** Shadows are cast onto sea-level ground; terrain elevation (SF's hills) is not yet included, so shadows on steep slopes are approximate.
- **Vegetation not modeled.** Only buildings cast shadows; trees are excluded.
- **Height estimates.** Where OSM lacks a height, levels or a default are used, so individual buildings can be off.
- **8 m grid.** Point queries are accurate to ~8 m; a point that lands on a building footprint reads as shaded all day (ground beneath a building is never sunlit).
- **Single date.** Modeled for 2025-04-15. Re-run the generator for other dates.

All inputs are free and keyless (OpenStreetMap + solar math).
