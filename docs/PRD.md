# SVASA 4 — Product requirements and implemented scope

## Problem and user journey
Air quality numbers alone do not tell residents when to commute, exercise or take precautions. SVASA uses current modelled air quality, health-profile preferences and forecasts to suggest practical decisions. It is a general-information tool, not a diagnostic service.

## Implemented product
- Public landing page, city search and optional geolocation; current modelled US AQI, pollutant concentrations, nearby ground-station observations, partial India-scale model estimate and correctly labelled averaging periods.
- Profile-aware guidance, 24-hour forecast and seven-day history, commute planner, multi-activity optimization with concentration-time proxy, family profiles and city comparison.
- Five-language Gemini assistant grounded in independently verified model data, emergency bypass and deterministic topic-specific fallback during model failures. No clinical or native-speaker review is claimed.
- PWA with offline snapshot and disabled stale planning, breathing guide, local alerts and optional daily background Web Push; local saved plans and voluntary feedback export.

## Architecture
Static responsive HTML/CSS/JS on Vercel; shared pure logic in core.js; thin API handlers with Node backend, Open-Meteo/CAMS, OpenAQ, Gemini and optional Upstash Redis. Local server and container use the same route handlers. CSS and landing bundle are generated and checked in CI.

## Acceptance evidence
Automated unit, mocked integration, real deployed Chromium and Lighthouse workflows provide timestamped evidence. Target 100 performance/accessibility/best practices/SEO on desktop/mobile; scores vary with environment. Physical-device push delivery, real-user validation, translation review and clinical review are separate requirements. A bounded capacity sample is not a stress test.
