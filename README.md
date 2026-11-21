# Svasa – Urban Air Quality Assistant

Live air quality, health-profile advice, cleanest-hours planner, 7-day history, city compare, alerts, installable PWA, and a Gemini assistant served through a secure backend proxy.

## Run locally
```
npm test                       # 17+ logic tests and end-to-end proxy tests (mock Gemini)
GEMINI_API_KEY=your_key node server.js   # http://localhost:8080
```
Without a key the app still works with rule-based answers. Opening `index.html` directly also works, with rule-based answers only (the AI key is never exposed to the browser).

## Deploy (Google Cloud Run)
```
gcloud run deploy svasa --source . --region asia-south1 --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=YOUR_KEY
```
Prefer Secret Manager (`--set-secrets GEMINI_API_KEY=name:latest`) for production. Optional `GEMINI_MODEL` (default gemini-2.5-flash).

## Architecture
- `core.js`: pure logic (AQI bands, advice, forecast windows, trip planner, safety layer, prompt builder, input validation), shared by browser and server.
- `server.js`: zero-dependency Node server: static files (whitelist), `/api/ask` (validated input, 4 KB cap, 20 req/min/IP, 10 s timeout, CSP headers), `/api/health`.
- `index.html`: UI. Data from Open-Meteo (CAMS model estimates, not ground monitors).

## Safety
Emergency phrases bypass the AI and show a fixed urgent-care message. AI answers are grounded on live data and end with a deterministic "Data used" line. Not medical advice.

## v3 additions
India NAQI estimate beside US AQI, profile tips, time-window planner, vs-week insight, slope-based trend, richer compare (tap to open, remove), threshold alerts via service worker, offline snapshot of the last reading, install button, multi-turn assistant memory, more intents, Hindi/Telugu emergency detection, structured error logging.
