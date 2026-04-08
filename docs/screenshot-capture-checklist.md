# Launch Screenshot Capture Checklist

These screenshots are part of the launch pack, but they must be captured manually because GTM and GA4 are authenticated external UIs.

## Required Screenshots

1. **GTM Preview event timeline**
- Show the `perf_tier_report` custom event in the left timeline.
- Show the GA4 event tag firing for that event.

2. **GA4 DebugView**
- Show `perf_tier_report` appearing in DebugView.
- Show the event detail panel with key params like `event_id`, `net_tier`, `device_tier`, `fcp_ms`, and `ttfb_ms`.

3. **BigQuery saved query output**
- Show the final saved query returning a `signal_report_url` field.
- Prefer a screenshot that includes one complete hosted `/r?...` URL row.

4. **Signal `/build` validation**
- Show `/build` decoding a generated URL into the summary panel.
- Prefer a scenario that demonstrates a fallback case such as FCP or TTFB.

## Capture Notes

- Use the same canonical event name everywhere: `perf_tier_report`.
- Redact client identifiers if you are capturing from a real client property.
- Keep browser URL bars visible when it helps prove which environment the screenshot came from.
- Save the final images in a shared launch folder outside the repo if they include live client or analytics account details.

## Suggested Naming

- `signal-gtm-preview-perf-tier-report.png`
- `signal-ga4-debugview-perf-tier-report.png`
- `signal-bigquery-saved-query-output.png`
- `signal-build-url-validation.png`
