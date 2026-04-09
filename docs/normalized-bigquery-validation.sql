-- Signal by Stroma
-- Normalized warehouse validation query
-- Use this first to prove Signal rows are landing before running the normalized URL-builder query.
-- The URL-builder query excludes navigation_type = restore/prerender by default.

SELECT
  observed_at,
  event_id,
  host,
  path,
  navigation_type,
  net_tier,
  device_tier,
  fcp_ms,
  ttfb_ms
FROM `your-project.signal.signal_events`
WHERE DATE(observed_at) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND CURRENT_DATE()
ORDER BY observed_at DESC
LIMIT 50;
