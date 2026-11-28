# Personal Air Intelligence

Parallel Futures compares preferred and optimized outdoor activity schedules using concentration × hours. Invalid or overlapping baselines are not compared. Fixed activities are preserved by the existing optimizer.

Adaptive Day stores absolute city-local times for the current browser session and recalculates on a fresh forecast. A change is a proposal; the user reviews it before accepting. Saving a projected schedule opts into restoring one city/profile-specific adaptive plan for up to 48 hours on this browser. The user can forget it. No automatic rescheduling, background computation, or server persistence.

AirTrust excludes stale/unknown-age or distant stations and flags substantial discrepancies (absolute ≥15 µg/m³ AND relative ≥40% of the larger reading). This heuristic is not calibrated confidence; model and station may represent different averaging periods and locations.

Family Protection ranks shared one-hour forecast windows by number of profiles needing caution, then PM2.5 and AQI. It does not solve separate calendars.

Impact Ledger records local self-reported completion of saved projected schedules. It does not sum overlapping plans or claim actual exposure prevented. Export remains opt-in.

Additional AI checks reject explicit unsupported PM2.5 and clock-time claims, some unsafe English recommendations and safety guarantees. They complement the existing structured-response contract, not full semantic or multilingual verification.

Run npm test and browser/production verification before claiming deployment readiness. No new provider or credential is required.

## Scenario resilience and decision proof

The robust priority enumerates all feasible ordered, non-overlapping schedules (at most four activities, 24 hourly slots). It minimizes worst-case caution count, worst-case aggregate outdoor PM2.5 concentration-time proxy, total shift, then nominal proxy. Scenarios are the nominal forecast, one-hour earlier/later peaks (neighboring complete hourly AQI/PM pairs; nominal at boundaries/gaps), and PM2.5 +25% with nominal AQI. These are deterministic sensitivity scenarios, not calibrated uncertainty bounds, probabilities or health outcomes. The original two priorities remain available. A local decision certificate contains the inputs, objective, chosen indices, scenario totals and count of feasible schedules; the verifier recomputes all possibilities and rejects inconsistent results. It proves optimality only under the stated finite model, not authenticity of the input data. The conflict assistant finds the minimum supported single-activity flexibility increase that restores feasibility, if any; fixed commitments require explicit permission and are never moved silently.

## Indoor air, travel and family fairness decision labs

Indoor air: for a well-mixed room, dC/dt = ACH × P × Cout + E/V − (ACH + k + CADR/V) × C. Source E in µg/h, volume V in m³, penetration P in [0,1], deposition k per hour. Use the exact constant-input solution and hourly mean for six contiguous forecast hours, with no filtration, selected filtration, and selected filtration plus 25% outdoor PM2.5. Starting indoor concentration and all room parameters are editable scenario assumptions, not measurements. Never reduce required ventilation or ignore gases, heat or indoor sources. Method references: https://pmc.ncbi.nlm.nih.gov/articles/PMC8026580/ and https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home .

Travel: kg CO₂e = km × user-supplied g CO₂e/passenger-km ÷ 1000; the user must enter comparable factors and their distances/durations. Integrate ambient hourly PM2.5 over the actual minutes starting at the first forecast hour. Pareto dominance requires no worse emissions, proxy and duration, and at least one strict improvement. No local factor database, route service, vehicle microenvironment or inhaled dose is claimed. Use consistent accounting boundaries (see https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026 for a methodology example, not Indian factors).

Family fairness: enumerate two-hour contiguous windows across the existing four sensitivity scenarios. Minimize highest profile caution level, worst number of profiles needing caution, worst PM2.5 concentration-time proxy, nominal proxy and start index lexicographically. This is shared-time planning, not individual calendars or measured vulnerability. All three modules invalidate results when fresh data is replaced and use no additional upstream API requests.

## Evidence-aware decision guidance

AirTrust now checks station observation time against the model timestamp converted to UTC. Only fresh readings within one hour are eligible for the indicative disagreement heuristic. It recomputes station age from the timestamp, displays time separation and adds a conservative advisory in Today, Planner, Family and Ask for material disagreement or mismatched times. It never overwrites the forecast, changes AQI, applies a station value to future hours, or claims a clinically validated correction. Saved projected plans include the source-comparison state at review, separate from their mathematical certificate.
