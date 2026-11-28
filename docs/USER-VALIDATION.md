# Volunteer usability validation protocol

Recruit at least five consenting adults independently of the development team. Participation is voluntary. Do not collect names, medical records, precise location, or contact details. Use a public test city. Each participant opens the real deployed site on their own browser.

## Tasks
1. Locate current city AQI and distinguish model data from ground measurements.
2. Choose a profile category without disclosing personal medical information.
3. Optimize two flexible activities, save the result and export the plan.
4. Ask one air-quality question and identify the answer source and limitation.
5. Optionally enable background alerts and send a test; only confirm receipt if actually observed. Disable afterward if desired.
6. Open Reports and submit one voluntary usability response; export it if willing to share.

Record actual task completion, time and obstacles with consent. Exported responses remain local unless participants explicitly share them. Report the participant count and raw counts; do not generalize a small convenience sample. Do not infer clinical benefit from task success or a forecast concentration-time proxy.

## Status
No independent participants have been evaluated yet. Automated browser checks use synthetic inputs and are not real-user feedback. No physical notification receipt is claimed until confirmed by a participant.

### Notification validation boundary
The automated production-browser suite exercises the deployed service worker with a Chromium-simulated push, checks the browser notification object and receipt prompt, and closes the test notification without clicking human confirmation. For end-to-end transport, a consenting user on a physical device must enable background alerts, permit notifications, send a test and confirm only after seeing it. Record browser/OS, result and date; unsubscribe after testing if desired.

The notification settings panel now provides a local self-reported delivery receipt export. After actually seeing a test notification, the participant may click I received it, then Export delivery result. The export contains a timestamp and confirmation method only (no endpoint, token, location or device identifiers). The automated test intentionally does not create this receipt. Participants can clear it locally. A receipt is self-report, not independent transport validation.

### Aggregate results without personal information

Ask each consenting participant to clear previous feedback on their own device, complete the tasks, save exactly one response and voluntarily export it. Keep the exports outside the public repository. Run `node scripts/usability-summary.js path/to/participant-*.json` to produce anonymous counts and mean ease rating. The script rejects multiple responses in one file, duplicate file paths and unexpected response fields. It cannot establish whether different files actually represent different people; the study organizer must establish that independently. An empty study produces no average and does not meet the five-person minimum.

### Assistant comprehension task

Ask each participant to select a quick question and then type a different air-quality question. Have them identify which response used fixed rules and which used Gemini or fallback. Ask whether the limitation and observation time were understood. Record the actual outcome, not an inferred completion. Share only anonymous outcomes with the organizer. No recruitment or independent participant response has been completed by automated tests.

Optional expanded tasks: change the purifier CADR and explain why the indoor result is a scenario rather than a measurement; compare two travel choices using supplied test factors and explain the trade-off; find the robust family window and identify its worst-scenario caveat. Record actual comprehension and completion only.
