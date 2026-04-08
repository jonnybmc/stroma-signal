-- Signal by Stroma
-- GA4 BigQuery validation query
-- Use this first to prove perf_tier_report rows are landing before running the URL-builder query.

SELECT
  TIMESTAMP_MICROS(event_timestamp) AS observed_at,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'event_id') AS event_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'host') AS host,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'url') AS url,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'net_tier') AS net_tier,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'device_tier') AS device_tier,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'fcp_ms') AS fcp_ms,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ttfb_ms') AS ttfb_ms
FROM `your-project.analytics_XXXXXXXX.events_*`
WHERE event_name = 'perf_tier_report'
  AND _TABLE_SUFFIX BETWEEN
    FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
    AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
ORDER BY event_timestamp DESC
LIMIT 50;
