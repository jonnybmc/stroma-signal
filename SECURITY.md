# Security Policy

_Last updated: 2026-05-12_

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Signal, please report it responsibly.

**Do not open a public issue.**

Instead, email **admin@stroma.design** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Your preferred response channel and any PGP-public-key preferences

Stroma will acknowledge receipt within **48 hours** and aim to provide a fix or mitigation plan within **7 days**.

## Scope

This package runs in the browser and collects performance data. By design it does not handle authentication, PII, or sensitive user data. The optional Stroma-hosted endpoints (`/api/v1/intent`, `/api/v1/install`) accept narrow event payloads documented in [`PRIVACY.md`](./PRIVACY.md).

In-scope security concerns include but are not limited to:

- XSS vectors in report URL encoding/decoding
- Data exfiltration through sink misconfiguration
- Supply-chain integrity of published artifacts on npm
- Authentication or rate-limit bypass on the Stroma-hosted endpoints
- Boundary leaks where the public SDK pulls private code (enforced by `scripts/check-boundaries.mjs`; report any case where the guard is bypassable)
- CSRF / CORS misconfiguration on the Stroma-hosted endpoints
- CSP / Referrer-Policy weaknesses on the hosted report

Out of scope:

- Vulnerabilities in operator-configured sinks or warehouses (operator-controlled).
- Vulnerabilities in upstream dependencies that have been disclosed by their maintainers and are tracked in our own dependency-update queue (rerouting through that queue rather than direct report saves time on both sides).

## Breach notification SLA

In the event of a confirmed security incident that materially affects data Stroma directly stores (intent events, install events, or backup snapshots of either):

| Step | Window |
|---|---|
| Initial internal acknowledgement of incident | Immediate |
| Confirmation of incident materiality (breach vs near-miss vs false-alarm) | Within 24 hours of detection |
| Notification to materially-affected operators | Within **72 hours** of confirmation (aligned with [GDPR Article 33](https://gdpr-info.eu/art-33-gdpr/) timing) |
| Public incident disclosure (post-mortem) | Within 30 days of remediation, posted to the project [CHANGELOG.md](./CHANGELOG.md) and a dated incident page in this repository |
| Affected operator's own downstream notifications | Operator's responsibility, governed by their own DPA timing |

For operators whose own DPA includes a stricter notification window, Stroma will honour the contracted window when it is shorter than 72 hours, subject to verification feasibility (a "0-hour" or "1-hour" SLA from confirmation requires automated alerting that this stage of Stroma's infrastructure does not yet provide; that contractual obligation may be subject to a "as soon as practicable but no later than X" formulation in the operator's DPA).

## Audit logging

The Stroma-hosted endpoints maintain audit logs covering:

- Authentication events for any administrative access (rate-limit dashboard, Bearer-token-gated stats endpoint per [`api.stroma.design/api/v1/intent/stats`](./CHANGELOG.md))
- Configuration changes to rate-limit policy, retention SLAs, and CORS / CSP rules
- Deletion operations including erasure-request fulfilment per [`right-to-erasure.md`](./docs/right-to-erasure.md)
- Sub-processor list changes (per [`docs/sub-processors.md`](./docs/sub-processors.md))

Audit logs themselves are retained per the schedule in [`docs/data-retention-sla.md`](./docs/data-retention-sla.md). On request to `admin@stroma.design`, Stroma can provide an extract of audit-log entries pertaining to a specific operator's data (e.g. all erasure requests fulfilled for that operator's domain) within 14 calendar days.

## Coordinated disclosure

For vulnerabilities reported via the channel above, Stroma will:

1. Coordinate a disclosure timeline with the reporter — default 90 days from receipt to public disclosure, shorter if the vulnerability is being actively exploited.
2. Credit the reporter in the disclosure unless the reporter requests anonymity.
3. Not pursue legal action against good-faith security researchers who follow this coordinated-disclosure process.

## Out-of-band channels

For incidents requiring rapid escalation (active exploitation of a vulnerability), email `admin@stroma.design` with `URGENT` in the subject line. The maintainer monitors this address; expected first-response time is under 4 hours during business hours (UTC+2) and under 12 hours outside business hours.

## Contact

All security disclosures and audit-log requests: **`admin@stroma.design`**

For general privacy / DPA / sub-processor questions, see [`PRIVACY.md`](./PRIVACY.md) and [`docs/sub-processors.md`](./docs/sub-processors.md).
