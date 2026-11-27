# Personal Air Intelligence

Parallel Futures compares preferred and optimized outdoor activity schedules using concentration × hours. Invalid or overlapping baselines are not compared. Fixed activities are preserved by the existing optimizer.

Adaptive Day stores absolute city-local times for the current browser session and recalculates on a fresh forecast. A change is a proposal; the user reviews it before accepting. Saving a projected schedule opts into restoring one city/profile-specific adaptive plan for up to 48 hours on this browser. The user can forget it. No automatic rescheduling, background computation, or server persistence.

AirTrust excludes stale/unknown-age or distant stations and flags substantial discrepancies (absolute ≥15 µg/m³ AND relative ≥40% of the larger reading). This heuristic is not calibrated confidence; model and station may represent different averaging periods and locations.

Family Protection ranks shared one-hour forecast windows by number of profiles needing caution, then PM2.5 and AQI. It does not solve separate calendars.

Impact Ledger records local self-reported completion of saved projected schedules. It does not sum overlapping plans or claim actual exposure prevented. Export remains opt-in.

Additional AI checks reject explicit unsupported PM2.5 and clock-time claims, some unsafe English recommendations and safety guarantees. They complement the existing structured-response contract, not full semantic or multilingual verification.

Run npm test and browser/production verification before claiming deployment readiness. No new provider or credential is required.
