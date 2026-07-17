# Deploy to Akash (decentralized cloud)

Hosts the loop backend so the mobile-web frontend has a live API. Replaces AWS.
$25 deployment credit: **`AKASHLOOP25`** — redeem at <https://console.akash.network>.

## 1. Build + push the image (from repo root)

```bash
docker build -t <you>/loop-backend:latest -f deploy/Dockerfile .
docker push <you>/loop-backend:latest
```
Then set that image in `deploy/akash.sdl.yml` (`services.web.image`).

## 2. Deploy — pick one

**A) Akash Console (GUI, easiest)**
1. Redeem `AKASHLOOP25` at console.akash.network → adds $25 credit.
2. New deployment → paste `deploy/akash.sdl.yml` → create → accept a bid → view lease.
3. Copy the lease URI (host:port) → that's your API base for the frontend.

**B) `console-axi` — the agent CLI ("give your agent its own cloud")**
Agent-native: deploy → bid → lease → debug → tear down, with **server-side signing**
(the agent never touches keys). On-theme with a self-directing loop.
```bash
curl -fsSL https://raw.githubusercontent.com/baktun14/console-axi/main/install.sh | sh
console-axi deploy --sdl deploy/akash.sdl.yml --deposit 0.5
```

## 3. Verify

```bash
curl https://<lease-uri>/health          # {"ok": true, "data_source": "caiso-oasis+fallback", ...}
curl -X POST "https://<lease-uri>/loop/run?household_id=1"
```

## Notes
- **Secrets:** SDL is public on-chain — don't hardcode `ANTHROPIC_API_KEY` there. The mock
  brain runs keyless; inject real keys via a private channel if needed.
- **Storage:** SQLite is ephemeral (resets on redeploy). Add a persistent volume or an
  external Postgres (`DATABASE_URL`) for durability.
- **Zero.xyz delivery in-cloud:** needs Node + `@zeroxyz/cli` in the image — see the
  commented block in `deploy/Dockerfile`.
