# GTM Recipe For `perf_tier_report`

Use this when your site already has Google Tag Manager and you want Signal events to flow into GA4 without adding any direct GA4 logic to the package runtime.

Launch pack assets:

- [marketer-quickstart.md](./marketer-quickstart.md)
- [gtm-workspace-template.json](./gtm-workspace-template.json)
- [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql)
- [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql)

## 1. Emit The Data Layer Event

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

Signal will push a custom event named `perf_tier_report` into `window.dataLayer`.
That payload is intentionally a compact GA4-safe subset, not the full warehouse schema.

## 2. Create The GTM Trigger

Create a **Custom Event** trigger:

- Trigger type: `Custom Event`
- Event name: `perf_tier_report`
- This trigger fires on: `All Custom Events`

## 3. Create The Required Data Layer Variables

At minimum, create Data Layer Variables for:

- `event_id`
- `host`
- `url`
- `net_tier`
- `net_tcp_ms`
- `net_tcp_source`
- `device_tier`
- `lcp_ms`
- `fcp_ms`
- `ttfb_ms`
- `browser`
- `nav_type`

Recommended additional variables:

- `navigation_type`
- `lcp_load_state`
- `lcp_element_type`
- `inp_load_state`
- `interaction_type`
- `input_delay_ms`
- `processing_duration_ms`
- `presentation_delay_ms`

## 4. Create The GA4 Event Tag

Create a **GA4 Event** tag:

- Configuration tag: your existing GA4 configuration
- Event name: `perf_tier_report`
- Trigger: the custom event trigger above

Map the GA4 event params from the matching Data Layer Variables. Example:

- `event_id` -> `{{DLV - event_id}}`
- `host` -> `{{DLV - host}}`
- `url` -> `{{DLV - url}}`
- `net_tier` -> `{{DLV - net_tier}}`
- `net_tcp_ms` -> `{{DLV - net_tcp_ms}}`
- `net_tcp_source` -> `{{DLV - net_tcp_source}}`
- `device_tier` -> `{{DLV - device_tier}}`
- `lcp_ms` -> `{{DLV - lcp_ms}}`
- `fcp_ms` -> `{{DLV - fcp_ms}}`
- `ttfb_ms` -> `{{DLV - ttfb_ms}}`
- `browser` -> `{{DLV - browser}}`
- `nav_type` -> `{{DLV - nav_type}}`
- `navigation_type` -> `{{DLV - navigation_type}}`
- `lcp_load_state` -> `{{DLV - lcp_load_state}}`
- `lcp_element_type` -> `{{DLV - lcp_element_type}}`
- `inp_load_state` -> `{{DLV - inp_load_state}}`
- `interaction_type` -> `{{DLV - interaction_type}}`
- `input_delay_ms` -> `{{DLV - input_delay_ms}}`
- `processing_duration_ms` -> `{{DLV - processing_duration_ms}}`
- `presentation_delay_ms` -> `{{DLV - presentation_delay_ms}}`

These diagnostic fields are intentionally compact enough for the GTM/GA4 path. Signal does not send `lcp_target`, `lcp_resource_url`, `interaction_target`, or `interaction_time_ms` through GA4 in v0.1.

Important:

- the compact GA4 path stays under the standard-property event parameter cap
- not every param should become a GA4 custom definition
- for deeper warehouse diagnostics, use the normalized warehouse path instead of trying to force the full schema through GA4

Recommended GA4 custom definitions:

- `net_tier`
- `device_tier`
- `browser`
- `navigation_type`
- `lcp_load_state`
- `lcp_element_type`
- `inp_load_state`
- `interaction_type`
- `lcp_ms`
- `fcp_ms`
- `ttfb_ms`

Usually keep these for DebugView or BigQuery rather than GA4 custom definitions:

- `event_id`
- `host`
- `url`
- `net_tcp_ms`
- `net_tcp_source`
- `nav_type`
- `input_delay_ms`
- `processing_duration_ms`
- `presentation_delay_ms`

## 5. Verify In GTM Preview And GA4 DebugView

In GTM Preview:

1. Open your site in Preview mode.
2. Trigger one Signal flush.
3. Confirm a `perf_tier_report` event appears in the left event timeline.
4. Confirm the GA4 Event tag fires for that event.
5. Inspect the Variables tab and confirm the expected Data Layer values are present.

In GA4 DebugView:

1. Open the linked GA4 property.
2. Open DebugView.
3. Confirm `perf_tier_report` appears.
4. Open the event and confirm key params like `event_id`, `net_tier`, `device_tier`, `fcp_ms`, and `ttfb_ms`.
5. If you mapped the diagnostic enrichments above, confirm params like `navigation_type`, `lcp_load_state`, `inp_load_state`, and `interaction_type` are present as well.

## 6. After BigQuery Export Lands

First run [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql) to confirm the rows are landing.
That validation query shows raw exported rows, including `navigation_type = restore` and `navigation_type = prerender` when they occur.

Then use [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql) to generate the final hosted report URL. Save or schedule it using [bigquery-saved-query-setup.md](./bigquery-saved-query-setup.md) so the team can rerun the flow without editing SQL.
The URL-builder query excludes those non-load-shaped lifecycle rows by default.

## Rules To Keep Stable

- Keep the event name frozen as `perf_tier_report`.
- Do not add direct `gtag` loading inside the public package.
- Treat GTM as the forwarding layer and BigQuery as the production-truth aggregation layer.
