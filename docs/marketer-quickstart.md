# Marketer Quickstart: GTM To Shareable Signal URL

<img src="./images/signal-stroma-logo.png" alt="Signal" width="270" />

This is the fastest launch path for a GTM/GA4-led team.

If you are looking for the production operating model after rows land in BigQuery, pair this with [production-report-automation.md](./production-report-automation.md).

The hosted Tier Report is the shareable proof artifact at the end of this flow. It is not a diagnostic, attribution, or commercial modelling artifact.

> 📋 **Before you deploy**, skim [operator-expectations.md](./operator-expectations.md) — it's the one-page honest answer to GA4 quotas, BigQuery costs, SPA capture behavior, browser support, and privacy posture. Five minutes there saves an hour of "wait, why doesn't this fire?" later.

## Outcome

By the end of this flow you should have:

- `perf_tier_report` appearing in GTM Preview
- `perf_tier_report` appearing in GA4 DebugView
- BigQuery rows landing
- a final hosted `signal_report_url` with a documented manual or scheduled refresh path
- a form-factor strip in the hosted report's Audience section showing your mobile / tablet / desktop split (requires the `DLV - device_screen_w` variable from [gtm-recipe.md](./gtm-recipe.md))

## Who Does What

- engineering deploys Signal with the public dataLayer sink
- martech configures GTM and the GA4 event forwarding
- analytics or ops saves the query and decides whether it runs manually or on a schedule

## Plain-English Terms

- validation query: a diagnostic query that answers, "are rows landing at all?"
- URL-builder query: the query that returns the final hosted `signal_report_url`
- saved query: a query stored in BigQuery for reuse; it does not refresh anything by itself
- scheduled query: a BigQuery job that reruns a saved query on a cadence you choose
- `signal_report_url`: the hosted `/r?...` link that becomes the shareable internal artifact

## 1. Deploy Signal

Ask your implementation team to deploy the Signal runtime with the public dataLayer sink:

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

Signal does not need your GTM container ID and does not load GTM or GA4 for you.
The GTM/GA4 path intentionally sends a compact subset. If you need the full warehouse schema, use the endpoint or callback path instead.

For the canonical v0.1 package contract, see [public-api-v0.1.md](./public-api-v0.1.md).

## 2. Configure GTM

Use these two assets together:

- [gtm-recipe.md](./gtm-recipe.md)
- [gtm-workspace-template.json](./gtm-workspace-template.json)

The GTM setup must include:

- the `perf_tier_report` custom event trigger
- the required Data Layer variables
- the GA4 event tag
- the exact parameter mapping expected by the SQL templates

