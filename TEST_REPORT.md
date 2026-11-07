# Validation report - HKU Piano Companion 1.0.0

Validation performed on 7 November 2026. No real HKU reservation was attempted.

## What passed

- JavaScript syntax validation for every shipped JavaScript file using Node.js.
- Manifest structure, permission review, and existence checks for referenced assets.
- 18 pure helper tests: Hong Kong time, date/time validation, URL construction/import, input validation, scheduling arithmetic, and conservative response classification.
- 11 Chromium DOM/application checks with mocked extension/navigation/network interfaces:

1. rehearsal fills exact fields and sends zero reservation POSTs
2. one Create, exact visible/raw response, old announcement excluded
3. duplicate submission message does not send a second Create
4. HTTP 200 conflict is reported as rejection with exact message
5. manual CAPTCHA requests notification, blocks Create, resumes after verification
6. expired session waits for manual login before opening reservation
7. calendar reads only room/date-matched, non-reserved slot links
8. expired CAPTCHA detected; scheduled submission not early (10ms after target in fixture)
9. disabled Create reports explicit error and sends no POST
10. cancel prevents a later click even after CAPTCHA is solved
11. no JavaScript page errors observed in tested UI flow

The timing observation above is from an inert test fixture. It is not a live timing guarantee or a network-latency benchmark.

## Test boundaries

The development browser is managed and blocks unpacked-extension installation and URL navigation. No policy was bypassed. Browser checks loaded the actual app and content-script source into inert about:blank DOM fixtures, with chrome.* APIs, tab navigation, and network responses simulated. All real test network requests were blocked.

Actual Edge installation, permission grants, notifications, window focus, isolated-world integration, authenticated HKU page structure, current room availability, and a real reservation response remain unverified. These limits apply even though the tested application logic passed.

## Required first local smoke test

Install the extension in Edge, complete Portal login, choose a future room slot, select Prepare now, leave Rehearsal only enabled, and confirm the rehearsal. Verify the live form fields and CAPTCHA reminder. Create must not be clicked. Only after this local check should you authorize a live attempt.

## Reproducibility

The optional tests directory contains helper and DOM fixture tests. See tests/README.md. No production extension file contains the mocked Chrome APIs used by the tests.
