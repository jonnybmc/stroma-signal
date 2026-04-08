# Choose Your Signal Setup

`@stroma-labs/signal` is configured in application code. The browser package does not expose a runtime GUI, CLI flag, GTM container ID, or GA4 measurement ID.

Signal is event-first, sink-based, analytics-agnostic, and ESM-only. Signal emits canonical `SignalEventV1` payloads, and your team decides where those events go.

## Choose Your Setup

### I already have GTM / GA4

Use this if: your site already uses GTM and you want Signal to push the canonical event into `window.dataLayer`.

Exact import:

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';
```

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

Success check: `perf_tier_report` appears in GTM Preview, then in GA4 DebugView.

Next doc: [marketer-quickstart.md](./marketer-quickstart.md)

What happens next:

- Signal pushes `perf_tier_report` into `window.dataLayer`
- GTM listens for that custom event
- GTM forwards the mapped params into GA4
- GA4 exports the event to BigQuery

Verification detail:

1. Open GTM Preview mode.
2. Load a page with Signal installed.
3. Trigger a flush.
4. Confirm a `perf_tier_report` custom event appears.
5. Confirm the GA4 event tag fires.
6. Confirm `perf_tier_report` appears in GA4 DebugView.

Notes:

- Signal does not need your GTM container ID.
- Signal does not load GTM or GA4 scripts for you.
- Keep the event name frozen as `perf_tier_report`.
- Signal can optionally annotate LCP and INP targets via `generateTarget()` if you want human-readable warehouse diagnostics.

### I want to send to my own endpoint

Use this if: you already have a backend or collector and want warehouse truth without GTM.

Exact import:

```ts
import { init, createBeaconSink } from '@stroma-labs/signal';
```

```ts
import { init, createBeaconSink } from '@stroma-labs/signal';

init({
  sinks: [createBeaconSink({ endpoint: '/rum/signal' })]
});
```

Success check: one request lands at your collector and the payload contains `event_id`.

Next doc: [collector-contract.md](./collector-contract.md)

What happens next:

- Signal serializes the canonical event as JSON
- it tries `sendBeacon()` first
- it falls back to `fetch(..., { keepalive: true })`
- your endpoint receives `SignalEventV1`

Verification detail:

1. Open browser Network tools.
2. Trigger a flush.
3. Confirm your collector endpoint receives the request.
4. Confirm the stored payload includes `event_id`, `net_tier`, `net_tcp_source`, `device_tier`, and vitals fields.
5. If you enabled `generateTarget()`, confirm `vitals.lcp_attribution` and `vitals.inp_attribution` include safe target labels.

Notes:

- Add `onError(error, event)` if you want local delivery failure logging.
- Add `generateTarget()` only if you need safe human-readable labels for LCP and INP attribution fields.

### I want full control in app code

Use this if: you already have an analytics SDK wrapper, want to enrich before sending, or need app-level control.

Exact import:

```ts
import { init, createCallbackSink } from '@stroma-labs/signal';
```

```ts
import { init, createCallbackSink } from '@stroma-labs/signal';

init({
  sinks: [
    createCallbackSink({
      onReport(event) {
        console.log('Signal event', event);
      }
    })
  ]
});
```

Success check: your callback fires once and exposes the canonical event object.

Next doc: [warehouse-schema.md](./warehouse-schema.md)

What happens next:

- Signal hands you the canonical `SignalEventV1`
- your app code decides what to do next
- you can forward it into an SDK, a queue, your own fetch layer, or an internal analytics bus

Verification detail:

1. Trigger a flush.
2. Confirm your callback runs once.
3. Confirm the event object contains the expected network, device, and vitals fields.

## First 5 Minutes

1. Choose your integration mode.
2. Paste the matching snippet into app code.
3. Verify one event locally.
4. Verify GTM / GA4 or endpoint landing.
5. Generate the first report URL.

## Report URL Handoff

- GTM / GA4 path: run [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql), then [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql).
- Own endpoint path: flatten rows into the [warehouse schema](./warehouse-schema.md), then run [normalized-bigquery-validation.sql](./normalized-bigquery-validation.sql), then [normalized-bigquery-url-builder.sql](./normalized-bigquery-url-builder.sql).
- Full-control path: hand off the canonical event into your own pipeline, keep canonical field names, then use [normalized-bigquery-validation.sql](./normalized-bigquery-validation.sql) and [normalized-bigquery-url-builder.sql](./normalized-bigquery-url-builder.sql).
- [`/build`](http://signal.stroma.design/build) is the QA and fallback path, not the primary launch automation path.

## Integration Rules

- `perf_tier_report` is the canonical GTM/GA4 event name.
- GTM is optional. Teams without GTM should prefer `beacon` or `callback`.
- Direct `gtag` transport exists only in the local spike lab for Gate 2 validation.
- Preview aggregation is a sanity-check path only. Production truth comes from warehouse aggregation.
- `meta.nav_type` remains for backward compatibility. Prefer `meta.navigation_type` in new warehouse work.
- Keep `generateTarget()` conservative: return a safe label, not raw text or user content.

## Launch Pack

If you are onboarding a GTM/GA4-led client, start here:

- [marketer-quickstart.md](./marketer-quickstart.md)
- [gtm-recipe.md](./gtm-recipe.md)
- [launch-troubleshooting.md](./launch-troubleshooting.md)
