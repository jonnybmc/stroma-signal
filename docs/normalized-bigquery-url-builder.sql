-- Signal by Stroma
-- BigQuery URL builder for a flat SignalWarehouseRowV1 table
-- Default report math excludes non-load-shaped restore/prerender rows.
-- Canonical production window = the last 7 complete calendar days,
-- excluding the current in-progress day.

WITH source_events AS (
  SELECT
    host,
    path AS url,
    net_tier,
    net_tcp_source,
    device_tier,
    navigation_type,
    lcp_ms,
    fcp_ms,
    inp_ms,
    ttfb_ms,
    device_cores,
    device_memory_gb,
    effective_type,
    downlink_mbps,
    rtt_ms,
    save_data,
    browser,
    TIMESTAMP(observed_at) AS observed_at
  FROM `your-project.signal.signal_events`
  WHERE DATE(observed_at) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
    AND host = 'your-domain.com' -- replace with your domain; use @host in parameterized queries for production automation
    AND COALESCE(navigation_type, 'navigate') NOT IN ('restore', 'prerender')
  QUALIFY ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY observed_at) = 1
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
),
device_hardware AS (
  SELECT
    COUNT(*) AS total,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_cores = 1), COUNT(*))), 0) AS cores_1,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_cores = 2), COUNT(*))), 0) AS cores_2,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_cores = 4), COUNT(*))), 0) AS cores_4,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_cores = 6), COUNT(*))), 0) AS cores_6,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_cores = 8), COUNT(*))), 0) AS cores_8,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_cores >= 12), COUNT(*))), 0) AS cores_12plus,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_memory_gb = 0.5), COUNT(*))), 0) AS mem_05,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_memory_gb = 1), COUNT(*))), 0) AS mem_1,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_memory_gb = 2), COUNT(*))), 0) AS mem_2,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_memory_gb = 4), COUNT(*))), 0) AS mem_4,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_memory_gb >= 8), COUNT(*))), 0) AS mem_8plus,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_memory_gb IS NULL), COUNT(*))), 0) AS mem_unknown,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(device_memory_gb IS NOT NULL), COUNT(*))), 0) AS memory_coverage
  FROM source_events
),
network_signals AS (
  SELECT
    COUNT(*) AS total,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(effective_type = 'slow-2g'), COUNT(*))), 0) AS ect_slow2g,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(effective_type = '2g'), COUNT(*))), 0) AS ect_2g,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(effective_type = '3g'), COUNT(*))), 0) AS ect_3g,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(effective_type = '4g'), COUNT(*))), 0) AS ect_4g,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(effective_type IS NULL), COUNT(*))), 0) AS ect_unknown,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(effective_type IS NOT NULL), COUNT(*))), 0) AS ect_coverage,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(save_data = TRUE), COUNT(*))), 0) AS save_data_share,
    COUNTIF(downlink_mbps IS NOT NULL) AS downlink_non_null,
    COUNTIF(rtt_ms IS NOT NULL) AS rtt_non_null
  FROM source_events
),
downlink_quartiles AS (
  SELECT
    IF(
      (SELECT downlink_non_null FROM network_signals) >= 20,
      APPROX_QUANTILES(downlink_mbps, 4 IGNORE NULLS),
      NULL
    ) AS dq
  FROM source_events
),
rtt_quartiles AS (
  SELECT
    IF(
      (SELECT rtt_non_null FROM network_signals) >= 20,
      APPROX_QUANTILES(rtt_ms, 4 IGNORE NULLS),
      NULL
    ) AS rq
  FROM source_events
),
env AS (
  SELECT
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(LOWER(browser) = 'chrome'), COUNT(*))), 0) AS br_chrome,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(LOWER(browser) = 'safari'), COUNT(*))), 0) AS br_safari,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(LOWER(browser) = 'firefox'), COUNT(*))), 0) AS br_firefox,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(LOWER(browser) = 'edge'), COUNT(*))), 0) AS br_edge,
    IFNULL(ROUND(100 * SAFE_DIVIDE(COUNTIF(LOWER(browser) NOT IN ('chrome', 'safari', 'firefox', 'edge') OR browser IS NULL), COUNT(*))), 0) AS br_other
  FROM source_events
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
  IFNULL(CONCAT('&v=', top_path), ''),
  -- iteration-6: device_hardware
  '&dhc=', CAST(cores_1 AS STRING), ',', CAST(cores_2 AS STRING), ',', CAST(cores_4 AS STRING), ',', CAST(cores_6 AS STRING), ',', CAST(cores_8 AS STRING), ',', CAST(cores_12plus AS STRING),
  '&dhm=', CAST(mem_05 AS STRING), ',', CAST(mem_1 AS STRING), ',', CAST(mem_2 AS STRING), ',', CAST(mem_4 AS STRING), ',', CAST(mem_8plus AS STRING), ',', CAST(mem_unknown AS STRING),
  '&dhv=', CAST(memory_coverage AS STRING),
  -- iteration-6: network_signals
  '&nse=', CAST(ect_slow2g AS STRING), ',', CAST(ect_2g AS STRING), ',', CAST(ect_3g AS STRING), ',', CAST(ect_4g AS STRING), ',', CAST(ect_unknown AS STRING),
  '&nsv=', CAST(ect_coverage AS STRING),
  '&nsd=', CAST(save_data_share AS STRING),
  IF(dq IS NULL, '', CONCAT('&nsl=', CAST(ROUND(dq[OFFSET(1)], 1) AS STRING), ',', CAST(ROUND(dq[OFFSET(2)], 1) AS STRING), ',', CAST(ROUND(dq[OFFSET(3)], 1) AS STRING))),
  IF(rq IS NULL, '', CONCAT('&nsr=', CAST(rq[OFFSET(1)] AS STRING), ',', CAST(rq[OFFSET(2)] AS STRING), ',', CAST(rq[OFFSET(3)] AS STRING))),
  -- iteration-6: environment
  '&eb=', CAST(br_chrome AS STRING), ',', CAST(br_safari AS STRING), ',', CAST(br_firefox AS STRING), ',', CAST(br_edge AS STRING), ',', CAST(br_other AS STRING),
  -- freshness provenance
  '&ga=', CAST(UNIX_MILLIS(CURRENT_TIMESTAMP()) AS STRING)
) AS signal_report_url
FROM counts, vitals, comparison_tier, race_choice, stage_inputs, funnel_rollup, device_hardware, network_signals, downlink_quartiles, rtt_quartiles, env;
