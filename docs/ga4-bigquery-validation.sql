-- Signal
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
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'net_tcp_ms') AS net_tcp_ms,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'net_tcp_source') AS net_tcp_source,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'device_tier') AS device_tier,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'browser') AS browser,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'device_screen_w') AS device_screen_w,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'lcp_ms') AS lcp_ms,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'fcp_ms') AS fcp_ms,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ttfb_ms') AS ttfb_ms,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'lcp_load_state') AS lcp_load_state,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'lcp_element_type') AS lcp_element_type,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'inp_load_state') AS inp_load_state,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'interaction_type') AS interaction_type,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'input_delay_ms') AS input_delay_ms,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'processing_duration_ms') AS processing_duration_ms,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'presentation_delay_ms') AS presentation_delay_ms,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'lcp_culprit_kind') AS lcp_culprit_kind,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'lcp_dominant_subpart') AS lcp_dominant_subpart,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'inp_dominant_phase') AS inp_dominant_phase,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'third_party_weight_tier') AS third_party_weight_tier,
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
