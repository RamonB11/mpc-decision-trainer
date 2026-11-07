# SSD Nodes VPS rollout — TROP training bridge

This guide assumes the user's **spare** SSD Nodes Linux VPS already runs a working TAK Server. It does **not** reinstall TAK, migrate its database, open its administrative port to the internet, or make any changes to an operational TAK Server. Obtain appropriate local approval before use with government systems or information.

## Desired layout

- Existing public Vercel **preview**: static MPC Decision Trainer and EXCON HTML console.
- SSD Nodes VPS: existing TAK Server **plus** an isolated Node.js training bridge.
- Training bridge listens only on `127.0.0.1:8787` by default.
- A TLS-terminated, authenticated private access path (VPN or secured reverse proxy) serves the bridge to the instructor/player browser.
- The bridge publishes permitted synthetic CoT events to TAK's server-side mTLS client listener (typically 8089). TROP connects to that TAK Server with its **own separate** client identity.
- Do **not** copy actual location tracks, existing operational overlays, mission content, classified information, CUI, or real user credentials into this environment.

## Step 0 — Inspect the existing VPS without changing it

SSH to your VPS through its existing approved access path (do not share credentials or private addresses in GitHub or ChatGPT).

```bash
cat /etc/os-release
uname -m
free -h
df -h /
sudo ss -lntp | grep -E ':(8089|8443|8446|443|8787)\b' || true
sudo systemctl list-units --type=service --no-pager | grep -Ei 'tak|nginx|caddy|docker|podman' || true
```

Identify whether TAK Server runs natively or in Docker/Podman, the actual port configuration, certificate authorities, and whether the machine has sufficient free memory. If your provider uses a non-systemd environment or custom ports, adjust these steps accordingly.

**Stop here if the server holds operational unit data**. Prefer a separate isolated VPS/instance for training rather than relying only on TAK group permissions.

## Step 1 — Verify TROP can connect to this TAK Server

1. Create a **new training-only end-user identity**, its own TAK client certificate, and an appropriate training group (not an admin certificate).
2. Configure TROP to use the VPS TAK hostname, TLS connection, configured TAK client port (commonly `8089`), and that identity. Import any trust material required by TROP.
3. Make a harmless test marker in TROP and verify visibility in another **training** TAK client.
4. If connection fails, troubleshoot TROP's certificate formats, server version, and its actual connection settings before adding the bridge.

TROP interoperability and certificate import details depend on its installed version and have **not** been verified in this repository.

## Step 2 — Prepare the private bridge process

Use an unprivileged service account (e.g. `tdg-bridge`) on the VPS, a dedicated code directory, and Node.js 20+ verified by `node --version`.

Copy the reviewed `integrations/trop-bridge/` folder from the feature branch to a separate directory on the VPS; do not modify the running TAK Server files.

Generate **three distinct long random role tokens locally** and keep them in a root-owned or dedicated-service-owned environment file, never in the public repository or the browser.

```bash
# Example only — perform on VPS and retain output privately
openssl rand -hex 32
```

Example environment variable names (not real values):

```text
TDG_BIND_HOST=127.0.0.1
TDG_PORT=8787
TDG_ALLOWED_ORIGIN=https://YOUR-VERCEL-PREVIEW-ORIGIN
TDG_EXCON_TOKEN=(separate local secret)
TDG_PLAYER_TOKEN=(separate local secret)
TDG_OBSERVER_TOKEN=(separate local secret)
TDG_PUBLISH_ENABLED=0
```

The service should start through a systemd unit as a non-root account, with `WorkingDirectory` set to the cloned project's root and `ExecStart` running `node integrations/trop-bridge/server.mjs`. Keep secrets in a protected `EnvironmentFile` with file permissions `0600`. Use an approved reverse proxy or VPN for the browser's access to the loopback-bound port; **never simply change `TDG_BIND_HOST` to `0.0.0.0` and open 8787 to the world**.

If using a reverse proxy, put its HTTPS origin (including correct scheme and port) in the player pairing dialog. Configure CORS with the exact Vercel preview origin. Avoid exposing the EXCON token to users.

## Step 3 — Run the bridge in dry-run mode

Verify `/health` from the VPS or private access path. Open the EXCON console in the Vercel feature preview:
`/integrations/trop-bridge/excon.html`.

- Connect using the bridge origin and EXCON role credential.
- Create a session with a valid scenario ID (for example `recon-continuous`).
- In the existing trainer preview, pair with **player** token and matching session and scenario IDs.
- Launch one scenario, commit a decision, and open the AAR.
- Confirm the event journal shows these actions without leader free text, actual coordinates, or scores.
- Release one clearly fictional marker from EXCON, and confirm `delivery=dry-run` plus a CoT XML preview.

This phase does not publish anything to TAK.

## Step 4 — Enable TAK publishing only after dry-run acceptance

Create a **distinct non-admin bridge client identity** that is authorized to publish only in the isolated synthetic training environment. The VPS-local bridge service must be able to read the bridge's client certificate, private key and server CA trust chain.

```text
TDG_PUBLISH_ENABLED=1
TDG_TAK_HOST=(TAK host as reachable from the bridge)
TDG_TAK_SERVER_NAME=(TLS certificate DNS name)
TDG_TAK_PORT=8089
TDG_TAK_CERT_FILE=(private client certificate path)
TDG_TAK_KEY_FILE=(private client key path)
TDG_TAK_CA_FILE=(private trust chain path)
```

Restart only the training bridge service. Leave TAK Server, its database, certificates and firewall unchanged unless a separately reviewed change is genuinely required.

Repeat the synthetic inject from EXCON and observe whether TROP receives it through the TAK Server. Confirm server delivery, group visibility, marker lifetime (currently 120 seconds), update behavior, and reconnection after signal loss. The current bridge assumes the TAK listener accepts a TLS CoT XML send; this needs empirical verification.

## Recommended acceptance checklist

- [ ] TAK VPS is unused/spare and contains no operational/CUI data
- [ ] VPS OS, service layout, resources and ports inspected
- [ ] TROP connects with its own training credential and exchanges test markers
- [ ] Bridge process is non-root and bound locally
- [ ] Browser accesses bridge through trusted HTTPS and a private/approved access path
- [ ] Role tokens are distinct, protected, and never present in source control
- [ ] Existing game works normally if bridge is disconnected
- [ ] Dry-run inject returns valid synthetic CoT and no TAK traffic
- [ ] Live synthetic inject reaches TROP with correct visibility
- [ ] EXCON-only contacts never publish to TAK or appear in player journal
- [ ] No sensitive data, free text, or actual unit location data are transmitted
- [ ] AAR captures sufficient timestamps for the pilot

## Known gaps

The pilot currently uses in-memory session storage, shared role tokens, manual instructor injects, and a basic CoT TCP/TLS publisher. It has not yet implemented verified TROP two-way interaction, geographic transforms for the trainer's internal COP, user-specific authentication, or durable replay. Treat it as an integration test environment, **not** a production-ready multiplayer service.
