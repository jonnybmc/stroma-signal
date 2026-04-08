# Internal Onboarding Checklist

Use this checklist when Stroma is onboarding a launch client onto Signal.

Use [public-api-v0.1.md](./public-api-v0.1.md) as the canonical package contract during onboarding and review.

## 1. Choose The Sink

- GTM / GA4 via `createDataLayerSink()`
- Beacon via `createBeaconSink()`
- Callback via `createCallbackSink()`

Default launch recommendation: GTM / GA4.

## 2. Confirm Runtime Deployment

- Signal runtime is deployed on the target site
- collection happens automatically with no manual runtime steps
- the chosen sink wiring matches the client’s environment

## 3. Confirm Analytics Path

For GTM / GA4 clients:

- GTM Preview shows `perf_tier_report`
- the GA4 Event tag fires
- GA4 DebugView shows `perf_tier_report`

For beacon / callback clients:

- the collector receives the canonical `SignalEventV1`
- the normalized row shape matches [warehouse-schema.md](./warehouse-schema.md)

## 4. Confirm Warehouse Truth

- validation query returns rows
- URL-builder query runs with only project/dataset/table substitution
- query returns a final `signal_report_url`

## 5. Confirm Hosted Output

- open the hosted `/r?...` URL
- validate fallback fields and coverage honesty
- use `/build` if QA is needed before sharing

## 6. Hand Off

- share the final hosted report URL
- share the GTM/warehouse docs with the client
- record the chosen sink, warehouse path, and query location internally
