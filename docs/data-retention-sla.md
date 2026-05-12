# Data Retention SLAs

_Last updated: 2026-05-12_

This page documents how long Stroma retains data captured via any Stroma-hosted endpoint. Operator-side data (Signal events in the operator's own GA4 property, BigQuery warehouse, or beacon endpoint) is governed by the operator's own retention policy and is outside the scope of this document.

For the broader privacy posture this sits inside, see [`PRIVACY.md`](../PRIVACY.md).

---

## Headline retention windows

| Data class | Surface | Retention window | Notes |
|---|---|---|---|
| Performance events | Signal SDK → operator's sinks | **Not retained by Stroma.** | The SDK never sends performance events to a Stroma-controlled sink. Operator-owned retention applies. |
| Intent events | `api.stroma.design/api/v1/intent` (POST) | **24 months** from event timestamp | Demand-signal aggregates used for product research and capacity planning. |
| Install events | `api.stroma.design/api/v1/install` (POST) | **24 months** from event timestamp | Framework-adoption and CLI-flow analytics. |
| Optional email on intent events | Same as parent intent event | **24 months**, OR until erasure request, whichever is shorter | Erasable on request to `admin@stroma.design`. See [`right-to-erasure.md`](./right-to-erasure.md). |
| Rate-limit counters | Cloudflare-edge + Upstash _(verify)_ | **Sliding window** of the rate-limit duration (e.g. 1 hour for the `/api/v1/intent` POST rate limit) | Ephemeral counters; not personally identifiable in isolation. |
| Cloudflare edge access logs | `signal.stroma.design`, `api.stroma.design` | Per Cloudflare's standard log retention (operator-side configurable; Stroma's plan-tier default at time of writing is ~30 days for raw, longer for aggregated) | Stroma does not extract additional value from these beyond debugging. |
| Aggregated rollups derived from intent / install events | Internal product analytics | **Indefinite** while strictly aggregated (no per-row data, no email) | Aggregates that cannot be reverted to individual rows. |

---

## Why these windows

**24-month** retention on intent and install events reflects the analytics utility of a typical fiscal cycle plus one (year-over-year comparisons, quarterly product roadmap planning). Shorter windows would compromise the product-research signal the endpoints exist to provide; longer windows have diminishing analytics value and increasing risk surface.

**Indefinite** for strictly-aggregated rollups is standard practice — once a dataset cannot be reverted to identifiable rows, the privacy-relevant clock stops. Stroma will publish any change to what is rolled up here in the next version of this document.

---

## Deletion mechanics

Retention is enforced by scheduled jobs on the Stroma backend, not by manual review. Events older than the retention window are deleted from primary storage, and from backups within a 30-day grace window required by the backup system's own restore-point cadence.

For data subject to erasure on request:

- Email `admin@stroma.design` with the relevant identifier (`install_capture_id` for install events; the email address used for intent events).
- Stroma will confirm receipt within 5 business days.
- Erasure completes within 30 calendar days of confirmed receipt (aligned with GDPR Article 12 §3).
- The erasure pathway covers primary storage + backups; the backup-purge step may complete asynchronously up to 35 calendar days after the request as the next backup-restore cycle rotates the affected partitions.

Full procedure: [`right-to-erasure.md`](./right-to-erasure.md).

---

## What is NOT retained

The following data classes are NEVER retained by Stroma:

- Signal performance event payloads (the SDK doesn't send them to Stroma).
- IP addresses on the `/api/v1/intent` and `/api/v1/install` endpoints. Cloudflare's edge processes IPs for routing and rate-limiting but Stroma does not log or persist them in application storage.
- Full user-agent strings from the install endpoint. (The intent endpoint records the user-agent string server-side for product-research purposes as documented in [`PRIVACY.md`](../PRIVACY.md#what-stroma-receives-and-when); that field follows the same 24-month retention as the parent event.)
- Any operator-defined warehouse content (the operator owns that data).

---

## Subject to change with notice

Retention windows are reviewed at the start of each calendar quarter. Material changes — reductions or extensions of more than 25% on any class — will be:

1. Committed to this file with a clear changelog entry.
2. Announced in the project [`CHANGELOG.md`](../CHANGELOG.md).
3. Surfaced in the next SDK release notes for operators whose deployments depend on a specific retention assumption.

Operators with stricter retention requirements driven by their own DPA may request a shorter window for their organisation's data on a case-by-case basis. Contact `admin@stroma.design`.

---

## Contact

Questions about retention, or to request a retention-window adjustment for your organisation: **admin@stroma.design**
