-- Signal by Stroma
-- GA4 BigQuery URL builder using perf_tier_report
-- Default report math excludes non-load-shaped restore/prerender rows.
-- Canonical production window = the last 7 complete calendar days,
-- excluding the current in-progress day.

WITH ga4_events AS (
  SELECT
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'host') AS host,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'url') AS url,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'net_tier') AS net_tier,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'net_tcp_ms') AS net_tcp_ms,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'net_tcp_source') AS net_tcp_source,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'browser') AS browser,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'device_tier') AS device_tier,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'device_screen_w') AS device_screen_w,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'navigation_type') AS navigation_type,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'lcp_ms') AS lcp_ms,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'fcp_ms') AS fcp_ms,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ttfb_ms') AS ttfb_ms,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'input_delay_ms') AS input_delay_ms,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'processing_duration_ms') AS processing_duration_ms,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'presentation_delay_ms') AS presentation_delay_ms,
    -- Iteration-6 fields (device_cores, device_memory_gb, effective_type,
    -- downlink_mbps, rtt_ms, save_data) are warehouse-only — NOT included
    -- in the GA4 21-field event param map due to the GA4 25-param
    -- standard-property limit. These fields are available via the
    -- normalized warehouse recipe instead. device_screen_w IS included
    -- in the GA4 compact subset as of 0.1 — it unlocks the form-factor
    -- split (mobile / tablet / desktop) aggregated below.
    -- See: docs/normalized-bigquery-url-builder.sql
    TIMESTAMP_MICROS(event_timestamp) AS observed_at
  FROM `your-project.analytics_XXXXXXXX.events_*`
  WHERE event_name = 'perf_tier_report'
    AND _TABLE_SUFFIX BETWEEN
      FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
      AND FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY))
    AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'host') = 'your-domain.com' -- replace with your domain; use @host in parameterized queries for production automation
    AND COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'navigation_type'), 'navigate')
      NOT IN ('restore', 'prerender')
  QUALIFY ROW_NUMBER() OVER (PARTITION BY (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'event_id') ORDER BY event_timestamp) = 1
),
source_events AS (
  SELECT
    host,
    url,
    net_tier,
    net_tcp_ms,
    net_tcp_source,
    browser,
    device_tier,
    device_screen_w,
    navigation_type,
    lcp_ms,
    fcp_ms,
    ttfb_ms,
    input_delay_ms,
    processing_duration_ms,
    presentation_delay_ms,
    IF(
      input_delay_ms IS NULL OR processing_duration_ms IS NULL OR presentation_delay_ms IS NULL,
      NULL,
      input_delay_ms + processing_duration_ms + presentation_delay_ms
    ) AS inp_ms,
    observed_at
  FROM ga4_events
),
counts AS (
  SELECT
    ANY_VALUE(host) AS host, -- single domain after WHERE host filter
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
    -- Form-factor split from device_screen_w. Breakpoints: <768 mobile,
    -- 768-1279 tablet, >=1280 desktop. Denominator is COUNTIF(device_screen_w IS NOT NULL)
    -- so rows with missing screen width don't dilute the percentages — they
    -- simply don't contribute to the form-factor distribution.
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_screen_w IS NOT NULL AND device_screen_w > 0 AND device_screen_w < 768), COUNTIF(device_screen_w IS NOT NULL AND device_screen_w > 0))), 0) AS ff_mobile,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_screen_w IS NOT NULL AND device_screen_w >= 768 AND device_screen_w < 1280), COUNTIF(device_screen_w IS NOT NULL AND device_screen_w > 0))), 0) AS ff_tablet,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_screen_w IS NOT NULL AND device_screen_w >= 1280), COUNTIF(device_screen_w IS NOT NULL AND device_screen_w > 0))), 0) AS ff_desktop,
    (SELECT SPLIT(url, '?')[OFFSET(0)] FROM UNNEST(ARRAY_AGG(url)) AS url GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 1) AS top_path
  FROM source_events
),
comparison_tier AS (
  SELECT
    IF(
      MAX(tier_count) = 0,
      'none',
      ARRAY_AGG(tier ORDER BY tier_count DESC, tier ASC LIMIT 1)[OFFSET(0)]
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
-- Safe p75: returns NULL instead of INDEX_OUT_OF_BOUNDS when all inputs are NULL.
vitals AS (
  SELECT
    IF(COUNTIF(net_tier = 'urban' AND lcp_ms IS NOT NULL) > 0, APPROX_QUANTILES(IF(net_tier = 'urban', lcp_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)], NULL) AS lu,
    IF(COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier) AND lcp_ms IS NOT NULL) > 0, APPROX_QUANTILES(IF(net_tier = (SELECT comparison_tier FROM comparison_tier), lcp_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)], NULL) AS lt,
    IF(COUNTIF(net_tier = 'urban' AND fcp_ms IS NOT NULL) > 0, APPROX_QUANTILES(IF(net_tier = 'urban', fcp_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)], NULL) AS fu,
    IF(COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier) AND fcp_ms IS NOT NULL) > 0, APPROX_QUANTILES(IF(net_tier = (SELECT comparison_tier FROM comparison_tier), fcp_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)], NULL) AS ft,
    IF(COUNTIF(net_tier = 'urban' AND ttfb_ms IS NOT NULL) > 0, APPROX_QUANTILES(IF(net_tier = 'urban', ttfb_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)], NULL) AS tu,
    IF(COUNTIF(net_tier = (SELECT comparison_tier FROM comparison_tier) AND ttfb_ms IS NOT NULL) > 0, APPROX_QUANTILES(IF(net_tier = (SELECT comparison_tier FROM comparison_tier), ttfb_ms, NULL), 100 IGNORE NULLS)[OFFSET(75)], NULL) AS tt
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
),
stage_inputs AS (
  SELECT
    COUNTIF(net_tier IS NOT NULL) AS classified_sample_size,
    COUNTIF(net_tier IS NOT NULL AND lcp_ms IS NOT NULL) AS lcp_stage_observations,
    COUNTIF(net_tier IS NOT NULL AND inp_ms IS NOT NULL) AS inp_stage_observations,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'urban' AND fcp_ms IS NOT NULL), COUNTIF(net_tier = 'urban'))), 0) AS urban_fcp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'moderate' AND fcp_ms IS NOT NULL), COUNTIF(net_tier = 'moderate'))), 0) AS moderate_fcp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained_moderate' AND fcp_ms IS NOT NULL), COUNTIF(net_tier = 'constrained_moderate'))), 0) AS constrained_moderate_fcp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained' AND fcp_ms IS NOT NULL), COUNTIF(net_tier = 'constrained'))), 0) AS constrained_fcp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'urban' AND fcp_ms > 3000), COUNTIF(net_tier = 'urban' AND fcp_ms IS NOT NULL))), 0) AS urban_fcp_poor_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'moderate' AND fcp_ms > 3000), COUNTIF(net_tier = 'moderate' AND fcp_ms IS NOT NULL))), 0) AS moderate_fcp_poor_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained_moderate' AND fcp_ms > 3000), COUNTIF(net_tier = 'constrained_moderate' AND fcp_ms IS NOT NULL))), 0) AS constrained_moderate_fcp_poor_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained' AND fcp_ms > 3000), COUNTIF(net_tier = 'constrained' AND fcp_ms IS NOT NULL))), 0) AS constrained_fcp_poor_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'urban' AND lcp_ms IS NOT NULL), COUNTIF(net_tier = 'urban'))), 0) AS urban_lcp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'moderate' AND lcp_ms IS NOT NULL), COUNTIF(net_tier = 'moderate'))), 0) AS moderate_lcp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained_moderate' AND lcp_ms IS NOT NULL), COUNTIF(net_tier = 'constrained_moderate'))), 0) AS constrained_moderate_lcp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained' AND lcp_ms IS NOT NULL), COUNTIF(net_tier = 'constrained'))), 0) AS constrained_lcp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'urban' AND lcp_ms > 4000), COUNTIF(net_tier = 'urban' AND lcp_ms IS NOT NULL))), 0) AS urban_lcp_poor_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'moderate' AND lcp_ms > 4000), COUNTIF(net_tier = 'moderate' AND lcp_ms IS NOT NULL))), 0) AS moderate_lcp_poor_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained_moderate' AND lcp_ms > 4000), COUNTIF(net_tier = 'constrained_moderate' AND lcp_ms IS NOT NULL))), 0) AS constrained_moderate_lcp_poor_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained' AND lcp_ms > 4000), COUNTIF(net_tier = 'constrained' AND lcp_ms IS NOT NULL))), 0) AS constrained_lcp_poor_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'urban' AND inp_ms IS NOT NULL), COUNTIF(net_tier = 'urban'))), 0) AS urban_inp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'moderate' AND inp_ms IS NOT NULL), COUNTIF(net_tier = 'moderate'))), 0) AS moderate_inp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained_moderate' AND inp_ms IS NOT NULL), COUNTIF(net_tier = 'constrained_moderate'))), 0) AS constrained_moderate_inp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained' AND inp_ms IS NOT NULL), COUNTIF(net_tier = 'constrained'))), 0) AS constrained_inp_stage_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'urban' AND inp_ms > 500), COUNTIF(net_tier = 'urban' AND inp_ms IS NOT NULL))), 0) AS urban_inp_poor_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'moderate' AND inp_ms > 500), COUNTIF(net_tier = 'moderate' AND inp_ms IS NOT NULL))), 0) AS moderate_inp_poor_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained_moderate' AND inp_ms > 500), COUNTIF(net_tier = 'constrained_moderate' AND inp_ms IS NOT NULL))), 0) AS constrained_moderate_inp_poor_share,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(net_tier = 'constrained' AND inp_ms > 500), COUNTIF(net_tier = 'constrained' AND inp_ms IS NOT NULL))), 0) AS constrained_inp_poor_share
  FROM source_events
),
funnel_activation AS (
  SELECT
    classified_sample_size,
    lcp_stage_observations >= 25
      AND IFNULL(ROUND(100 * SAFE_DIVIDE(lcp_stage_observations, classified_sample_size)), 0) >= 50 AS include_lcp,
    inp_stage_observations >= 25
      AND IFNULL(ROUND(100 * SAFE_DIVIDE(inp_stage_observations, classified_sample_size)), 0) >= 50 AS include_inp
  FROM stage_inputs
),
funnel_rollup AS (
  SELECT
    CASE
      WHEN classified_sample_size = 0 THEN ''
      WHEN include_lcp AND include_inp THEN 'fcp,lcp,inp'
      WHEN include_lcp THEN 'fcp,lcp'
      ELSE 'fcp'
    END AS active_stages,
    IFNULL(
      ROUND(
        100 * SAFE_DIVIDE(
          COUNTIF(
            net_tier IS NOT NULL
            AND fcp_ms IS NOT NULL
            AND (NOT include_lcp OR lcp_ms IS NOT NULL)
            AND (NOT include_inp OR inp_ms IS NOT NULL)
          ),
          classified_sample_size
        )
      ),
      0
    ) AS measured_session_coverage,
    IFNULL(
      ROUND(
        100 * SAFE_DIVIDE(
          COUNTIF(
            net_tier IS NOT NULL
            AND fcp_ms IS NOT NULL
            AND (NOT include_lcp OR lcp_ms IS NOT NULL)
            AND (NOT include_inp OR inp_ms IS NOT NULL)
            AND (
              fcp_ms > 3000
              OR (include_lcp AND lcp_ms > 4000)
              OR (include_inp AND inp_ms > 500)
            )
          ),
          COUNTIF(
            net_tier IS NOT NULL
            AND fcp_ms IS NOT NULL
            AND (NOT include_lcp OR lcp_ms IS NOT NULL)
            AND (NOT include_inp OR inp_ms IS NOT NULL)
          )
        )
      ),
      0
    ) AS poor_session_share
  FROM source_events, funnel_activation
)
-- Iteration-6 blocks (device_hardware, network_signals, environment) are
-- NOT available in the GA4 recipe. The fields they require (device_cores,
-- device_memory_gb, effective_type, downlink_mbps, rtt_ms, save_data,
-- browser) are warehouse-only — excluded from the GA4 21-field event param
-- map due to the 25-param standard-property limit. Use the normalized
-- warehouse recipe (normalized-bigquery-url-builder.sql) to produce reports
-- with the Actionable Signals slide populated.
--
-- PR-6 (visibility filter): context_visibility_hidden_at_load is also
-- warehouse-only — the GA4 recipe cannot pre-filter background-tab loads.
-- As a consequence, the rs (raw_sample_size) and xb (excluded_background_
-- sessions) URL params are NOT emitted from this recipe. Decoders treat
-- their absence as "unknown" and the report's credibility strip gracefully
-- omits the background-exclusion segment. Customers that need this
-- transparency must use the normalized warehouse recipe.
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
  '&es=', active_stages,
  '&ec=', CAST(measured_session_coverage AS STRING),
  '&ep=', CAST(poor_session_share AS STRING),
  '&fpt=3000&lpt=4000&ipt=500',
  '&fcs=', CAST(urban_fcp_stage_coverage AS STRING), ',', CAST(moderate_fcp_stage_coverage AS STRING), ',', CAST(constrained_moderate_fcp_stage_coverage AS STRING), ',', CAST(constrained_fcp_stage_coverage AS STRING),
  '&fps=', CAST(urban_fcp_poor_share AS STRING), ',', CAST(moderate_fcp_poor_share AS STRING), ',', CAST(constrained_moderate_fcp_poor_share AS STRING), ',', CAST(constrained_fcp_poor_share AS STRING),
  '&lcs=', CAST(urban_lcp_stage_coverage AS STRING), ',', CAST(moderate_lcp_stage_coverage AS STRING), ',', CAST(constrained_moderate_lcp_stage_coverage AS STRING), ',', CAST(constrained_lcp_stage_coverage AS STRING),
  '&lps=', CAST(urban_lcp_poor_share AS STRING), ',', CAST(moderate_lcp_poor_share AS STRING), ',', CAST(constrained_moderate_lcp_poor_share AS STRING), ',', CAST(constrained_lcp_poor_share AS STRING),
  '&ics=', CAST(urban_inp_stage_coverage AS STRING), ',', CAST(moderate_inp_stage_coverage AS STRING), ',', CAST(constrained_moderate_inp_stage_coverage AS STRING), ',', CAST(constrained_inp_stage_coverage AS STRING),
  '&ips=', CAST(urban_inp_poor_share AS STRING), ',', CAST(moderate_inp_poor_share AS STRING), ',', CAST(constrained_moderate_inp_poor_share AS STRING), ',', CAST(constrained_inp_poor_share AS STRING),
  '&ff=', CAST(ff_mobile AS STRING), ',', CAST(ff_tablet AS STRING), ',', CAST(ff_desktop AS STRING),
  IFNULL(CONCAT('&v=', top_path), ''),
  '&ga=', CAST(UNIX_MILLIS(CURRENT_TIMESTAMP()) AS STRING)
  -- Iteration-6 params (dhc, dhm, dhv, nse, nsv, nsd, nsl, nsr, eb) are
  -- NOT included. See comment above the SELECT for why. Use the normalized
  -- warehouse recipe to get a report URL with the Actionable Signals slide.
) AS signal_report_url
FROM counts, vitals, comparison_tier, race_choice, stage_inputs, funnel_rollup;
