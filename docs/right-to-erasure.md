# Right-to-Erasure Procedure

_Last updated: 2026-05-12_

This page documents how to request erasure of data Stroma holds about you, what Stroma will erase, and the timeline for completion. It applies only to data Stroma directly stores via its hosted endpoints. Operator-owned data (events the Signal SDK has sent to an operator's warehouse, GA4 property, or beacon endpoint) is governed by the operator's own erasure procedure — Stroma is not a party.

For the broader privacy posture and retention windows, see [`PRIVACY.md`](../PRIVACY.md) and [`data-retention-sla.md`](./data-retention-sla.md).

---

## Scope — what Stroma can erase

Stroma directly stores data only from two of its hosted endpoints:

| Data class | Surface | Erasure pathway |
|---|---|---|
| Intent events with an email | `api.stroma.design/api/v1/intent` | Email-keyed erasure; full row deleted |
| Install events | `api.stroma.design/api/v1/install` | `install_capture_id`-keyed erasure; full row deleted |

Out of scope:

- **Signal performance events** are sent to operator-configured sinks only. Stroma never receives them, so there is nothing for Stroma to erase. Contact your operator (the website / app you visited that captured the event) for their erasure procedure.
- **Cloudflare edge access logs** are governed by Cloudflare's standard log retention. Stroma does not extract additional value from these. Erasure is mechanically not possible on Cloudflare-side logs Stroma does not own.
- **Aggregated rollups** that cannot be reverted to identifiable rows are out of scope by definition — once aggregated, no per-subject erasure operation applies.

---

## How to request erasure

Send an email to **`admin@stroma.design`** with the following:

### For an intent-event row with optional email

Subject: `Erasure request — intent event`

Body must include:

- The email address you provided when engaging the report's closing modal
- Approximate date and time of the request (or "all events for this email")
- A brief statement confirming the request is from the data subject or an authorised representative
- Preferred response channel (email reply is default)

### For an install-event row

Subject: `Erasure request — install event`

Body must include:

- The `install_capture_id` from the CLI's first-run disclosure (visible when telemetry is enabled)
- Approximate date and time of the install
- A brief statement confirming the request is from the data subject or an authorised representative

**Note**: Install events are keyed by an anonymous UUID with no link to identifiable information. Erasure is mechanically applicable but inherently anonymous — Stroma cannot independently verify that a given `install_capture_id` belongs to you. If you cannot supply the `install_capture_id`, we may not be able to identify the row(s) to erase.

---

## Timeline

| Step | Window |
|---|---|
| Receipt acknowledgement | Within 5 business days |
| Primary-storage erasure | Within 30 calendar days of confirmed receipt (aligned with GDPR Article 12 §3) |
| Backup-storage erasure | Within 35 calendar days of confirmed receipt (the next backup-restore cycle rotates the affected partitions) |
| Erasure-completion confirmation | Sent to the requester's response channel on completion of primary-storage erasure |

If a request cannot be completed within the 30-day window (e.g. because additional identity verification is required to disambiguate which rows belong to the requester), Stroma will notify the requester before the 30-day mark with the reason for delay and a revised timeline.

---

## What does NOT get erased

Standard exclusions, consistent with GDPR Article 17 §3:

- **Aggregated, anonymised rollups** that no longer link to the data subject. The originating row is deleted; the contribution to a strictly-aggregated metric remains.
- **Audit-log entries** confirming the erasure request itself, retained for compliance purposes. These do not contain the original event data — only the request metadata (date, requester contact, action taken).
- **Data Stroma is legally required to retain** (e.g. for an active legal proceeding). Stroma will notify the requester if any such requirement applies and identify the specific legal basis.

---

## If your request is refused

Stroma will document refusal grounds with a specific legal or operational basis. The requester may:

1. Request a review of the refusal grounds at `admin@stroma.design`.
2. Lodge a complaint with the relevant data-protection authority (e.g. the Information Regulator in South Africa for POPIA, the supervisory authority in the relevant EU member state for GDPR, the California Privacy Protection Agency for CCPA).

Stroma does not have a current contracted DPO. Operators with stricter requirements driven by their own DPA can request a contracted DPO contact point on a case-by-case basis.

---

## Verification standards

For email-keyed erasure (intent events), Stroma will ask the requester to confirm the request from the email address being erased. This is the minimum identity check that scales without imposing identity-document verification on every requester.

For `install_capture_id`-keyed erasure, Stroma accepts the requester's supplied `install_capture_id` without further verification — the identifier is anonymous and not personally linkable on Stroma's side, so impersonation does not produce a privacy harm (the requester is asking to delete a row no one can be identified from anyway).

---

## Bulk erasure for operators with DPA precedent

Operators whose own DPA includes a "vendor must support bulk erasure" clause can request a bulk-erasure pathway on a case-by-case basis. Contact `admin@stroma.design` with the relevant DPA section and the scope of erasure (e.g. all intent events submitted from your domain over a specific window).

---

## Contact

All erasure requests, and any questions about this procedure: **`admin@stroma.design`**
