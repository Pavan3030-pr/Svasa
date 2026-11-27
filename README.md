# SVASA · Personal air intelligence

**Know your air. Plan your day.** SVASA is a responsive, installable air-quality decision aid that turns environmental data into practical outdoor-planning guidance. It does not diagnose conditions or measure personal exposure.

[Live application](https://svasa-sage.vercel.app/) · [Automated verification](https://github.com/Pavan3030-pr/Svasa/actions) · [Judge demonstration](docs/DEMO.md)

## What makes it different

The Smart Day Planner first minimizes caution windows, then the modelled PM2.5 concentration-time proxy, for up to four flexible activities. It compares the proposed schedule with the preferred schedule and explains the trade-off. The proxy is not an inhaled dose or health outcome.

| Module | Function |
|---|---|
| Today | Live modelled US AQI, pollutant details, nearby ground readings, profile-aware precautions |
| Forecast | Hourly outlook, lower-pollution window and seven-day AQI history |
| Planner | Commute/workout window and multi-activity optimization |
| Family / cities | Local family profiles and live city comparison |
| Ask | Grounded Gemini answers in five languages with emergency bypass and labelled deterministic fallback |
| Breathing | Guided relaxation exercise |
| Reports | Local projected plans, export, optional usability feedback |
| Alerts | In-app notifications and opt-in daily background push; manual test receipt confirmation |
| Offline | Last saved model snapshot or clearly labelled sample; current advice and planning blocked |

## Architecture

```
Browser (HTML, CSS, generated JS bundles, service worker)
  ├─ Open-Meteo / CAMS air model and forecasts
  ├─ Open-Meteo geocoding and weather
  └─ Vercel APIs / Node server
       ├─ verified server-side air context → Gemini / rule guidance
       ├─ OpenAQ ground measurements
       └─ Upstash Redis → rate limits, push subscriptions, daily dispatch
```

`frontend/js/core.js` is shared pure logic. Reports and notification controls live in dedicated modules; generated browser bundles avoid extra requests. The app has one direct runtime dependency, locked with integrity hashes. The service worker never caches API responses.

## Run locally

Use Node 26.x (as pinned in package.json). Run:

```sh
npm ci
npm test
npm start
# http://localhost:8080
```

The air dashboard works without a Gemini key. Optional services are enabled by environment variables:

| Variable | Purpose |
|---|---|
| GEMINI_API_KEY / GEMINI_MODEL | Live model answers; default model gemini-2.5-flash |
| OPENAQ_API_KEY | Ground stations |
| UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN | Distributed limits and push storage (KV_REST aliases also supported) |
| VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT | Push identity |
| CRON_SECRET | Authenticated scheduler |
| PUSH_MAX_SUBSCRIPTIONS | Default 60, allowed 20–120; bounded daily service |
| PORT | Local port, default 8080 |

Keep secrets in server environment variables, never browser code or Git. Deploy by importing this repository in Vercel and setting production variables. The configured daily cron checks subscribed fixed cities, not moving locations.

After editing CSS or JS source, regenerate checked-in browser assets as applicable:

```sh
npm run sync:styles
npm run sync:landing
npm run sync:app
```

## Verification and evidence

GitHub Actions runs syntax, pure logic, server, API, failure-mode and browser fixture tests; real Chromium journeys against the exact deployed commit; and local plus deployed Lighthouse audits. Inspect the latest workflow artifacts for current screenshots, accessibility results and metrics. Older illustrative screenshots in docs/screenshots are not current release evidence.

The bounded capacity test uses 24 read-only requests with four concurrent clients. A separate fixture test coalesces 100 identical first-turn requests. Push dispatch uses a 12-worker pool, fixture-tested with 60 subscriptions. These are not large-scale production load tests.

The automatic release test checks verified Gemini responses or correctly labelled deterministic fallback. A separate strict live Gemini workflow requires actual model responses in all five languages. External provider outages or quota restrictions are reported, not counted as live model success.

## Data, safety and privacy

Model data are area estimates; OpenAQ readings are independent station observations, with age and distance disclosed. India-scale AQI is a partial model estimate, not official CPCB AQI. Forecasts can change. Sensitive-profile recommendations are precautionary, not individualized medical advice. Emergency phrases bypass Gemini. No clinical or native-speaker validation is claimed.

Family profiles, reports and feedback stay on the device unless the user exports them. AI questions send selected coordinates, profile and bounded context to the backend and model provider. Background alerts store an explicitly subscribed fixed city and endpoint, expire after 30 days, and can be revoked. Physical-device notification delivery and independent participant usability remain to be confirmed.

See [security and operational limits](docs/SECURITY.md), [product requirements](docs/PRD.md), [prompt engineering](docs/PROMPT-ENGINEERING.md) and [volunteer validation protocol](docs/USER-VALIDATION.md).

Dashboard release hardening: current readings and offline snapshots must contain a valid timestamp and AQI. Invalid cached data falls back to clearly labelled sample data, and city changes immediately clear previous plans. The hero presents concise guidance and a separate dominant-pollutant chip; the detailed advice remains below. Production mobile browser coverage includes the landing preview and horizontal overflow.