> Optional: to surface Signal parameters in standard GA4 reports (not needed for `/r`), see [GA4 custom definitions](./gtm-recipe.md#ga4-custom-definitions-optional).

## 3. Verify GTM And GA4

**In GTM Preview:**

1. In your GTM workspace, click **Preview** (top right). A new tab opens with Tag Assistant.
2. Enter your site's URL → **Connect** → a second tab opens with the connected page banner.
3. Load a page with Signal deployed and either trigger a flush manually (close the tab) or just leave the page naturally — Signal flushes on `visibilitychange` / `pagehide`.
4. Switch back to the Tag Assistant tab. In the **left event timeline**, you should see `perf_tier_report` appear as a custom event. Click it to expand.
5. With the event selected, click the **Tags** tab (top of the right pane). The GA4 Event tag should show **Tags Fired** (not "Tags Not Fired"). If you have multiple GA4 tags in this container, identify yours by the measurement ID or tag name.
6. Click the **Variables** tab. Every required Data Layer Variable (`DLV - event_id`, `DLV - net_tier`, etc.) should resolve to a non-empty value, not `undefined`.

**In GA4 DebugView:**

1. GA4 → left nav → **Admin** (gear icon, bottom left) → **DebugView**. (You must have GTM Preview connected for events to appear here.)
2. Within ~30 seconds of triggering a flush in GTM Preview, `perf_tier_report` should appear as a row in the events stream.
3. Click the row to expand it. You should see all 24 Signal params with non-null values for at least the core fields: `event_id`, `net_tier`, `device_tier`, `fcp_ms`, `ttfb_ms`. Some attribution fields (`lcp_culprit_kind`, `inp_dominant_phase`, etc.) may be null on a single page view — that's expected.

If GTM Preview shows the event but GA4 DebugView doesn't, the GA4 Event tag isn't firing or the property is wrong. If the params are present in GTM but missing in GA4, the parameter mapping in the GA4 Event tag is incomplete. See [launch-troubleshooting.md](./launch-troubleshooting.md) for the symptom → cause map.

## 4. Link GA4 To BigQuery (One-Time Setup)

If your GA4 property is not yet linked to BigQuery, do this before the next step:

1. GA4 → **Admin** (gear icon, bottom left).
2. **Property** column → **BigQuery Links**.
3. **Link** → choose a Google Cloud project → tick **Daily** export → confirm.

This auto-creates a dataset named `analytics_<property_id>` in your GCP project. **You do not need to create the dataset yourself.**

> ⏱ **First export takes up to 24 hours.** Daily export only runs once per day. If you link at 3pm and run the validation query at 4pm, it will return zero rows — that is expected, not a failure. Wait until the next day before troubleshooting.

> 💰 **Daily export is free** (under 10M events/month). Streaming export costs extra and is not required for `/r`. See [operator-expectations.md](./operator-expectations.md) for the full cost / quota answer.

## 5. Verify BigQuery Rows Land

Open BigQuery Studio at <https://console.cloud.google.com/bigquery>. Pick the GCP project you linked GA4 to (top-left project picker).

In the **Query editor** (the central pane with a `SQL` tab), paste the contents of [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql) and replace the two placeholders — the first two rows of the placeholder reference table in the next section (`your-project` and `analytics_XXXXXXXX`). The validation query does **not** filter by host, so you do not need `your-domain.com` here; the URL-builder query later does. Click **Run**.

This answers the simple question:

> Are `perf_tier_report` rows landing in BigQuery?

**What success looks like:** the result pane below the editor shows one or more rows with columns like `event_id`, `host`, `net_tier`, etc. Each row is one captured Signal event. Even a few rows is enough to proceed.

**If the result is empty (zero rows):** work through these in order, not in parallel:

1. **Has it been at least 24 hours since you linked GA4 → BigQuery?** Daily export runs once per day. Linking yesterday afternoon means data lands tomorrow morning at the earliest.
2. **Are the two placeholders correct?** Run this diagnostic in a new tab: `SELECT DISTINCT event_name FROM \`your-project.analytics_XXXXXXXX.events_*\` LIMIT 100` — replacing only the project + dataset (the validation query has no host filter, so only those two substitutions matter here). If this returns zero rows, the project or dataset name is wrong (check GA4 → Admin → BigQuery Links to confirm the dataset name). If it returns rows but no `perf_tier_report`, GTM is misconfigured — go back to the GTM / GA4 verification step.
3. **Is real traffic landing in GA4?** Open GA4 → **Reports** → **Realtime**. If GA4 itself shows zero users, the GTM/GA4 path isn't capturing — go back to the GTM / GA4 verification step.

(Host-filter mismatches affect the URL-builder query in the next section, not this validation query. If the validation returns rows but the URL-builder returns none, see [launch-troubleshooting.md](./launch-troubleshooting.md) for the host-mismatch decision tree.)

This validation step shows raw exported rows, including `navigation_type = restore` and `navigation_type = prerender` when they occur. Do not move to the URL-builder query until this query returns rows.

Once this succeeds, switch to [production-report-automation.md](./production-report-automation.md) to choose the production refresh pattern and the place where the latest URL will live.

## 6. Save Or Schedule The Final URL Query

Once rows are landing, save the query in [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql) using the setup guide in [bigquery-saved-query-setup.md](./bigquery-saved-query-setup.md).

> **How the report URL is structured.** The URL the SQL produces looks like `https://signal.stroma.design/r/?...&d=<your-host>&...`. Two pieces, two purposes:
>
> | Piece | Role |
> |---|---|
> | `signal.stroma.design/r/` | The renderer. Always Stroma — it's where the report displays. You don't change this. |
> | `&d=<your-host>` | The subject. The domain the report is *about*. The SQL fills this in from the `host` filter you set below. |
>
> The `WHERE host = 'your-domain.com'` filter exists so the SQL knows which domain to put in `&d=` and so percentiles aren't averaged across unrelated sites if you later deploy Signal on multiple sub-domains. For a single-site install, set it to your one site's host.

> 📋 **Before you run the URL-builder query, replace these placeholders.** The URL-builder needs all three; the validation query in the previous section needs only the first two (it does not filter by host).
>
> | Placeholder              | Where to find it                                                                                                       |
> |--------------------------|------------------------------------------------------------------------------------------------------------------------|
> | `your-project`           | Your GCP project ID (top of the BigQuery Studio left nav)                                                              |
> | `analytics_XXXXXXXX`     | The GA4 BigQuery dataset (GA4 → Admin → BigQuery Links → click your link to see the dataset name, format `analytics_<property_id>`) |
> | `your-domain.com`        | The exact `host` value Signal is capturing for your site (same as `window.location.host`). Include subdomain (`www.example.com` ≠ `example.com`), exclude protocol (no `https://`), exclude path, exclude port, lowercase. **Easiest path:** look at the `host` column in your validation-query result; copy that literal string. Replace `'your-domain.com'` in BOTH the WHERE clause AND the COALESCE fallback in the `counts` CTE — one find-and-replace covers both. |
>
> ⚠️ **`events_*` is a BigQuery wildcard pattern, not a placeholder.** Leave it exactly as written. Replacing it with a concrete table name (e.g. `events_intraday_20260508`) breaks the `_TABLE_SUFFIX` filter the SQL depends on.

That query excludes `navigation_type = restore` and `navigation_type = prerender` by default so the hosted report stays tied to normal load performance.

That query returns a single column:

- `signal_report_url`

Important:

- a saved query gives you a reusable query definition
- a scheduled query is what creates automatic refresh

## 7. Open And Share The URL

In BigQuery's result pane, the query returns one row with one column called `signal_report_url`. The cell contains the full hosted URL, e.g.:

```
https://signal.stroma.design/r?rv=1&mode=production&d=your-domain.com&nt=42,28,15,10,5&dt=20,55,25&...
```

**Click the URL string directly inside the result cell** to open the report in a new tab. If the cell appears truncated, click to expand it or use BigQuery's "Copy cell value" action — the URL is usually long enough that you'll want the full string, not the visually-cropped version.

That hosted `/r?...` URL is the launch artifact. It is the measured proof layer your team can share internally after enough real traffic has accumulated.

**Before you share it externally, check the sample-size band.** Look at the URL for the `&b=` parameter:

| Band            | What it means                                              | Sharing guidance                                                                    |
|-----------------|------------------------------------------------------------|-------------------------------------------------------------------------------------|
| `b=preliminary` | Fewer than 100 events captured                             | Internal sanity-check only. Do not share with stakeholders — numbers will move significantly as more data lands. |
| `b=provisional` | 100-499 events captured                                    | OK to share with a "preliminary, will firm up over the next week" caveat.            |
| `b=stable`      | 500+ events captured                                       | Production-ready. Share confidently. Tier dominance and p75 numbers are statistically meaningful at this scale. |

The hosted report renders the band in its cover section, but knowing the threshold up front prevents the "is it ready?" conversation later.

## 8. If SQL Is Blocked

Use [https://signal.stroma.design/build](https://signal.stroma.design/build) or the local `/build` route to:

- paste a `SignalAggregateV1` object and generate a URL
- or paste a final hosted report URL and validate the decoded summary

This is the QA and fallback path, not the primary warehouse automation path.
