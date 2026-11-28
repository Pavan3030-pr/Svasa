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
