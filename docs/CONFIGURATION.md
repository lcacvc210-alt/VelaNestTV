# Configuration reference

## Backend: backend/.env.local

| Variable | Required/default | Meaning |
|---|---|---|
| PASSWORD | Required | Login password; must match companion PASSWORD and TV settings |
| DEFAULT_SOURCES | `[]` | Single-line JSON array of user-configured VOD APIs |
| DEFAULT_LIVE_SOURCES | `[]` | Single-line JSON array of M3U subscriptions |
| LIVE_ALLOW_PRIVATE | `0` | Set `1` only to permit trusted LAN live URLs |
| REQUEST_TIMEOUT | `8000` ms | Upstream request timeout |
| MAX_RETRIES | `1` | Upstream retries |
| PROXY_SECRET | derived from PASSWORD | Optional session/proxy signing secret |
| COOKIE_SECURE | automatic | Override cookie Secure flag; HTTP LAN deployment normally needs no override |
| 60S_API_BASE | upstream default | Optional recommendation API base |
| DEBUG | `false` | Debug output |

Example structure (example.invalid is a placeholder and will not play):

```dotenv
DEFAULT_SOURCES=[{"name":"My API","url":"https://example.invalid/api.php/provide/vod","isAdult":false}]
DEFAULT_LIVE_SOURCES=[{"name":"My Live","url":"https://example.invalid/channels.m3u"}]
```

A VOD endpoint must implement the compatible provide/vod list/search/detail format; arbitrary website URLs are not interchangeable. JSON must stay on one line. Use sources you are authorized to access. Empty arrays mean no configured VOD/live source, not a broken installation.

## Companion: companion/.env

| Variable | Required/default | Meaning |
|---|---|---|
| PASSWORD | Required | Same password as backend |
| CORE_URL | `http://127.0.0.1:8080` | Core backend URL as seen from companion |
| NAS_ROOT | repository `media/` | Absolute path to a read-only media folder; created if missing |

Node does not load .env automatically here: start with `node --env-file=.env server.mjs`. Quote paths containing spaces, for example `NAS_ROOT="F:/My Movies"`. `companion/data/` is generated automatically: catalog cache, stable backend identity and NAS signing key. Keep it private and retain it across upgrades. Changing NAS_ROOT requires restarting companion.

## Ports and TV settings

- TCP 8080: backend, configured by startup command.
- TCP 8090: companion; currently fixed in both client and service.
- UDP 45831: LAN discovery; currently fixed.
- Android SDK variables: JAVA_HOME/JDK_HOME, ANDROID_SDK_ROOT/ANDROID_HOME, documented in INSTALL.md.

On TV enter `http://YOUR_PC_LAN_IP:8080` and PASSWORD once. `localhost` on the television means the television itself. The distributed source uses a neutral localhost default; set the actual PC address before connecting. Address/password and viewing history persist across same-signature upgrades. Discovery attempts to reconnect to the remembered backend identity after address changes; separate subnets/guest Wi-Fi may block broadcast. TV clients require ports 8090/45831. Service overrides are intended for isolated tests, not alternate TV deployment ports.
