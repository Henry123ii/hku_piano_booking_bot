# Security and responsible disclosure

This project is an experimental, locally running browser extension. It has not received an independent security audit.

## Protect personal information

Do not post session cookies, HKU login credentials, verification tokens, booking confirmations, your student UID or phone number to GitHub issues or commits. Redact identifying information from screenshots and logs. **Do not attach a live `auth.json` or Edge profile.**

The source repository contains no user-specific authentication file. The extension stores booking details locally only when the Remember option is used and can clear them from the interface.

If you inadvertently publish a real login token or other credential, revoke/rotate it promptly and consult GitHub's sensitive-data-removal guidance; deleting only the latest file does not necessarily remove it from commit history.

## Vulnerability reports

Until a private vulnerability-reporting channel is configured, please avoid publishing exploitable details or credentials in public issues. The repository maintainer can configure GitHub's private vulnerability reporting in repository security settings.

## Responsible use

Only use the extension for your own permitted booking activity, and follow current HKU room policies. It makes one Create attempt and does not perform bulk polling or automated reCAPTCHA challenge solving. Do not attempt to bypass the booking system's login, CAPTCHA, or access restrictions.
