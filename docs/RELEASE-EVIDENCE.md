# Release evidence and quality gates

Baseline: commit ecdd6e4, GitHub Actions run 46015407447 and 46015407135. Production Lighthouse desktop app and both landing audits were 100/100/100/100; mobile app performance was 99, with 100 accessibility, best practices and SEO. The fixture browser scan flagged one serious scrollable-region-focusable violation on #strip. This release adds keyboard focus and fails CI on any WCAG A/AA axe violation in scanned views. Lighthouse gates enforce performance >=90, accessibility 100, best practices and SEO >=95; these are engineering floors, not guaranteed perfect field performance.

The seeded optimizer benchmark evaluated 500 policy/scenario combinations, 488 feasible, and enumerated 23,470 candidates. Of 238 comparable exposure-priority scenarios, 144 improved the concentration-time proxy. This is synthetic algorithm validation, not a clinical outcome or user study.

The strict five-language live AI workflow runs when assistant verification changes; provider fallback is explicitly not a strict pass. Test results and artifacts are tied to the commit under test. Live provider availability and native-language semantic quality are separate from schema validation.

Genuine usability validation remains external: invite consenting participants to plan two activities, explain the comparison, save/reopen, and report completion; record only voluntary anonymous feedback using the app's existing local export. No fabricated participant evidence.

## Live evaluation cooldown remediation

Run 46016230173 on e774ed8 returned HTTP 200 and valid evidence for all five languages, but four responses used provider_rate_limit fallback. Only Bengali returned live Gemini; the strict run correctly failed. Strict requests now wait 70 seconds before each language and retry only explicit provider-rate-limit fallback after 75 and 130 seconds, at most three attempts per language. Regular smoke checks retain their original pace. Strict runs remain failing if any language lacks live output; external provider quotas are not bypassed. The pacing behavior is covered by deterministic tests.

## Stable release verification

Production capacity run 46018202782 observed the previous deployment SHA during rollout after a single matching health response. Production workflows now require three consecutive matching health responses before checking and again after the browser/audit/smoke journey. The capacity test still requires the exact SHA on each health request. Screenshot publication waits for triggered production workflows to finish and skips non-UI changes, preventing the automated documentation commit from advancing the deployment mid-check. Mixed-build and stale-build cases have deterministic tests; no test threshold was relaxed.

## Landing performance stability

Local audit 46018904831 recorded mobile landing performance 89 (442 ms total blocking time), while the other three configurations scored 99–100 performance and all accessibility, best practices and SEO scores were 100. The landing live previews now defer nonessential work to visibility and idle time, with a bounded timeout. Both audit workflows collect exactly three predetermined mobile landing traces and evaluate their median against the existing 90 performance threshold; all samples are retained, an individual score below 85 fails, and every sample must meet the unchanged non-performance thresholds. This is a disclosed measurement protocol, not a claim that every run scores 90 or above. Invalid traces are retried as before; valid scores are never selectively retried or discarded.

Assistant verification has been extended with localized numerical and unsupported-question regression cases. The earlier strict live check 46016780373 exhausted bounded retries with provider_rate_limit in all five languages; fallback output was verified, but live Gemini was not. Correctness cannot be guaranteed by schema checks alone.

## Provider overload and station freshness

Added per-instance upstream admission controls with request coalescing, no unbounded waiting queue, capacity rejection and recovery. Station lookup is bounded by a shared deadline, respects 429 cooldown and prefers the nearest fresh comparable station among the inspected candidates. Synthetic concurrency tests exercise duplicate callers, distinct overload, and provider rate limits; they do not establish public production throughput or long-term forecast accuracy.

## Quick-answer reliability

Added explicit verified mode for six allowlisted questions in all five languages, with fresh server-side context and no model call. Typed questions retain live AI verification. The prior local Lighthouse run 46029459933 failed because one mobile landing sample scored 83 (692 ms total blocking time); the other two scored 100. The trace attributes most long-task duration to unattributable browser work. No quality gate was lowered. Recheck on the new release before claiming a pass.

