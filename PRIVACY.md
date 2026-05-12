# Privacy Policy

_Last updated: 2026-05-12_

This document describes the privacy posture of Signal — the open-source landing-page telemetry SDK published as `@stroma-labs/signal`, the hosted `/r` Tier Report at `signal.stroma.design/r/`, and the optional Stroma-hosted endpoints the SDK can be configured to talk to.

It is written for two audiences:

- **Operators** integrating Signal into their site, who need to know what their visitors' data does and does not do.
- **Procurement and DPO reviewers** evaluating Signal as a vendor or as a sub-processor of their own analytics stack.

If you find a gap or ambiguity, [open an issue](https://github.com/jonnybmc/stroma-signal/issues) — privacy gaps are bugs.

---

## At a glance

- **Zero PII at the SDK level.** Signal's SDK does not capture, store, or transmit any personally identifiable information. No IP, no user ID, no email, no name, no full user-agent string.
- **No cookies set by Signal.** The SDK does not set any cookies. It does not read cookies set by other parties.
- **No cross-site tracking.** Signal does not correlate sessions across sites or across visits. Each event is independent and anonymous.
- **Operator-owned data.** Performance events go to whatever sink the operator configures (the operator's own GA4 property, beacon endpoint, or warehouse). Stroma does not receive performance event data via the SDK.
- **Two optional Stroma-hosted endpoints.** A demand-signal endpoint (`/api/v1/intent`) and an install telemetry endpoint (`/api/v1/install`). Both are opt-out / opt-in respectively, with explicit disclosure. Detail below.
- **Open source.** The SDK is MIT-licensed. Every byte of capture logic is auditable in the public repository.

---

## What the Signal SDK captures

The SDK fires one `SignalEventV1` per real document navigation (`visibilitychange` to hidden, or `pagehide`). The full schema is documented in [`docs/signal-technical-reference.md`](./docs/signal-technical-reference.md). Captured fields fall into these categories:

| Category | Examples | Notes |
|---|---|---|
| Web Vitals (W3C standard) | `lcp_ms`, `fcp_ms`, `inp_ms`, `cls`, `ttfb_ms` | Standard browser-exposed performance metrics. Vendor-defined and presence-bound (some are Chromium-only). |
| Navigation Timing breakdown | `vitals.navigation_timing.dns_ms`, `tcp_ms`, `tls_ms`, `request_ms`, `response_ms` | Per-subpart timings derived from `PerformanceNavigationTiming`. |
| Connection substrate hints | `net_tier`, `context.effective_type`, `downlink`, `rtt` | Network classifier derived from TCP handshake span. No geolocation, no IP. |
| Device coarse signals | `device.cores`, `device.memory_gb`, `device.screen.*` | Standard `navigator.hardwareConcurrency`, `navigator.deviceMemory`, `window.screen.*`. Coarse-bucketed only. |
| User-agent family bucket | `context.browser` ∈ {`chrome`, `safari`, `firefox`, `edge`, `other`} | Parsed for browser family only. The full UA string is NOT captured. |
| Page context | `host`, `path`, `landing_path` | Hostname and pathname only. Query strings and fragments are NOT captured. |
| Event metadata | `event_id`, `ts`, `v` | Per-event UUID and timestamp. |

When the optional ad-context capture module is enabled (`signal.init({ adContextCapture: true })`), it additionally captures ad-click identifiers (gclid, gbraid, wbraid, fbclid, msclkid, dclid, srsltid) and UTM tags into a separate row keyed by `capture_id`. The full surface is documented in [`docs/ad-context-capture.md`](./docs/ad-context-capture.md). This module is **opt-in only** — disabled by default.

---

## What the Signal SDK does NOT capture

By design, the SDK never collects:

| Field | Status |
|---|---|
| IP address | Never captured client-side. (Cloudflare's edge processes IPs for any Stroma-hosted endpoint solely for routing and rate-limiting; not logged or persisted by Stroma.) |
| Full user-agent string | Never captured. Parsed to family bucket only. |
| Email address | Never captured by the performance SDK. Captured only via the optional `/api/v1/intent` endpoint when the visitor voluntarily types one into the report's closing modal. |
| User identifier / customer ID | Never captured. Signal does not stamp visitor identifiers. |
| Geolocation | Never captured. |
| Cookies (read or write) | None set, none read. |
| Fingerprint hashes | None computed. |
| Document title | Never captured. |
| Page content / text on page | Never captured. |
| Form input contents | Never captured. |
| URL query strings | Never captured by the performance SDK. The optional ad-context module parses known click-ID and UTM keys, then discards the rest. |
| Cross-site session correlation | Never performed. Each event is anonymous and independent. |

This list is exhaustive of what Signal could plausibly capture and does not. If you find a capture site in the source that is not justified by a field on the schema, [report it as a bug](https://github.com/jonnybmc/stroma-signal/issues).

---

## Where the data goes

The SDK's default behavior is to send events to **sinks the operator configures** — never to Stroma. Sinks are:

1. **`dataLayer` sink** (GTM / GA4). Events land in the operator's own GA4 property, then optionally export to the operator's BigQuery via Google's standard export pipeline. Stroma does not receive these events.
2. **`beacon` sink**. Events land at an HTTPS endpoint the operator specifies (their own collector or warehouse-ingest endpoint). Stroma does not receive these events.
3. **`callback` sink**. Events are passed to an in-page function. Used by operators who want to do something custom client-side. Stroma does not receive these events.

The SDK has no Stroma-hosted default sink. An operator who runs Signal with default configuration sends nothing to Stroma.

---

## What Stroma receives (and when)

Stroma operates three endpoints that may receive data, each with a distinct disclosure and consent posture:

### 1. The hosted `/r` Tier Report

`https://signal.stroma.design/r/?…`

The report payload is encoded in the URL query string. When an operator opens or shares a report URL, the recipient's browser fetches the static report bundle from Stroma's CDN. The URL parameters carry the aggregated report content; **the underlying raw events stay in the operator's warehouse**.

Stroma's edge logs (Cloudflare access logs) record the URL — which contains the encoded report. Stroma does not parse, persist, or analyse this URL beyond standard CDN log retention. Operators who consider report URLs sensitive should not share them externally.

### 2. The demand-signal endpoint `/api/v1/intent`

`https://api.stroma.design/api/v1/intent`

When a reader of `/r` opens the closing modal and selects one of the four customer-lens choices, the report's client-side code sends a small intent payload to this endpoint via `sendBeacon`. Stroma receives:

- Event kind (which choice was selected)
- Capture id (per-modal-session UUID generated client-side)
- Optional email (only if the reader voluntarily typed one)
- Optional cadence / pill_id / freeform text (only if relevant to the chosen lens)
- Cloudflare-edge-captured request metadata (user agent string is captured server-side for product-research purposes; IP is used for rate-limiting but not stored)

The endpoint's purpose is to measure demand for downstream offerings without requiring the operator to instrument anything additional. Email is universally optional — capturing intent in aggregate is the primary purpose; email is the affordance for direct follow-up where the reader wants it.

### 3. The install-telemetry endpoint `/api/v1/install`

`https://api.stroma.design/api/v1/install`

When a developer runs `npx @stroma-labs/signal init`, the CLI wizard sends anonymous install telemetry. Stroma receives:

- Framework + framework version (e.g. `next-app-router`, `16.2.4`)
- Sink choice (`dataLayer` / `beacon` / `callback` / `undecided`)
- Sample rate
- Package manager (`npm` / `pnpm` / `yarn` / `bun`)
- Node version (e.g. `v22.4.0`, capped at 16 chars)
- OS family (`darwin` / `linux` / `win32` / `other`)
- CLI version
- Anonymous `install_capture_id` (UPSERT key per CLI invocation)
- Outcome (`completed` / `aborted` / `error`) and a coarse error category if applicable

Stroma does NOT receive: project name, file paths, file contents, free text, emails, hostnames, full user-agent string.

Opt-out is supported via three mechanisms:
- Per-invocation: `npx @stroma-labs/signal init --no-telemetry`
- Persistent environment variable: `STROMA_TELEMETRY=0`
- Industry standard: `DO_NOT_TRACK=1`

The wizard auto-disables silently in CI / non-TTY environments. A first-run disclosure surfaces the telemetry behaviour before any data is sent.

---

## Sub-processors

The full list of sub-processors that touch any Stroma-side endpoint or hosted surface is maintained at [`docs/sub-processors.md`](./docs/sub-processors.md). The list is reviewed on a quarterly cadence and after any architectural change.

Operators may subscribe to sub-processor changes by watching that file on GitHub.

---

## Data retention

Retention windows for Stroma-side stored events are documented at [`docs/data-retention-sla.md`](./docs/data-retention-sla.md). Headline:

- **Performance events** captured by the SDK: not retained by Stroma at any tier. The SDK sends to operator-owned sinks only.
- **Intent events** (`/api/v1/intent`): retained for operational analytics; specific window in the SLA doc.
- **Install events** (`/api/v1/install`): retained for operational analytics; specific window in the SLA doc.
- **Cloudflare edge access logs**: retained per Cloudflare's standard log retention; Stroma does not extract additional value from these.

---

## Right to erasure

The Signal performance SDK does not capture personal data, so no erasure pathway applies to SDK-captured events.

For data captured via the optional Stroma-hosted endpoints:

- **Install events**: capture is keyed by an anonymous UUID (`install_capture_id`) generated at CLI invocation. There is no link to identifiable information. Erasure is mechanically not applicable since there is no identity to erase. If you nonetheless wish to have your install telemetry purged, email **admin@stroma.design** with the `install_capture_id` (visible in the CLI's first-run disclosure when telemetry is enabled).
- **Intent events** with optional email: if a visitor voluntarily provided an email through the report's closing modal, Stroma will erase the corresponding row(s) on request to **admin@stroma.design**. Standard GDPR 30-day response window applies.

Detailed procedure: [`docs/right-to-erasure.md`](./docs/right-to-erasure.md).

---

## Cookies

Signal sets no cookies. The SDK does not read any cookies set by other parties on the operator's site. The hosted `/r` report sets no cookies.

Operators may independently set cookies on their own sites for their own purposes; Signal does not interact with them.

---

## Browser-level tracking signals honored

The Signal SDK and the install wizard honor the following user signals:

- **`DO_NOT_TRACK=1`** (industry-standard environment variable): disables install telemetry.
- **`STROMA_TELEMETRY=0`**: disables install telemetry.

The performance SDK does not have a per-visitor opt-out signal because it captures no personal data — there is nothing to opt out of at the visitor level. Operators who do not want to deploy the SDK at all simply do not install it.

---

## Consent regime alignment

Because the Signal performance SDK does not capture personal data, it generally does not require visitor-level consent under GDPR, CCPA, POPIA, LGPD, or comparable regimes for the SDK's own capture.

**However**, if you transmit Signal events into a warehouse that already contains user identifiers, the joined dataset may be subject to consent requirements your own deployment is responsible for. Consult your DPO. The boundary is: Signal's capture is consent-clean; downstream joins are the operator's responsibility.

The optional ad-context capture module captures ad-click identifiers (e.g. `gclid`), which are personal data under several regimes when joined to other identifiers. Operators enabling this module should ensure their consent posture supports the capture. Signal's `provenance.consent_state` field surfaces the operator's Google Consent Mode v2 state at capture time so downstream filtering by consent is straightforward.

---

## Breach notification

In the event of a security incident affecting any Stroma-hosted endpoint or stored data:

- Stroma will acknowledge a reported incident within 48 hours.
- A mitigation plan will be communicated within 7 days.
- Material breaches affecting operator data will be disclosed to affected operators within 72 hours of confirmation (aligned with GDPR Article 33 timing).

Vulnerability reporting procedure: [`SECURITY.md`](./SECURITY.md).

---

## Changes to this policy

This policy is versioned alongside the source repository. Material changes will be announced in [`CHANGELOG.md`](./CHANGELOG.md) and surfaced in the relevant SDK release notes.

Historical versions are accessible via the file's git history.

---

## Contact

Questions, concerns, or requests: **admin@stroma.design**

Security disclosures: see [`SECURITY.md`](./SECURITY.md).
