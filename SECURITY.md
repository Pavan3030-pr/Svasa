# Security notes
No system is provably unhackable. These are the controls in place and what is out of scope.

**In place**
- Strict CSP: `script-src 'self'` (no inline scripts, so injected script cannot run), `default-src 'none'`, `base-uri 'none'`, `object-src 'none'`, `frame-ancestors 'none'`.
- All API/user text rendered with escaping or `textContent`; inputs sanitised and validated server-side (`validateCtx`).
- Gemini key lives only in a server environment variable or Secret Manager; never sent to the browser.
- `/api/ask`: same-origin check, JSON-only, 4 KB body cap, 20 req/min/IP, 20 concurrent upstream calls, 10 s upstream timeout, header and request timeouts, output length cap.
- Prompt-injection hardening: user text is passed as data, the model is instructed to answer only from supplied air data; emergency phrases bypass the model.
- File allowlist (no path traversal, no source leakage), HSTS, nosniff, no-referrer, COOP/CORP, Permissions-Policy, X-Frame-Options.
- Zero runtime dependencies, so no supply-chain exposure from npm packages. Runs as non-root in Docker.

**Out of scope / recommended for production**
- Put Cloud Armor or a WAF in front for DDoS protection; the in-memory rate limiter is per instance.
- Enable HTTPS only (Cloud Run does), rotate the key, set budget alerts, and monitor logs.
- Commission a third-party penetration test before handling real users at scale.
