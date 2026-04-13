-- Signal by Stroma
-- GA4 BigQuery validation query
-- Use this first to prove perf_tier_report rows are landing before running the URL-builder query.
-- The URL-builder query excludes navigation_type = restore/prerender by default.
-- Canonical production window = the last 7 complete calendar days,
-- excluding the current in-progress day.

SELECT
  TIMESTAMP_MICROS(event_timestamp) AS observed_at,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'event_id') AS event_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'host') AS host,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'url') AS url,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'navigation_type') AS navigation_type,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'net_tier') AS net_tier,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'device_tier') AS device_tier,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'lcp_ms') AS lcp_ms,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'fcp_ms') AS fcp_ms,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ttfb_ms') AS ttfb_ms,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'input_delay_ms') AS input_delay_ms,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'processing_duration_ms') AS processing_duration_ms,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'presentation_delay_ms') AS presentation_delay_ms,
  IF(
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'input_delay_ms') IS NULL
      OR (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'processing_duration_ms') IS NULL
      OR (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'presentation_delay_ms') IS NULL,
    NULL,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'input_delay_ms')
      + (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'processing_duration_ms')
      + (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'presentation_delay_ms')
  ) AS derived_inp_ms
FROM `your-project.analytics_XXXXXXXX.events_*`
WHERE event_name = 'perf_tier_report'
  AND _TABLE_SUFFIX BETWEEN
    FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
    AND FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY))
ORDER BY event_timestamp DESC
LIMIT 50;
