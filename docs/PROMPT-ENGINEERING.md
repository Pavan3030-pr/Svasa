# Prompt engineering and validation

SVASA's assistant evolved from a browser-provided context concatenated into a single instruction to a server-fetched context, separated system instruction and schema-constrained JSON response.

## Trust boundary

The browser supplies coordinates, a user-selected profile, language and recent conversation. The server validates coordinates and retrieves fresh Open-Meteo model readings. The model receives explicit data, not trusted user instructions. Health emergency phrases bypass the model; no environmental data or model key is required for that path.

## Output contract

The assistant must return kind, recommendation, reason and limitation. A schema and server-side validator reject malformed output, extra keys, selected fabricated numerical AQI claims and selected dangerous reassurance patterns. The displayed source and timestamp are built from server-fetched evidence, not model-generated citations. These checks do not prove the prose is clinically or factually correct.

## Evidence

Run npm test for deterministic regression cases, including 100 contract and multilingual safety cases. Browser tests use explicit provider fixtures. A live model assessment is separate: test five languages, prompt injection, high pollution, time-zone wording and provider failures with real configured credentials; report failures and never fabricate results.

## Remaining infrastructure

Shared Redis rate limiting is optional and needs server-side environment variables. Optional daily background push is implemented but requires Redis and opted-in subscriptions. In-app alerts remain available independently. Official CPCB AQI is not claimed: the displayed Indian-scale value is a partial atmospheric model estimate.

## Answer correctness hardening

Provider fallback now distinguishes recognized air-quality guidance from unsupported requests (including dosage and diagnosis), explicitly stating the limitation in each of the five supported languages. Response validation checks common localized AQI labels, decimal and number-before-AQI claims, current-versus-window AQI, PM2.5 claims even without units, and nonempty off-topic payloads. These checks are deliberately bounded, not comprehensive semantic or clinical validation. A provider quota failure remains an external blocker to live-model verification; never label fallback as Gemini.
