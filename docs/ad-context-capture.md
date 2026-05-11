# Ad-context capture

Opt-in module for capturing ad-click identifiers and UTM tags into the operator's own warehouse alongside Signal's performance events. Lets the operator analyse their paid-traffic context in their own SQL without bolting on a second SDK.

## At a glance

- **Opt-in.** Off by default. Enable via `signal.init({ adContextCapture: true })`.
- **One row per session.** UPSERT-keyed by `capture_id`. SPA in-session navigations do not duplicate.
- **Operator-only.** Captured rows write to the operator's warehouse via the existing Signal pipeline. Nothing leaves the operator's infrastructure.
- **Coverage-aware.** Every row carries a provenance block describing what was observable at capture time (consent state, ITP heuristic, per-field presence).

## What's captured

### Ad-click identifiers (any may be present or absent per session)

| Field | Source |
|---|---|
| `gclid` | Google click identifier — most paid Google traffic |
| `gbraid` | Google iOS-context substitute for `gclid` |
| `wbraid` | Google web-app-context substitute for `gclid` |
| `fbclid` | Facebook click identifier |
| `msclkid` | Microsoft Advertising click identifier |
| `dclid` | DoubleClick / Google Display click identifier |
| `srsltid` | Google Merchant Center listing identifier |

### UTM tags (any may be present or absent per session)

| Field | Source |
|---|---|
| `utm.source` | `?utm_source=…` query param |
| `utm.medium` | `?utm_medium=…` |
| `utm.campaign` | `?utm_campaign=…` |
| `utm.term` | `?utm_term=…` |
| `utm.content` | `?utm_content=…` |

### Landing context

| Field | Notes |
|---|---|
| `landing_path` | Pathname only. No query string, no fragment, no origin. Capped at 256 characters; longer paths are truncated to head + ellipsis. |
| `referrer_origin` | Origin string only. Empty string when the referrer is empty, opaque, or same-origin. |

### Provenance block (always present, always populated)

| Field | Values | Purpose |
|---|---|---|
| `consent_state` | `granted` \| `denied` \| `unknown` | Read from Google Consent Mode v2 `ad_storage` when wired. Falls back to `unknown` if no consent-mode integration is detected. |
| `itp_hint` | `likely_stripped` \| `no_signal` \| `not_applicable` | Heuristic: `likely_stripped` when the URL has no click identifier AND the referrer is an ad network domain. False-positive prone by design — treat as a hint, not ground truth. |
| `<field>_presence` (per identifier) | `present` \| `absent` \| `unknown` | Per-field presence flag so the absence of a click identifier is interpretable downstream. Distinguishes "absent because never present" from "absent because stripped". |
| `utm_any_presence` | `present` \| `absent` \| `unknown` | True when any `utm_*` field was captured. |
| `capture_ts` | ms-epoch number | Timestamp at capture. |

## What is NOT captured

This module deliberately does not capture:

- Personally identifiable information of any kind
- Full URL with query string (only the pathname is captured; query string is parsed for known click-ID and UTM keys, then discarded)
- Email addresses
- Fingerprint hashes
- Raw user-agent strings
- Document titles, viewport dimensions, screen sizes, or any other ambient browser data
- Any field whose presence is not justified in this spec

Other Signal modules may capture some of those independently under their own opt-in flags — but never via this module.

## Wire format

The TypeScript contract is `SignalAdContextCaptureV1` exported from `@stroma-labs/signal-contracts`. The version field is locked at `1`; bumps require a new versioned type (`SignalAdContextCaptureV2`), never an in-place change to the v1 shape.

```typescript
import {
  type SignalAdContextCaptureV1,
  isSignalAdContextCaptureV1
} from '@stroma-labs/signal-contracts';
```

The receiving warehouse-side validator mirrors this shape independently; drift is caught by `ad-context.test.ts` type-guard coverage.

## Enabling capture in the SDK

```ts
import { initSignal } from '@stroma-labs/signal';

initSignal({
  // ... existing options
  adContextCapture: true
});
```

When disabled (the default), no capture code runs, no events are produced, no warehouse columns are written. Existing installs are unaffected.

When enabled, the SDK captures one row per session start (or one row per SPA route entry if the operator's pipeline treats route changes as new sessions). The capture is fire-and-forget — it does not block page render and does not delay any other Signal event emission.

## Coverage caveats

Real-world capture is bounded by what the visitor's browser permits:

- **Safari ITP / iOS ATFP** strips known tracking parameters from URLs in roughly 20%+ of sessions. The `itp_hint` heuristic surfaces this where it can be detected; many cases are silent.
- **Consent Mode v2 denial** leaves only URL parameters surviving (no cookie / no storage). The `consent_state` field records the operator's consent-mode state at capture so downstream analysis can scope to consented sessions when needed.
- **wBRAID and gBRAID** are deliberate substitutes that Google uses where `gclid` cannot be used (iOS / app contexts). A session may carry one but not the other; a session may carry neither even though it was paid traffic.
- **Document referrer** is increasingly stripped or coarsened by Safari and Firefox. `referrer_origin` records what was observable; empty string is common and informative.

The provenance block makes these limits visible per row. Operators reading the captured table should treat each row's `provenance` as load-bearing context, not metadata.

## Warehouse schema

The captured rows persist via the existing Signal warehouse pipeline. The schema mirrors `SignalAdContextCaptureV1` 1:1, with the nested `click_ids`, `utm`, and `provenance` blocks flattened to columns per the warehouse adapter's convention.

Operators querying their warehouse can join `signal_ad_context_capture` rows to `signal_perf_event` rows on `capture_id` to attach paid-traffic context to performance metrics. Example join:

```sql
SELECT
  perf.event_id,
  perf.session_id,
  perf.lcp_ms,
  perf.inp_ms,
  ctx.click_ids.gclid,
  ctx.utm.campaign,
  ctx.provenance.consent_state,
  ctx.provenance.itp_hint
FROM signal_perf_event AS perf
LEFT JOIN signal_ad_context_capture AS ctx
  ON ctx.capture_id = perf.capture_id
WHERE perf.event_date = CURRENT_DATE() - 1
```

## Privacy posture

Every field on this contract is justified by an operator-side attribution analysis use case. The capture is opt-in; the disclosure to visitors is the operator's responsibility (the captured data lives in the operator's own warehouse, governed by the operator's own privacy policy).

Signal's runtime sends no ad-context data anywhere except the operator's configured sinks. Stroma does not receive, store, or process ad-context capture rows.

## Versioning

Schema changes follow Signal's general contract-versioning rule: existing fields never change shape; new fields are added as optional; breaking shape changes require a new version (`SignalAdContextCaptureV2`) coexisting with the old. The current version is `SIGNAL_AD_CONTEXT_CAPTURE_VERSION = 1`.

## Status

This module is in **specification phase**. The contract types and validators ship in `@stroma-labs/signal-contracts`; the runtime capture module (`packages/signal/src/ad-context/`) lands in a follow-up release. Until the runtime ships, operators can use the contract types to validate fixtures or to model their warehouse schema.
