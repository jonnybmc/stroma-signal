# GTM Recipe For `perf_tier_report`

Use this when your site already has Google Tag Manager and you want Signal events to flow into GA4 without adding any direct GA4 logic to the package runtime.

Launch pack assets:

- [marketer-quickstart.md](./marketer-quickstart.md) — end-to-end walkthrough
- [gtm-workspace-template.json](./gtm-workspace-template.json) — machine-readable trigger / variable / tag blueprint
- [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql) — confirm rows are landing in BigQuery
- [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql) — produce the hosted `signal_report_url`

## 1. Emit the dataLayer event

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

Signal pushes a custom event named `perf_tier_report` into `window.dataLayer` with **24 user-defined parameters + the event name = exactly 25**, which sits at GA4's per-event parameter cap. The payload is a deliberately compact GA4-safe subset; the full warehouse schema is only available via the beacon / callback sinks.

## 2. Create the GTM trigger

Create a **Custom Event** trigger:

- Trigger type: `Custom Event`
- Event name: `perf_tier_report`
- This trigger fires on: `All Custom Events`

## 3. Create the dataLayer variables

Map all 24 fields. They split into two groups by what the report SQL actually consumes.

### Required (the URL builder needs these to render the full report)

| DLV name                     | dataLayer key            | Used for                                                  |
| ---------------------------- | ------------------------ | --------------------------------------------------------- |
| `DLV - event_id`             | `event_id`               | Per-row de-duplication                                    |
| `DLV - host`                 | `host`                   | Domain filter, header label                               |
| `DLV - url`                  | `url`                    | Top page-path detection                                   |
| `DLV - net_tier`             | `net_tier`               | Drives Acts 1, 2, 3 entirely                              |
| `DLV - net_tcp_source`       | `net_tcp_source`         | Connection-reuse share in the credibility footer          |
| `DLV - device_tier`          | `device_tier`            | Act 1 device distribution                                 |
| `DLV - device_screen_w`      | `device_screen_w`        | Form-factor split (mobile / tablet / desktop)             |
| `DLV - lcp_ms`               | `lcp_ms`                 | Act 2 race + Act 3 LCP funnel stage                       |
| `DLV - fcp_ms`               | `fcp_ms`                 | Act 2 race + Act 3 FCP funnel stage                       |
| `DLV - ttfb_ms`              | `ttfb_ms`                | Act 2 race fallback                                       |
| `DLV - input_delay_ms`       | `input_delay_ms`         | Component of derived `inp_ms` (Act 3 INP stage)           |
| `DLV - processing_duration_ms` | `processing_duration_ms` | Component of derived `inp_ms`                             |
| `DLV - presentation_delay_ms` | `presentation_delay_ms` | Component of derived `inp_ms`                             |

> Without all three INP components, the URL builder cannot derive `inp_ms` and Act 3's INP funnel stage will be omitted (the report degrades cleanly to FCP + LCP).

### Recommended (filter optimisation + diagnostic surfaces)

| DLV name                          | dataLayer key                | What it adds                                                   |
| --------------------------------- | ---------------------------- | -------------------------------------------------------------- |
| `DLV - navigation_type`           | `navigation_type`            | Filters `restore` / `prerender` rows. Defaults to `navigate` if missing. |
| `DLV - net_tcp_ms`                | `net_tcp_ms`                 | Raw handshake time. Useful for tier audits in the warehouse path. |
| `DLV - browser`                   | `browser`                    | Environment block in the normalized warehouse path; useful in DebugView. |
| `DLV - lcp_load_state`            | `lcp_load_state`             | DebugView attribution                                          |
| `DLV - lcp_element_type`          | `lcp_element_type`           | DebugView attribution                                          |
| `DLV - inp_load_state`            | `inp_load_state`             | DebugView attribution                                          |
| `DLV - interaction_type`          | `interaction_type`           | DebugView attribution                                          |
| `DLV - lcp_culprit_kind`          | `lcp_culprit_kind`           | Editorial classifier output                                    |
| `DLV - lcp_dominant_subpart`      | `lcp_dominant_subpart`       | Per-event LCP breakdown summary                                |
| `DLV - inp_dominant_phase`        | `inp_dominant_phase`         | Per-event INP phase summary                                    |
| `DLV - third_party_weight_tier`   | `third_party_weight_tier`    | Pre-LCP third-party script weight tier                         |

