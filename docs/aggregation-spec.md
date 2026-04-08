# Signal Aggregation Spec

## Production Truth

Production truth comes from analytics-derived aggregation. Browser preview is non-authoritative and exists only for sanity-checking.

## Required Aggregate Fields

`SignalAggregateV1` must include:

- network tier distribution
- device tier distribution
- sample size
- period days
- urban vs comparison-tier p75 values
- network coverage
- unclassified network share
- connection reuse share
- LCP coverage
- `comparison_tier`
- `race_metric`
- `race_fallback_reason`
- report version `rv=1`

## Comparison Tier

The comparison tier is the highest-share non-urban classified tier. If no non-urban tier has observations, `comparison_tier = "none"`.

## Act 2 Metric Fallback

The report renderer must not choose the race metric. The aggregate chooses it.

1. Use `lcp` only if both urban and comparison cohorts have at least 25 observations and at least 50% LCP coverage.
2. Else use `fcp` if both cohorts have at least 25 observations and non-zero FCP coverage.
3. Else use `ttfb` if both cohorts have at least 25 observations and non-zero TTFB coverage.
4. Else set `race_metric = "none"` and render an insufficient-data state.

All labels in Act 2 must explicitly name the selected metric.

## Proxy / CDN Truth Boundary

Network classification reflects the effective path to the serving edge or proxy in many real deployments. It is operationally useful, but should not be framed as pure last-mile truth.