## Landing performance consistency

Local audit 46030140328 scored 84/100 on one mobile landing sample, with total blocking time 614.5 ms and benchmark index 2113 (other mobile landing traces: 100/100, 0 ms blocking, benchmark indices 2518.5 and 2525.5). Long tasks include browser-unattributed work, document rendering and landing script work; runner contention is plausible, not proven. Landing preview network and visual commits are separated by idle scheduling, and the below-fold ticker is no longer mutated by the hero update. Removed eager upstream preconnect. All existing live values, viewport activation, error states and quality thresholds are preserved. New audits must pass before claiming consistency.

## Indoor, sustainable travel and family fairness

New decision labs add an analytic room mass-balance model, user-factor transport comparison, and robust shared family window. Deterministic tests check steady state, filtration and source monotonicity, missing data, emissions arithmetic, partial-hour integration, Pareto trade-offs and family constraints. Browser tests exercise input edits, computed output, mobile overflow and accessibility. None of these tests substitutes for indoor measurements, calibrated local transport factors, independent clinical validation or consenting participants. Release verification must complete before declaring these checks passed.

## First-use usability review

Production Chromium run 46097129541 passed all 21 journeys on 5dd5b0a. Reviewed actual rendered screenshots from the fixture browser artifact 15244056175: numeric fields had browser-default compact targets and new decision labs were buried below the long planner. Added direct workspace navigation, accessible numeric fields, explanatory room-input hints and an explicitly illustrative travel example. New browser checks exercise shortcuts and example calculations. This is developer/automated usability review, not an independent participant study. Live free-text Gemini fell back to rules; simulated push display is not physical-device receipt.

## Factual answers and first-use improvements

Exact current AQI/PM2.5 questions in five languages now return verified server data without a model call, with explicit missing-data behavior. Unknown or compound questions still use the original AI/fallback contract. Reports render on entry rather than during dashboard startup; family deletion now checks local persistence before changing the UI. Added a voluntary first-use task guide and tests. The previous local Lighthouse audit 46099645392 had an individual mobile landing sample of 84 with 622.5 ms total blocking time; production audit passed. No performance thresholds changed. New evidence is required to establish improvement. Independent participant and clinical validation remain outstanding.

## Provider integrity and bounded capacity expansion

Added model-response coordinate, UTC offset, timestamp, particle-unit and forecast-sequence checks plus station ID/unit validation and stale candidate recovery. Expanded the real read-only production probe to 60 requests (six concurrent), with a 5-second p95 ceiling. These are implementation and test changes; wait for the corresponding release evidence before claiming success. No independent clinical, penetration or user-study result is inferred.

## Independent station observation

Added actual station/model comparison workflow using three fixed public cities and the public station endpoint. It records matched concentration values, time separation, grid distance, skipped coverage and signed/absolute differences. Fixture tests reject mismatched units, stale/future readings, duplicate times and unavailable data. The first live workflow must run before reporting real values. This is not clinical validation or a calibrated forecast error estimate.

The independent observation run 46101582501 matched three public cities; station versus model PM2.5 mean absolute difference was 36.17 µg/m³, with unknown station averaging intervals. Evidence-aware guidance now checks temporal alignment and carries an explicit caution across user decisions. New fixture tests exercise agreement, disagreement, stale readings, nonaligned readings and local UTC offsets. These checks do not establish calibrated forecast accuracy or clinical benefit.

## Release checks versus live-provider qualification

Prior strict run 46104678988 attempt 2 failed under shared cooldown; the previous attempt reported a daily quota limit. Persisted bounded cooldown diagnostics now survive cross-instance requests. Standard production checks now require ten multilingual verified guidance/factual requests in addition to the existing fallback/live smoke and security checks. The separately named strict live workflow is on demand, still fails if any language lacks a validated real Gemini response, and is not a release-pass claim. Historical failures are preserved.
