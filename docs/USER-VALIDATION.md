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
