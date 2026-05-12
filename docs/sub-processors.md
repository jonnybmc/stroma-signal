# Sub-processors

_Last updated: 2026-05-12_

This page lists the third-party services ("sub-processors") that may process data on behalf of Stroma when an operator uses any Stroma-hosted endpoint or surface. It does NOT cover services the operator chooses for their own deployment (e.g. their own Google Analytics property, their own BigQuery warehouse, their own collector endpoint) — those are operator-owned.

Operators relying on this page for procurement should verify each entry against the current deployment via [`admin@stroma.design`](mailto:admin@stroma.design) before contract execution. The list below is the maintainer's best understanding as of the "Last updated" date.

---

## Active sub-processors

### Cloudflare, Inc.

| | |
|---|---|
| Role | Edge CDN, static hosting (Cloudflare Pages), serverless compute (Cloudflare Workers), DNS for `*.stroma.design` |
| Surfaces | `signal.stroma.design/r/` (hosted Tier Report), `api.stroma.design/api/v1/intent` (demand-signal endpoint), `api.stroma.design/api/v1/install` (install-telemetry endpoint) |
| Data processed | URL contents (encoded report payload), POST bodies of intent + install endpoints, request IP (for routing and rate-limiting only — not logged by Stroma), user-agent string (captured server-side on intent endpoint per the [Privacy Policy](../PRIVACY.md#what-stroma-receives-and-when)) |
| Location | Cloudflare's global edge network. Specific point-of-presence depends on the requesting client's geography. |
| Public DPA | <https://www.cloudflare.com/cloudflare-customer-dpa/> |
| Sub-processor list | <https://www.cloudflare.com/gdpr/subprocessors/> |

### GitHub, Inc. (a Microsoft company)

| | |
|---|---|
| Role | Source code hosting for the public repository (`jonnybmc/stroma-signal`) and version control |
| Surfaces | Open-source SDK source, public documentation, issue tracker |
| Data processed | Contributor identities (GitHub usernames + emails as configured on commits), issue contents from operators who choose to file public issues |
| Location | Global (Microsoft data centers) |
| Public DPA | <https://github.com/customer-terms/github-data-protection-agreement> |

### npm, Inc. (a GitHub / Microsoft company)

| | |
|---|---|
| Role | Public package distribution for `@stroma-labs/signal`, `@stroma-labs/signal-contracts`, and other published packages |
| Surfaces | `https://registry.npmjs.org/@stroma-labs/*` |
| Data processed | Package metadata (versions, tarball contents, README). No operator data. |
| Location | Global (CloudFront-fronted) |
| Public DPA | <https://docs.npmjs.com/policies/privacy> |

---

## Possible sub-processors — verify with admin@stroma.design before relying on this section for procurement

The following services are referenced in the project's CHANGELOG or historical architecture decisions but have not been independently confirmed by the maintainer at the "Last updated" date above. **Operators with procurement decisions on the critical path should email admin@stroma.design to confirm the current deployment before relying on these entries.**

### Upstash, Inc. _(verify)_

| | |
|---|---|
| Role | Serverless Redis used for per-IP rate-limiting middleware on the `/api/v1/intent` and `/api/v1/install` endpoints |
| Surfaces | Rate-limit counters, ephemeral. No persisted operator data. |
| Data processed | Per-IP rate-limit counters (Cloudflare-edge-supplied IP, retained only for the rate-limit window) |
| Location | Per Upstash's customer-selected region |
| Public DPA | <https://upstash.com/legal/dpa> |

### Storage backend for `intent_events` and `install_events` _(verify)_

| | |
|---|---|
| Role | Persisted storage for events sent to `/api/v1/intent` and `/api/v1/install` |
| Surfaces | Backend of the snapshot-engine service |
| Data processed | Per the Privacy Policy's "What Stroma receives" section |
| Location | TBD — verify with admin@stroma.design |
| Public DPA | TBD |

> Note: The specific database product behind the snapshot-engine endpoints is not publicly disclosed at this revision. Candidates that appear in historical architecture notes include Cloudflare D1, Cloudflare R2 (object storage), Turso (libSQL), and Upstash Redis. The maintainer will update this entry once the production configuration is confirmed.

---

## Not sub-processors of Stroma

The following services are commonly assumed to be sub-processors but are NOT — they are operator-owned in every deployment:

- **Google Analytics 4 (GA4)** — the operator's own property. Signal events land in the operator's GA4; Stroma does not have access.
- **Google BigQuery** — the operator's own project. The SDK does not write to a Stroma-controlled BigQuery.
- **The operator's collector endpoint** (when using the `beacon` sink) — operator-controlled.
- **Email infrastructure for visitor-provided emails** — operator's responsibility. Stroma does not relay these.

---

## Operator self-managed services that fall outside this page

If an operator uses Signal in conjunction with other Stroma-owned commercial offerings (separate procurement, separate contract), those offerings maintain their own sub-processors list in their respective onboarding materials. This page covers only the public open-source Signal surface.

---

## Change process

Material changes to this list (addition of a new sub-processor, removal of an existing one, geographic move that affects residency) will be:

1. Committed to this file in the public repository with a clear changelog entry.
2. Announced in the project [`CHANGELOG.md`](../CHANGELOG.md).
3. For changes with material impact on existing operators (new sub-processor in a different jurisdiction), surfaced in the next SDK release notes.

Operators may subscribe to changes on this file by [watching it on GitHub](https://github.com/jonnybmc/stroma-signal/blob/main/docs/sub-processors.md).

Quarterly review cadence: this page is reviewed at the start of each calendar quarter regardless of any change. The "Last updated" date at the top reflects the most recent review or revision.

---

## Contact

Questions about this list, or to confirm an entry before contract execution:

**admin@stroma.design**
