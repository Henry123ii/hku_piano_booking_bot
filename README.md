# HKU Piano Companion

**An unofficial Microsoft Edge extension for HKU music-room reservations.**

Want to secure your booking before anyone else? This is the slot snatcher! Plan a room session in a simple interface, use your existing HKU SSO login, prepare the reservation form ahead of a release time, and check the portal's actual booking response. The extension keeps a visible progress log and prompts you if a reCAPTCHA challenge requires manual attention.

> **Status:** Personal project / experimental v1.0.0. Automated tests have passed in simulated browsers, but authenticated HKU pages and live reservations have **not** been independently verified. Rehearse before depending on it. **Not affiliated with or endorsed by HKU.**

![HKU Piano Companion home screen](docs/screenshots/home.png)

## Features

- **Portal login** — signs in using HKU's normal SSO and 2FA within Edge; no separate cookie-export script.
- **Reservation interface** — room, date, start/end time, and participant count.
- **Live calendar integration** — open HKU's calendar, read recognized reservation links, or import an opened HKU reservation form; times that cannot be verified are **not** labeled available.
- **Scheduled submission** — configure early form opening and a requested delay after the release time (Hong Kong time).
- **CAPTCHA assistance** — requests one checkbox click, shows a warning for challenges, and waits for **manual** challenge completion. No image/audio solving or server-side CAPTCHA bypass.
- **Result display** — shows available success/error messages and observed same-origin POST responses; never equates a click or HTTP 200 with a confirmed booking.
- **Safety controls** — rehearsal mode is enabled by default; one Create attempt per run; no automatic retries.

![Reservation configuration screen with *test* values](docs/screenshots/reservation.png)

## Requirements

- Microsoft Edge desktop (Chromium-based, recent version; manifest specifies Chromium 120+).
- A valid HKU account authorized to use the rooms and a working HKUFBS login.
- Permission to install unpacked extensions in your Edge profile.
- An awake computer, and the companion and HKU booking tabs kept open while scheduling.

**No Python, Playwright, Node.js, or `auth.json` is required to use the extension.** Node/Python are only for optional developer tests.

## Install (Microsoft Edge)

1. Download this repository using **Code > Download ZIP**, then **extract** it into a permanent folder. Do not load the ZIP itself.
2. In Edge, enter `edge://extensions` in the address bar.
3. Turn **Developer mode** on.
4. Click **Load unpacked** and select the *extracted folder containing `manifest.json`*.
5. Open **HKU Piano Companion** from the Edge **Extensions** (puzzle-piece) menu. Pin it if you prefer.
6. You should see a companion window with **Portal login** and **Reservation**.

Do not move or delete the source folder after installation. To update after editing code, visit `edge://extensions`, click **Reload** on the extension, and reopen the companion.

## First use: a safe rehearsal

1. Click **Portal login**. Complete HKU SSO and 2FA in the HKU tab.
2. Click **Reservation**, select a music room and a future booking date/time, and enter your UID and contact number.
3. Open the **live HKU calendar** to check which slots the portal currently offers. If link extraction does not work, open a slot directly in the HKU calendar, then use **Use selected HKU slot**.
4. Set the run mode to **Prepare now** and **keep `Rehearsal only` checked**.
5. Check the agreement after reading the room rules. Click **Review reservation**, then **Confirm rehearsal**.
6. Watch the progress log and respond to any manual CAPTCHA prompt. Confirm the form is filled correctly. **Rehearsal never clicks Create.**

If this fails, don't try live mode until the cause is understood; HKU can change its form markup or login flow.

## Make a scheduled reservation

1. Select the room and session, and enter your booking details.
2. Choose **Scheduled release** and provide the **release date and time**, which is different from the **room booking date and time**.
3. Set the early-open and final-submit timing. All timestamps are **Hong Kong time (UTC+8)**.
4. Uncheck **Rehearsal only** only when you intend to send one real reservation request.
5. Review and confirm. Leave Edge and the companion window open and keep the computer awake.
6. If Google displays a CAPTCHA challenge, solve it in the HKU tab. The companion waits and reports whether the required verification field is present.
7. At the chosen time, the extension attempts **one** Create click. Read the resulting HKU message and verify the reservation in HKU's **My Reservations** before assuming it succeeded.

### Scheduling settings

