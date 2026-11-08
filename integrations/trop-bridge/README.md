# TROP training bridge (proof of concept)

This **opt-in, synthetic-data-only** companion connects the MPC Decision Trainer's browser game lifecycle to an isolated training session feed and, when explicitly enabled, publishes EXCON-approved synthetic Cursor-on-Target (CoT) markers to a separate TAK Server for display in compatible clients such as TROP.

Production remains unchanged until this feature branch is reviewed and merged.

## Implemented in this branch

- A **TROP Lab · Connect** button appears in the Decision Trainer.
- The existing game emits three structured browser-only events: scenario started, decision committed, and AAR opened.
- The browser companion can send those **minimal event metadata** to a training bridge after the player manually pairs it to a session. It sends **no rationale, leader free text, score, coordinates, or progress data**.
- A standalone Node HTTP bridge exposes EXCON-created sessions, role-protected events, observer-visible SSE, and EXCON-controlled simulated CoT markers.
- CoT publishing is **OFF BY DEFAULT**; with no TAK credentials configured, the injector returns XML previews but sends nothing to TAK.
- CoT events use stable TDG-prefixed IDs and an explicit **SIMULATED TRAINING CONTACT - NOT LIVE** label.
- In-memory event journal is available to EXCON for a basic AAR.

## Not yet implemented

This is a foundational, runnable integration **not a completed multiplayer TDG**. It does not provide shared database persistence, durable AAR storage, player-specific login, app-to-TAK two-way synchronization, terrain-calibrated conversion of the game's internal x/y map, or verified TROP compatibility. CoT publishing remains unverified with a real TROP/TAK pairing. These are subsequent development and acceptance-test steps.

## 1. Start the isolated bridge

Use Node.js 20+ on a privately controlled training host. Do **not** expose it directly to the public internet. Give each role a different 24+-character token.

```bash
export TDG_EXCON_TOKEN="REPLACE_WITH_LONG_RANDOM_EXCON_TOKEN"
export TDG_PLAYER_TOKEN="REPLACE_WITH_DIFFERENT_LONG_RANDOM_PLAYER_TOKEN"
export TDG_OBSERVER_TOKEN="REPLACE_WITH_DIFFERENT_LONG_RANDOM_OBSERVER_TOKEN"
export TDG_ALLOWED_ORIGIN="https://YOUR-VERCEL-PREVIEW-ORIGIN"
node integrations/trop-bridge/server.mjs
```

The bridge listens on `127.0.0.1:8787` by default. For a remote preview, use an authenticated HTTPS reverse proxy or private-network tunnel; `TDG_ALLOWED_ORIGIN` must match the **exact** preview origin. CORS is not authentication. Avoid any production, military-network, operational, CUI, or real-world unit tracking data.

The launch refuses missing or duplicated tokens.

## Private EXCON console over SSH (preferred for desktop testing)

Keep a Windows terminal running `ssh -N -L 8787:127.0.0.1:8787 root@YOUR_VPS_IP` (or use a non-root SSH account when configured). Open `http://127.0.0.1:8787/excon` on the **same Windows desktop**, then use Bridge URL `http://127.0.0.1:8787`. The page and API use the same origin, so this avoids mixed-content restrictions from the HTTPS Vercel preview. The server stays bound to loopback; no new public port is needed. The EXCON bearer token is stored in `/etc/tdg-bridge.env` on the VPS; enter it privately, never share it or include it in screenshots. The `excon.html` file must be readable by the `tdg-bridge` service account (permissions 644 in a traversable directory).

The browser console is a convenience UI, not a replacement for bearer-token authentication. Leave `TDG_PUBLISH_ENABLED=0` until group isolation, credential rotation and live TAK acceptance are completed.

## 2. Create a game session (EXCON)

**No-command-line option:** open `/integrations/trop-bridge/excon.html` on the Vercel feature-branch preview. Enter the secure bridge URL and EXCON token (memory only), select a scenario, and click **Create session**. The same page can release/withhold synthetic map contacts and refresh the event journal. Never paste the EXCON token into the player view.

Use a scenario ID present in the trainer, for example `recon-continuous`.

