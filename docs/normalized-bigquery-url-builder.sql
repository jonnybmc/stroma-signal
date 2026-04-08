-- Signal by Stroma
-- BigQuery URL builder for a flat SignalWarehouseRowV1 table

WITH source_events AS (
  SELECT
    host,
    path AS url,
    net_tier,
    net_tcp_source,
    device_tier,
    lcp_ms,
    fcp_ms,
    ttfb_ms,
    TIMESTAMP(observed_at) AS observed_at
  FROM `your-project.signal.signal_events`
  WHERE DATE(observed_at) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND CURRENT_DATE()
),
counts AS (
  SELECT
    ANY_VALUE(host) AS host,
    COUNT(*) AS sample_size,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier IS NOT NULL), COUNT(*))), 0) AS network_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier IS NULL), COUNT(*))), 0) AS unclassified_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tcp_source = 'unavailable_reused'), COUNT(*))), 0) AS reuse_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(lcp_ms IS NOT NULL), COUNT(*))), 0) AS lcp_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'urban'), COUNT(*))), 0) AS nt_urban,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'moderate'), COUNT(*))), 0) AS nt_moderate,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained_moderate'), COUNT(*))), 0) AS nt_constrained_moderate,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained'), COUNT(*))), 0) AS nt_constrained,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier IS NULL), COUNT(*))), 0) AS nt_unknown,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_tier = 'low'), COUNT(*))), 0) AS dt_low,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_tier = 'mid'), COUNT(*))), 0) AS dt_mid,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_tier = 'high'), COUNT(*))), 0) AS dt_high,
    ARRAY_AGG(url ORDER BY observed_at DESC LIMIT 1)[OFFSET(0)] AS top_path
  FROM source_events
),
comparison_tier AS (
  SELECT
    IF(
      MAX(tier_count) = 0,
      'none',
      ARRAY_AGG(tier ORDER BY tier_count DESC LIMIT 1)[OFFSET(0)]
    ) AS comparison_tier
  FROM (
    SELECT 'moderate' AS tier, COUNTIF(net_tier = 'moderate') AS tier_count FROM source_events
    UNION ALL
    SELECT 'constrained_moderate' AS tier, COUNTIF(net_tier = 'constrained_moderate') AS tier_count FROM source_events
    UNION ALL
    SELECT 'constrained' AS tier, COUNTIF(net_tier = 'constrained') AS tier_count FROM source_events
  )
),
race_inputs AS (
  SELECT
    COUNTIF(net_tier = 'urban') AS urban_observations,
    COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier)) AS comparison_observations,
    COUNTIF(net_tier = 'urban' AND lcp_ms IS NOT NULL) AS urban_lcp_observations,
    COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier) AND lcp_ms IS NOT NULL) AS comparison_lcp_observations,
    COUNTIF(net_tier = 'urban' AND fcp_ms IS NOT NULL) AS urban_fcp_observations,
    COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier) AND fcp_ms IS NOT NULL) AS comparison_fcp_observations,
    COUNTIF(net_tier = 'urban' AND ttfb_ms IS NOT NULL) AS urban_ttfb_observations,
    COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier) AND ttfb_ms IS NOT NULL) AS comparison_ttfb_observations,
    IFNULL(
      ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'urban' AND lcp_ms IS NOT NULL), COUNTIF(net_tier = 'urban'))),
      0
    ) AS urban_lcp_coverage,
    IFNULL(
      ROUND(
        100 * SAFE_DIVIDE(
          COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier) AND lcp_ms IS NOT NULL),
          COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier))
        )
      ),
      0
    ) AS comparison_lcp_coverage,
    IFNULL(
      ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'urban' AND fcp_ms IS NOT NULL), COUNTIF(net_tier = 'urban'))),
      0
    ) AS urban_fcp_coverage,
    IFNULL(
      ROUND(
        100 * SAFE_DIVIDE(
          COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier) AND fcp_ms IS NOT NULL),
          COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier))
        )
      ),
      0
    ) AS comparison_fcp_coverage,
    IFNULL(
      ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'urban' AND ttfb_ms IS NOT NULL), COUNTIF(net_tier = 'urban'))),
      0
    ) AS urban_ttfb_coverage,
    IFNULL(
      ROUND(
        100 * SAFE_DIVIDE(
          COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier) AND ttfb_ms IS NOT NULL),
          COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier))
        )
      ),
      0
    ) AS comparison_ttfb_coverage
  FROM source_events
),
vitals AS (
  SELECT
    APPROX_QUANTILES(IF(net_tier = 'urban', lcp_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)] AS lu,
    APPROX_QUANTILES(IF(net_tier = (SELECT comparison_tier FROM comparison_tier), lcp_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)] AS lt,
    APPROX_QUANTILES(IF(net_tier = 'urban', fcp_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)] AS fu,
    APPROX_QUANTILES(IF(net_tier = (SELECT comparison_tier FROM comparison_tier), fcp_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)] AS ft,
    APPROX_QUANTILES(IF(net_tier = 'urban', ttfb_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)] AS tu,
    APPROX_QUANTILES(IF(net_tier = (SELECT comparison_tier FROM comparison_tier), ttfb_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)] AS tt
  FROM source_events
),
race_choice AS (
  SELECT
    CASE
      WHEN urban_lcp_observations >= 25
        AND comparison_lcp_observations >= 25
        AND urban_lcp_coverage >= 50
        AND comparison_lcp_coverage >= 50
        THEN 'lcp'
      WHEN urban_fcp_observations >= 25
        AND comparison_fcp_observations >= 25
        THEN 'fcp'
      WHEN urban_ttfb_observations >= 25
        AND comparison_ttfb_observations >= 25
        THEN 'ttfb'
      ELSE 'none'
    END AS race_metric,
    CASE
      WHEN urban_lcp_observations >= 25
        AND comparison_lcp_observations >= 25
        AND urban_lcp_coverage >= 50
        AND comparison_lcp_coverage >= 50
        THEN NULL
      WHEN urban_fcp_observations >= 25
        AND comparison_fcp_observations >= 25
        THEN 'lcp_coverage_below_threshold'
      WHEN urban_ttfb_observations >= 25
        AND comparison_ttfb_observations >= 25
        THEN 'fcp_unavailable'
      ELSE 'insufficient_comparable_data'
    END AS race_fallback_reason,
    CASE
      WHEN urban_lcp_observations >= 25
        AND comparison_lcp_observations >= 25
        AND urban_lcp_coverage >= 50
        AND comparison_lcp_coverage >= 50
        THEN urban_lcp_coverage
      WHEN urban_fcp_observations >= 25
        AND comparison_fcp_observations >= 25
        THEN urban_fcp_coverage
      WHEN urban_ttfb_observations >= 25
        AND comparison_ttfb_observations >= 25
        THEN urban_ttfb_coverage
      ELSE NULL
    END AS selected_metric_urban_coverage,
    CASE
      WHEN urban_lcp_observations >= 25
        AND comparison_lcp_observations >= 25
        AND urban_lcp_coverage >= 50
        AND comparison_lcp_coverage >= 50
        THEN comparison_lcp_coverage
      WHEN urban_fcp_observations >= 25
        AND comparison_fcp_observations >= 25
        THEN comparison_fcp_coverage
      WHEN urban_ttfb_observations >= 25
        AND comparison_ttfb_observations >= 25
        THEN comparison_ttfb_coverage
      ELSE NULL
    END AS selected_metric_comparison_coverage
  FROM race_inputs
)
SELECT CONCAT(
  'https://signal.stroma.design/r?rv=1&mode=production',
  '&d=', host,
  '&nt=', CAST(nt_urban AS STRING), ',', CAST(nt_moderate AS STRING), ',', CAST(nt_constrained_moderate AS STRING), ',', CAST(nt_constrained AS STRING), ',', CAST(nt_unknown AS STRING),
  '&dt=', CAST(dt_low AS STRING), ',', CAST(dt_mid AS STRING), ',', CAST(dt_high AS STRING),
  '&lu=', CAST(IFNULL(lu, 0) AS STRING),
  '&lt=', CAST(IFNULL(lt, 0) AS STRING),
  '&fu=', CAST(IFNULL(fu, 0) AS STRING),
  '&ft=', CAST(IFNULL(ft, 0) AS STRING),
  '&tu=', CAST(IFNULL(tu, 0) AS STRING),
  '&tt=', CAST(IFNULL(tt, 0) AS STRING),
  '&ulc=', CAST(urban_lcp_coverage AS STRING),
  '&ufc=', CAST(urban_fcp_coverage AS STRING),
  '&utc=', CAST(urban_ttfb_coverage AS STRING),
  '&clc=', CAST(comparison_lcp_coverage AS STRING),
  '&cfc=', CAST(comparison_fcp_coverage AS STRING),
  '&ctc=', CAST(comparison_ttfb_coverage AS STRING),
  '&s=', CAST(sample_size AS STRING),
  '&p=7',
  '&nc=', CAST(network_coverage AS STRING),
  '&nu=', CAST(unclassified_share AS STRING),
  '&nr=', CAST(reuse_share AS STRING),
  '&lc=', CAST(lcp_coverage AS STRING),
  '&ct=', comparison_tier,
  '&rm=', race_metric,
  IF(race_fallback_reason IS NULL, '', CONCAT('&rr=', race_fallback_reason)),
  IF(selected_metric_urban_coverage IS NULL, '', CONCAT('&ruc=', CAST(selected_metric_urban_coverage AS STRING))),
  IF(selected_metric_comparison_coverage IS NULL, '', CONCAT('&rcc=', CAST(selected_metric_comparison_coverage AS STRING))),
  IFNULL(CONCAT('&v=', top_path), '')
) AS signal_report_url
FROM counts, vitals, comparison_tier, race_choice;