| Setting | Default | Meaning |
| --- | ---: | --- |
| Open form early | 30 seconds | Start preparing the form before release |
| Create after release | 0.20 seconds | Requested delay between release and Create click |
| Click CAPTCHA before release | 10 seconds | Target for the single checkbox attempt |
| Late CAPTCHA allowance | 120 seconds | Maximum delay allowed if verification finishes late |

The extension does **not** independently know HKU's official release schedule; its displayed default came from the original personal script. It also cannot guarantee that the portal allows pre-release form access or that the operating system/network will deliver a click at millisecond precision.

## Important limitations

- **Availability:** recognized bookable links can be read; some dynamic calendar implementations must be used manually. An unknown status is not an available slot.
- **CAPTCHA:** a checkbox click does not guarantee verification. A challenge may need manual work; response-token presence does not guarantee acceptance by HKU.
- **Timing:** window throttling, computer sleep, server latency and login/CAPTCHA challenges can delay an attempt.
- **Outcome:** the extension may display *Outcome not confirmed* when it cannot reliably recognize HKU's response. Check the portal yourself; avoid immediately retrying.
- **Compatibility:** HKU can change page selectors or reservation rules without notice. Only mock-browser checks—not an actual HKU reservation—have been completed as part of the current release.

## Permissions and privacy

This project uses browser permissions for `tabs`, `storage`, `scripting`, and `notifications`, plus access to the HKUFBS and reCAPTCHA frame URLs declared in `manifest.json`. They are used for displaying the HKU page, filling a chosen reservation form, capturing a response, and issuing a manual CAPTCHA reminder.

- The extension uses your normal Edge login; it does not request your HKU password or export SSO cookies.
- When **Remember** is selected, the UID and contact number are saved locally in Edge extension storage. You can clear saved details and logs in the interface.
- There is no project-owned backend, analytics service, automatic retry loop, or external CAPTCHA-solving provider.
- **Never commit** real IDs, phone numbers, `auth.json`, saved browser profiles, cookies, or logs/booking confirmations containing personal details. Screenshots in this repository show sample test values only.
- Use only in accordance with your institution's authorization, booking policies, and rate limits. This is not a tool for unauthorized access or bulk reservations.

See [SECURITY.md](SECURITY.md) for reporting and privacy notes.

## Source layout

```text
manifest.json          Chrome/Edge extension configuration
app.html, app.css      User interface
app.js                 Booking workflow and scheduling
shared.js              Validation, date/time, room metadata helpers
background.js          Extension icon/window handling
content.js             HKUFBS page interaction
captcha-frame.js       Checkbox-frame helper; no challenge solver
response-bridge.js     Observes same-origin booking responses
icons/                 Extension icons
docs/screenshots/       Sample interface screenshots
INSTALL.txt            Short plain-text installation guide
TEST_REPORT.md         Test coverage and limitations
tests/                  Optional test sources
PUBLISH_TO_GITHUB.md   Repository publishing instructions (for the maintainer)
```

## Testing (developers)

The available checks were run on 7 November 2026:

- JavaScript syntax validation for shipped JS.
- 18 pure helper tests.
- 11 DOM/browser fixture checks with simulated HKU pages and mocked extension APIs.

Run the pure helper tests with Node.js:

```bash
node tests/test_helpers.cjs
```

The optional DOM fixture tests require Python, `pytest`, and Playwright; see [tests/README.md](tests/README.md). **Neither those tests nor a passing fixture result are proof of live HKU compatibility.** Full limitations: [TEST_REPORT.md](TEST_REPORT.md).

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Extension does not open | Ensure you selected the folder containing `manifest.json`, not the ZIP; check `edge://extensions` for errors |
| Login not recognized | Finish HKU SSO/2FA in the portal tab, then check the login state again |
| No slots appear | Open HKU's live calendar. The extractor may not support its current layout |
| Form won't prepare | Check that your session is still valid and the pre-release form is available |
| CAPTCHA prompt appears | Complete the challenge in HKU's own tab; no challenge solving is provided |
| Create didn't submit | Check progress messages, whether the form was enabled, and CAPTCHA status; do not assume a reservation was made |
| Ambiguous response | Inspect the HKU reservation page and My Reservations before attempting another booking |

## License and attribution

The initial source in this repository is released for review and personal experimentation; **no redistribution license has yet been selected**. If you want others to reuse, modify and distribute the code as open source, add a `LICENSE` file with a license you have chosen (for example MIT or Apache-2.0). Third-party websites, trademarks and booking systems remain their respective owners' property.

---

**Unofficial project. Not endorsed by the University of Hong Kong.**
