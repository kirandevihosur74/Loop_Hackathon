# Deploy to Akash (decentralized cloud)

Hosts the loop backend so the mobile-web frontend has a live API. Replaces AWS.
$25 deployment credit: **`AKASHLOOP25`** — redeem at <https://console.akash.network>.

## ✅ Live deployment

```
http://f0dfog82pla0j40dtmkpcgi96c.ingress.cpu.aesservices.net
```
Verified: `GET /health` → `{"ok":true,...,"data_source":"caiso-oasis+fallback"}`, and
`POST /loop/run?household_id=1` returns nudges off **real live CAISO NP15 prices**.
Image: `ghcr.io/kirandevihosur74/loop-backend:v2` (linux/amd64, public). HTTP only.

## 1. Build + push the image (from repo root)

Akash nodes are **x86_64** — you must build **linux/amd64** or the pod crashloops with
`exec /usr/local/bin/uvicorn: exec format error`.

```bash
# GHCR needs the write:packages scope on your gh token:
gh auth refresh -h github.com -s write:packages,read:packages
gh auth token | docker login ghcr.io -u <you> --password-stdin

# Clean single-arch amd64 build (no attestation manifest), pushed to GHCR:
docker buildx build --platform linux/amd64 --provenance=false --sbom=false \
  -t ghcr.io/<you>/loop-backend:v2 -f deploy/Dockerfile . --push
```
Then make the package **public**: GitHub → your avatar → **Packages** → `loop-backend`
→ **Package settings** → Danger Zone → **Change visibility → Public**.
(Akash pulls anonymously; a private image gives the provider a `403 Forbidden`.)

## 2. Deploy — pick one

**A) Akash Console (GUI, easiest)**
1. Redeem `AKASHLOOP25` → adds credit ($1 free trial also covers this footprint).
2. **Deploy image** (not the templates) → set the fields:
   - Image: `ghcr.io/<you>/loop-backend:v2`
   - **Ports:** container **`8000`** → expose **as `80`**, **Global** ← the app listens on 8000
   - Env: `USE_MOCK_DATA=false`
3. Request quotes → accept a bid → open the lease → copy the URI (your API base).

**B) `console-axi` — the agent CLI ("give your agent its own cloud")**
Agent-native: deploy → bid → lease → debug → tear down, **server-side signing**
(the agent never touches keys). On-theme with a self-directing loop.
```bash
curl -fsSL https://raw.githubusercontent.com/baktun14/console-axi/main/install.sh | sh
console-axi deploy --sdl deploy/akash.sdl.yml --deposit 0.5
```

## 3. Verify

```bash
curl http://<lease-uri>/health          # {"ok": true, "data_source": "caiso-oasis+fallback", ...}
curl -X POST "http://<lease-uri>/loop/run?household_id=1"
```

## Gotchas we actually hit (in order)

| Symptom | Cause | Fix |
|---|---|---|
| `push denied: token ... scopes` | gh token missing `write:packages` | `gh auth refresh -s write:packages,read:packages` |
| provider `403 Forbidden` pulling | GHCR package private | make package **Public** |
| `exec format error`, crashloop | image built arm64 (Apple Silicon) | rebuild `--platform linux/amd64` |
| new image not picked up | node cached old `:latest` | push a **new tag** (`:v2`) + Update Deployment |
| `502 Bad Gateway` | expose port ≠ app port | expose `port: 8000` (as `80`), not `80` |

## Notes
- **Secrets:** SDL/env is public on-chain — don't hardcode `ANTHROPIC_API_KEY`. The mock
  brain runs keyless; the live deploy shows `agent_brain: mock`. Inject a real key privately
  to enable Claude reasoning in-cloud.
- **Storage:** SQLite is ephemeral (resets on redeploy). Add a persistent volume or an
  external Postgres (`DATABASE_URL`) for durability.
- **Zero.xyz delivery in-cloud:** needs Node + `@zeroxyz/cli` in the image — see the
  commented block in `deploy/Dockerfile`.
