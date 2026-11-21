# Svasa – Urban Air Quality Assistant · PRD

## 1. Problem
Residents of polluted cities see an AQI number but not what to do. Generic apps ignore health context and hide the best time to go out.

## 2. Research summary
- Open-Meteo Air Quality API (free, no key, CAMS model) exposes `us_aqi`, per-pollutant AQIs, PM2.5, PM10, NO₂, O₃, SO₂, CO, hourly 5-day forecast. Open-Meteo Geocoding API resolves city names.
- Winning hackathon pattern for assistant challenges: one clear core loop (input → data → grounded advice), graceful failure, accessibility, and a visible "wow" insight. Svasa's insight is the cleanest 2-hour window plus profile-adjusted advice.
- WHO 2021 24-hour guidelines used for pollutant comparison (PM2.5 15, PM10 45, NO₂ 25, O₃ 100 µg/m³).

## 3. Users
Parents, asthma/heart patients, older adults, runners, commuters.

## 4. Core features (MVP)
1. City search with autocomplete + "Near me" geolocation.
2. Live US AQI, category, dominant pollutant.
3. Health-profile chips that shift severity one band for sensitive groups.
4. Action cards: going out, exercise, mask, windows, purifier, symptom warning.
5. 24-hour AQI chart with the cleanest 2-hour window highlighted.
6. Pollutant breakdown vs WHO guideline.
7. "Ask Svasa" grounded Q&A (rule-based, no hallucination).
8. Copy-summary share, auto-refresh every 15 min, remembered location/profile.

## 5. Non-functional
- Light theme, WCAG AA contrast, keyboard operable, ARIA live regions, reduced motion.
- No keys, no backend, single static deploy. All user input sanitised and HTML-escaped.
- Offline/API failure: explicit message + sample data fallback.
- Responsive to 360px.

## 6. Architecture
`core.js` pure logic (UMD, unit-tested in Node) → `index.html` UI/network. Zero dependencies.

## 7. Success metrics
Time to first advice < 3 s; 100% of pure-logic tests pass; no console errors; Lighthouse a11y ≥ 95.

## 8. Risks
Model estimates differ from ground monitors (disclosed in footer); medical advice (disclaimer; symptom escalation text).

## 9. Roadmap
Gemini-powered free-text answers grounded on the same context; PWA push alerts; multi-city compare.