```bash
curl -sS -X POST http://127.0.0.1:8787/v1/sessions \
  -H "Authorization: Bearer $TDG_EXCON_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"recon-continuous"}'
```

Copy the returned `sessionId`.

In the **Vercel feature-branch preview**, open the Decision Trainer, select the matching scenario, then tap **TROP Lab · Connect**. Enter the **HTTPS training bridge origin**, `sessionId`, `scenarioId`, and **player** token. These values stay in the current browser tab's memory and are never committed to GitHub. Starting the scenario, submitting decisions, and opening the AAR will now produce timestamped session events.

## 3. Release a synthetic CoT marker (EXCON)

Replace `SESSION_ID` with the session ID created above. This example describes a fabricated contact only.

```bash
curl -sS -X POST "http://127.0.0.1:8787/v1/sessions/SESSION_ID/inject" \
  -H "Authorization: Bearer $TDG_EXCON_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"objectId":"contact_001","callsign":"SIM CONTACT 001","affiliation":"unknown","lat":39.0,"lon":-86.5,"visibility":"player"}'
```

With publishing disabled, the response contains a CoT XML **preview** and a `dry-run` delivery status. Events with `"visibility":"excon"` stay in EXCON's journal and are **never** sent to TAK.

To view the journal:

```bash
curl -sS "http://127.0.0.1:8787/v1/sessions/SESSION_ID/events" \
  -H "Authorization: Bearer $TDG_EXCON_TOKEN"
```

For live monitoring, GET `/v1/sessions/SESSION_ID/stream` using the same bearer header. Events hidden from the player are filtered from observer/player streams. **The in-memory journal is lost on restart.**

## 4. Connect to a test TAK Server (separate acceptance step)

Only after dry-run tests pass, configure a **separate approved training** TAK Server and a valid mTLS client certificate. Keep keys outside source control. The bridge attempts a standard XML CoT TLS send on the configured port. Confirm that your chosen TAK Server actually accepts this transport and that TROP displays the marker. Neither is guaranteed solely by protocol advertising.

```bash
export TDG_PUBLISH_ENABLED="1"
export TDG_TAK_HOST="TRAINING_TAK_HOST"
export TDG_TAK_SERVER_NAME="TRAINING_TAK_TLS_NAME"
export TDG_TAK_PORT="8089"
export TDG_TAK_CA_FILE="/private/ca.pem"
export TDG_TAK_CERT_FILE="/private/bridge-client.crt"
export TDG_TAK_KEY_FILE="/private/bridge-client.key"
# If key header says ENCRYPTED PRIVATE KEY, set TDG_TAK_KEY_PASSPHRASE securely in service EnvironmentFile
```

Restart the bridge with the same three role tokens. In TROP, connect to that training TAK Server using a **separate device credential**; never reuse the bridge's certificate on the iPhone. Avoid developer-operated free/public TAK servers for any nonpublic data.

## 5. Validation checks

```bash
npm run test:bridge
npm test
```

Acceptance criteria:

1. Existing Easy/Medium/Hard scenarios, scoring, AAR, and progress export still work offline with the bridge disconnected.
2. A player can pair only after EXCON creates the matching session.
3. Wrong scenario IDs and inappropriate role tokens are rejected.
4. EXCON-only injects remain hidden from player/observer sessions and TAK.
5. CoT is dry-run by default; actual publishing requires explicit mTLS settings.
6. With a real isolated TAK Server, the synthetic marker appears in TROP; verify update/stale behavior on the device.
7. No credentials, actual unit positions, CUI, user text, or real exercise data enter the public repository or Vercel Analytics.

## Next increments

- Persistent session store and audit log for the AAR.
- Short-lived user/session credentials rather than shared role tokens.
- A web-based EXCON panel with a release/withhold queue.
- Synthetic geographic scenario maps calibrated independently of the game's internal map coordinates.
- Verified TAK/TROP compatibility and optional inbound TAK event parsing for replay.
- Multiple player identities, synchronized decisions, observer view and scenario replay.

Do not connect this bridge to an existing operational TAK Server. Local approval and risk assessment are required before any use with government networks, devices, or nonpublic information.