Fields that are deliberately **not** in the GA4 path (warehouse-only via beacon / callback): `lcp_target`, `lcp_resource_url`, `interaction_target`, `interaction_time_ms`, `device_cores`, `device_memory_gb`, `effective_type`, `downlink_mbps`, `rtt_ms`, `save_data`, `connection_type`. The compact GA4 subset is exactly 24 user-defined params + the event name = 25, which sits at GA4's per-event custom-parameter cap; including the warehouse-only fields would exceed it.

## 4. Create the GA4 event tag

Create a **GA4 Event** tag:

- Configuration tag: your existing GA4 configuration
- Event name: `perf_tier_report`
- Trigger: the custom event trigger above

Map every parameter from its matching DLV — same name on both sides, e.g.:

```
event_id              -> {{DLV - event_id}}
host                  -> {{DLV - host}}
url                   -> {{DLV - url}}
net_tier              -> {{DLV - net_tier}}
net_tcp_source        -> {{DLV - net_tcp_source}}
device_tier           -> {{DLV - device_tier}}
device_screen_w       -> {{DLV - device_screen_w}}
lcp_ms                -> {{DLV - lcp_ms}}
fcp_ms                -> {{DLV - fcp_ms}}
ttfb_ms               -> {{DLV - ttfb_ms}}
input_delay_ms        -> {{DLV - input_delay_ms}}
processing_duration_ms -> {{DLV - processing_duration_ms}}
presentation_delay_ms -> {{DLV - presentation_delay_ms}}
navigation_type       -> {{DLV - navigation_type}}
net_tcp_ms            -> {{DLV - net_tcp_ms}}
browser               -> {{DLV - browser}}
lcp_load_state        -> {{DLV - lcp_load_state}}
lcp_element_type      -> {{DLV - lcp_element_type}}
inp_load_state        -> {{DLV - inp_load_state}}
interaction_type      -> {{DLV - interaction_type}}
lcp_culprit_kind      -> {{DLV - lcp_culprit_kind}}
lcp_dominant_subpart  -> {{DLV - lcp_dominant_subpart}}
inp_dominant_phase    -> {{DLV - inp_dominant_phase}}
third_party_weight_tier -> {{DLV - third_party_weight_tier}}
```

The full payload sits at exactly the 25-parameter cap (24 user-defined + the event name). Mapping all 24 keeps the warehouse export complete; the URL builder will pick what it needs.

## GA4 custom definitions (optional)

> ⚠ **Skip this section if you only want the /r Tier Report.**
> /r reads directly from BigQuery's `event_params` and renders without any Custom Dimensions registered. This step is purely GA4-UI polish for teams that also want to use GA4's native reporting on top of Signal data.

### When to do this

Register Custom Dimensions if you want to:

- Filter or break down standard GA4 reports by Signal parameters (e.g. group by `net_tier`, segment by `device_tier`).
- Build Explorations that pivot on Signal dimensions.
- Define audiences based on substrate-tier behavior (e.g. "users who hit constrained network on mobile devices").

### What /r already gives you without this

The `/r` Tier Report reads BigQuery's raw `event_params` array — it does not depend on registered Custom Dimensions. Skip this section entirely if `/r` is the only surface you care about. The same applies to BigQuery's own SQL queries and DebugView, which both work against the raw param payload without any registration step.

### Steps (5 minutes)

**Step 1.** GA4 → **Admin** (gear icon, bottom left).

**Step 2.** **Property** column → **Custom definitions**.

