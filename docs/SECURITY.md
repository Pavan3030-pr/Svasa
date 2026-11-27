# Security and operational limits

SVASA is a health-adjacent decision aid, not a medical device or clinically validated service.

## Implemented controls
- Server-side validation, JSON body size limit, same-origin checks, per-IP rate limiting with atomic Redis counters when configured, bounded upstream concurrency and timeouts.
- Gemini uses independently fetched, fresh model data and a structured response contract. Emergency phrases bypass AI; unsupported output and provider failures fall back to limited, labelled guidance only with verified evidence.
- Strict CSP with exact style hashes, no arbitrary inline scripts, frame denial, HSTS, nosniff, referrer and permissions policies. Secrets are server-side only.
- Push endpoint host allowlist, ownership token hashes, bounded subscription capacity, 30-day expiry, authenticated daily dispatch, deduplication and test cooldown.
- Family profiles, reports and optional feedback are local to the device. The assistant sends selected profile, coordinates, question and bounded conversation context to the server and model provider. Avoid submitting sensitive medical information.
- The runtime has one direct npm dependency (web-push), not zero dependencies. Supply-chain exposure remains possible; the committed npm lockfile pins transitive versions and integrity hashes. CI installs from the lock and runs a runtime dependency audit.

## Remaining limitations
The per-instance AI cache and cooldown are not a distributed quota guarantee. Notification delivery, accessibility across assistive technologies, clinical and translation accuracy, large-scale load and penetration testing require independent verification. Do not infer safety or clinical outcomes from modelled AQI or a forecast exposure proxy. Rotate credentials and monitor provider quotas before expansion.

Shared Gemini budget: 300 outbound attempts per UTC day by default (`GEMINI_DAILY_LIMIT`, configurable 1–10000). Atomic Redis reservation counts model retries and fails closed to labelled guidance if unavailable or exhausted. Without Redis it is per process. This is not a billing guarantee; public endpoints can still be abused to exhaust the budget. CI scans current tracked text for known credential patterns without printing values, not full history. Origin and JSON media type checks reject cross-site browser requests; credential-bearing Gemini and budget requests reject redirects. Independent penetration testing remains outstanding.

Additional hardening: credential-bearing OpenAQ and Redis requests reject redirects, as do server-side model-data requests. The local fallback limiter uses bounded fixed-window counters, denies new keys while saturated, and reclaims expired counters rather than resetting active limits. This reduces memory and rate-limit bypass risk; it is not a substitute for a distributed production limit or independent penetration testing.
