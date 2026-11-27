# Release evidence and quality gates

Baseline: commit ecdd6e4, GitHub Actions run 46015407447 and 46015407135. Production Lighthouse desktop app and both landing audits were 100/100/100/100; mobile app performance was 99, with 100 accessibility, best practices and SEO. The fixture browser scan flagged one serious scrollable-region-focusable violation on #strip. This release adds keyboard focus and fails CI on any WCAG A/AA axe violation in scanned views. Lighthouse gates enforce performance >=90, accessibility 100, best practices and SEO >=95; these are engineering floors, not guaranteed perfect field performance.

The seeded optimizer benchmark evaluated 500 policy/scenario combinations, 488 feasible, and enumerated 23,470 candidates. Of 238 comparable exposure-priority scenarios, 144 improved the concentration-time proxy. This is synthetic algorithm validation, not a clinical outcome or user study.

The strict five-language live AI workflow runs when assistant verification changes; provider fallback is explicitly not a strict pass. Test results and artifacts are tied to the commit under test. Live provider availability and native-language semantic quality are separate from schema validation.

Genuine usability validation remains external: invite consenting participants to plan two activities, explain the comparison, save/reopen, and report completion; record only voluntary anonymous feedback using the app's existing local export. No fabricated participant evidence.

## Live evaluation cooldown remediation

Run 46016230173 on e774ed8 returned HTTP 200 and valid evidence for all five languages, but four responses used provider_rate_limit fallback. Only Bengali returned live Gemini; the strict run correctly failed. Strict requests now wait 70 seconds before each language and retry only explicit provider-rate-limit fallback after 75 and 130 seconds, at most three attempts per language. Regular smoke checks retain their original pace. Strict runs remain failing if any language lacks live output; external provider quotas are not bypassed. The pacing behavior is covered by deterministic tests.

## Stable release verification

Production capacity run 46018202782 observed the previous deployment SHA during rollout after a single matching health response. Production workflows now require three consecutive matching health responses before checking and again after the browser/audit/smoke journey. The capacity test still requires the exact SHA on each health request. Screenshot publication waits for triggered production workflows to finish and skips non-UI changes, preventing the automated documentation commit from advancing the deployment mid-check. Mixed-build and stale-build cases have deterministic tests; no test threshold was relaxed.