**Step 3.** **Custom dimensions** tab → **Create custom dimensions**. Register these as **event-scoped** dimensions:

| Dimension name           | Event parameter           |
|--------------------------|---------------------------|
| Network tier             | `net_tier`                |
| Device tier              | `device_tier`             |
| Browser                  | `browser`                 |
| Navigation type          | `navigation_type`         |
| LCP load state           | `lcp_load_state`          |
| LCP element type         | `lcp_element_type`        |
| INP load state           | `inp_load_state`          |
| Interaction type         | `interaction_type`        |
| LCP culprit kind         | `lcp_culprit_kind`        |
| LCP dominant subpart     | `lcp_dominant_subpart`    |
| INP dominant phase       | `inp_dominant_phase`      |
| Third-party weight tier  | `third_party_weight_tier` |

**Step 4.** **Custom metrics** tab → **Create custom metrics**. Register these as **event-scoped** metrics. Set unit to **Milliseconds** for the time fields and **Standard** for `device_screen_w`:

| Metric name              | Event parameter          | Unit         |
|--------------------------|--------------------------|--------------|
| LCP (ms)                 | `lcp_ms`                 | Milliseconds |
| FCP (ms)                 | `fcp_ms`                 | Milliseconds |
| TTFB (ms)                | `ttfb_ms`                | Milliseconds |
| Net TCP (ms)             | `net_tcp_ms`             | Milliseconds |
| Input delay (ms)         | `input_delay_ms`         | Milliseconds |
| Processing duration (ms) | `processing_duration_ms` | Milliseconds |
| Presentation delay (ms)  | `presentation_delay_ms`  | Milliseconds |
| Device screen width      | `device_screen_w`        | Standard     |

That's **12 dimensions + 8 metrics = 20 of your 50 + 50 quota used.** Plenty of headroom.

### What you can intentionally skip

These params arrive in BigQuery and the `/r` URL builder regardless, but don't make sense as registered GA4 dimensions:

- `event_id` — identifier; promoting it adds no analytical value.
- `host`, `url` — already available as standard GA4 page-path / hostname dimensions.
- `net_tcp_source` — diagnostic metadata, not a useful breakdown.

These show up in DebugView and BigQuery either way.

### Verification

After registering, allow up to **24-48 hours** before the new dimensions and metrics start populating in standard reports. They appear immediately in DebugView. BigQuery export is not affected by this step at all — it always carries every parameter regardless of registration.

## 5. Verify in GTM Preview and GA4 DebugView

In GTM Preview:

1. Open your site in Preview mode.
2. Trigger one Signal flush (navigate, then close the tab).
3. Confirm a `perf_tier_report` event appears in the left event timeline.
4. Confirm the GA4 Event tag fires for that event.
5. Inspect the **Variables** tab — every required DLV should resolve to a non-empty value.

In GA4 DebugView:

1. Open the linked GA4 property → **DebugView**.
2. Confirm `perf_tier_report` appears.
3. Open the event and confirm key params: `event_id`, `net_tier`, `device_tier`, `lcp_ms`, `fcp_ms`, `ttfb_ms`, and the INP triple.

If anything fails here, see [launch-troubleshooting.md](./launch-troubleshooting.md).

## 6. After BigQuery export lands

1. Run [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql) to confirm rows are landing. The validation query shows raw exported rows including `navigation_type = restore` and `prerender`.
2. Run [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql) to generate the hosted `signal_report_url`. The URL builder de-duplicates by `event_id` and excludes `restore` / `prerender` rows so percentiles stay tied to normal load performance.
3. Save or schedule the URL-builder query using [bigquery-saved-query-setup.md](./bigquery-saved-query-setup.md) so the team can refresh the URL without editing SQL.

## Rules to keep stable

- Keep the event name frozen as `perf_tier_report`.
- Do not add direct `gtag` loading inside the public package — GTM is the forwarding layer.
- Treat BigQuery as the production-truth aggregation layer; GA4 is the transport.
