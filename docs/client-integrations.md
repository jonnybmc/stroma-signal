# Signal Client Integrations

`@stroma-labs/signal` is configured in application code. The browser package does not expose a runtime GUI, CLI flag, GTM container ID, or GA4 measurement ID.

Signal emits canonical `SignalEventV1` payloads. Your team decides where those events go.

## I Have GTM / GA4

Use the public dataLayer sink.

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

What happens:

- Signal pushes `perf_tier_report` into `window.dataLayer`
- GTM listens for that custom event
- GTM forwards the mapped params into GA4
- GA4 exports the event to BigQuery

Verification:

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

## I Want To Send To My Own Endpoint

Use the beacon sink.

```ts
import { init, createBeaconSink } from '@stroma-labs/signal';

init({
  sinks: [
    createBeaconSink({
      endpoint: '/rum/signal',
      onError(error, event) {
        console.warn('Signal beacon failed', error, event.event_id);
      }
    })
  ],
  generateTarget(element) {
    return element?.tagName?.toLowerCase() ?? null;
  }
});
```

What happens:

- Signal serializes the canonical event as JSON
- it tries `sendBeacon()` first
- it falls back to `fetch(..., { keepalive: true })`
- your endpoint receives `SignalEventV1`

Verification:

1. Open browser Network tools.
2. Trigger a flush.
3. Confirm your collector endpoint receives the request.
4. Confirm the stored payload includes `event_id`, `net_tier`, `net_tcp_source`, `device_tier`, and vitals fields.
5. If you enabled `generateTarget()`, confirm `vitals.lcp_attribution` and `vitals.inp_attribution` include safe target labels.

Use this path if:

- you already have a backend or collector
- you want warehouse truth without GTM
- you want full control over retention and aggregation

## I Want To Handle The Event Myself

Use the callback sink.

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

What happens:

- Signal hands you the canonical `SignalEventV1`
- your app code decides what to do next
- you can forward it into an SDK, a queue, your own fetch layer, or an internal analytics bus

Verification:

1. Trigger a flush.
2. Confirm your callback runs once.
3. Confirm the event object contains the expected network, device, and vitals fields.

Use this path if:

- you already have an analytics SDK wrapper
- you want to enrich or transform before sending
- you need full app-level control

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
