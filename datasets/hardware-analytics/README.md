# Hardware / Appliance Energy Analytics

Energy-consumption breakdown for a set of appliances and hardware captured in on-site
device photos. Each photo has a matching JSON record describing the device, its
nameplate ratings (where readable), and its power draw **in use** versus **plugged in
(standby)**.

## Structure

```
datasets/hardware-analytics/
├── README.md            # this file
├── meta.json            # dataset metadata
├── dataset.json         # combined machine-readable array of all records
├── images/              # one JPG per source photo (HEIC originals decoded to JPG)
└── <photo>.json         # one energy record per photo
```

## Record schema

| Field | Meaning |
|-------|---------|
| `photo_file` | Original photo filename (source of the record) |
| `viewable_jpg` | JPG rendering (for photos shot as HEIC) |
| `device` | Name, brand, model, category, and how it was identified |
| `heat_source` | For heating units: where the thermal energy comes from |
| `nameplate_ratings` | Voltage / current / power read from the rating label, when present |
| `power_consumption` | In-use watts, standby watts, per-use energy, estimated annual kWh |
| `notes` | Practical context and energy-saving notes |
| `confidence` | `high` = nameplate or on-site confirmation; `medium`/`low` = typical-model estimate |
| `data_source` | Nameplate, model spec, on-site confirmation, or typical estimate |

## Devices (13 photos)

| Photo | Device | In-use | Standby (plugged in) | Confidence |
|-------|--------|--------|----------------------|------------|
| 20260717_115226 / _115229 | Wellsys S4 bottleless water dispenser | 90–130 W cold / 350–500 W hot | 15–40 W (24/7) | high (nameplate) |
| 20260717_115239 | 4-slice toaster | 1,400–1,800 W | ~0 W | medium (est.) |
| 20260717_115241 | Panasonic commercial microwave | 1,400–1,600 W | 1–3 W | medium (est.) |
| 20260717_124301 / _124304 | Panasonic PT-RZ970 laser projector | ~840 W | 0.5 W eco / ~35 W network | high (model ID) |
| 20260717_124315 | Room-scheduling touch panels (x2) | 5–15 W each | 2–6 W each | low |
| 20260717_124320 | Whirlpool refrigerator | 100–150 W cycling | always running | medium |
| 20260717_130133 | Lenovo 230 W laptop adapter (ADL230SLC3A) | 30–250 W | 0.1–0.5 W | high (nameplate) |
| IMG_4081 / IMG_4083 | Anker 727 GaNPrime 100 W charging station (A9126) | up to 100 W USB | 0.1–0.5 W | high (nameplate) |
| IMG_4084 | Hydronic fin-tube baseboard convector | ~0 W electric | ~0 W | high (on-site) |
| IMG_4085 | Hydronic fan-coil unit | 50–150 W (fan only) | 0–5 W | high (on-site) |

## Notes on interpretation

- **Standby dominates for always-on gear.** The water dispenser (hot + cold tanks
  held 24/7) and the refrigerator are the largest electricity consumers here, not the
  high-wattage-but-brief appliances (toaster, microwave).
- **Hydronic heaters are near-zero on the *electricity* ledger.** IMG_4084 and IMG_4085
  are fed by the building's hot-water boiler (confirmed on-site: water supply pipe,
  bottom access panels, single control/fan cable). Their heat energy is **boiler fuel**,
  not electricity — only the fan-coil's blower draws power. Track the boiler's fuel use
  separately for the true heating energy.
- Estimated annual kWh figures state their assumptions inline in each record.
