# Operator Expectations

<img src="./images/signal-stroma-logo.png" alt="Signal" width="270" />

Read this **before installing Signal**. It's the one-page honest answer to "what am I signing up for?" — capture model, vendor quotas, costs, browser support, privacy posture. Linked from the README install path on purpose.

If your situation isn't covered here, [open an issue](https://github.com/jonnybmc/stroma-signal/issues) — gaps in this page are bugs.

---

## 1. What gets captured, and how often

Signal fires **one `SignalEventV1` per real document navigation** — when the browser tab becomes hidden (`visibilitychange`) or the page unloads (`pagehide`). This is the standard RUM pattern: it captures the full picture of the page lifetime, not a partial view at some arbitrary point.

| Site shape | Event coverage |
|---|---|
| **MPA** (multi-page app, server-rendered, e-commerce, CMS) | Every navigation is a real load → one event each → **full coverage** |
| **SPA with hard navigations** (some Next.js / SSR configs) | Each hard reload produces an event → full coverage |
| **SPA with client-side routing** (React Router, Vue Router, SvelteKit client nav, Next.js soft nav) | **Initial page load only.** Subsequent in-app route changes do NOT produce additional events |
| **Bfcache restore** (back/forward navigation) | Detected via `pageshow.persisted === true` → fresh event with new `event_id` |

Soft-navigation support inside SPAs is **not first-class in v0.1**. See [spa-ssr-caveats.md](./spa-ssr-caveats.md) for the full reasoning + what changes in v0.2.

**Practical rule of thumb**: if your `Sessions` count in GA4 is much higher than your Signal event count, you're seeing soft-nav-heavy traffic. Signal captures the entry, not the in-app journey.

---

## 2. Sampling

The SDK runs at **100% sample rate by default** — every real load that the lifecycle reaches produces an event. Tune via `init({ sampleRate: 0.5 })` to capture 50% (per-session decision, applied at runtime).

| Your monthly real-document loads | Recommended `sampleRate` |
|---|---|
| < 1M | `1.0` (default) — keep everything |
| 1M – 10M | `1.0` for first month while validating; consider `0.5` once you trust the data |
| 10M+ | `0.1` – `0.3` to stay under the GA4 free-tier sampling threshold (see §3) |
| 100M+ | `0.01` – `0.05`, or use the warehouse-direct path (§7) and skip GA4 entirely |

Sampling decisions are made **once per page load** — you either get the full event or no event, not a partial. This means quartiles in your aggregate stay statistically meaningful.

---

## 3. GA4 lane: known caps + sampling thresholds

If you're sending Signal events through GA4 (via the `dataLayer` sink + a GTM tag), three Google-side limits matter. Verify current limits on the [GA4 limits page](https://support.google.com/analytics/answer/9267744) — Google has been known to adjust these.

### 3a. The 25-custom-parameter-per-event cap (hard limit)

Every GA4 event can carry **at most 25 custom parameters**. Signal's GA4 helper (`@stroma-labs/signal/ga4`) ships a deliberately compact 24-field subset specifically to fit. **Do not add more custom params to the same `perf_tier_report` event in GTM** — anything beyond 25 is silently dropped by GA4.

**If a specific Signal field is missing in GA4 DebugView**, see the corresponding section in [launch-troubleshooting.md](./launch-troubleshooting.md). The most common cause is the field is warehouse-only (not part of the GA4 compact subset) — see the GA4 Compact Subset section in [signal-technical-reference.md](./signal-technical-reference.md).

### 3b. GA4 sampling in the reporting UI (BigQuery export is unaffected)

Standard GA4 (free) applies **per-request sampling in the reporting UI** once a request scans more events than its sampling threshold (the default is 10M events; the GA4 admin can lower this on individual requests). Sampling is a property of the *report request*, not a hard monthly cap on the property itself — so the figure you see in the GA4 UI may be a sampled aggregate even when the underlying property is well under 10M events / month if the request is unfiltered or spans a long window. **Raw BigQuery export is not sampled at all** — every event lands 1:1.

**This means:**
- For Signal's purposes, sampling in the GA4 UI is a non-issue: the URL-builder query reads BigQuery rows directly, never the GA4 reporting endpoint.
- If GA4-UI numbers and Signal-report numbers diverge for a comparable window, GA4 is the one being sampled.
- If you want sampling-free reporting in GA4 itself → that's GA4 360 territory ($150K+/year). Signal doesn't need that — it pulls from BigQuery directly.

### 3c. BigQuery export rate cap (free tier)

Standard GA4 exports to BigQuery **up to 1M events per day** for free, daily-batch (or near-real-time streaming, paid). Above 1M/day, you'd need GA4 360 OR live with the cap. If your `perf_tier_report` events exceed 1M/day on top of your existing GA4 traffic, lower Signal's `sampleRate` accordingly.

---

## 4. BigQuery costs

If you're running the Signal URL-builder query in BigQuery (any GA4 user with the export configured), there are two cost dimensions:

### Storage (typically negligible)

- Signal events are **~5 KB per row** in BigQuery (compressed)
- 1M events ≈ 5 GB ≈ **$0.10 / month storage** (first 10 GB free)
- 10M events ≈ 50 GB ≈ $1 / month
- 100M events ≈ 500 GB ≈ $10 / month

Storage cost is dominated by GA4's other event types, not Signal's contribution.

### Query (per URL refresh)

Signal's URL-builder query (`docs/ga4-bigquery-url-builder.sql`) **scans your perf-event partitions** for the chosen window (default 7 complete calendar days, excluding the in-progress day). Typical scans:

- 1M events / 7 days ≈ 1.2 GB scan ≈ **$0.01 / refresh** (first 1 TB / month free)
- 10M events / 7 days ≈ 12 GB scan ≈ $0.07 / refresh
- 100M events / 7 days ≈ 120 GB scan ≈ $0.70 / refresh

**Operating advice:** schedule the query **once a day, not on every dashboard view** — cache the resulting `signal_report_url` and serve it from your own surface (CDN, internal dashboard). See [production-report-automation.md](./production-report-automation.md).

If you're under the BigQuery free tier (1 TB scanned per month), Signal's query effectively costs zero.

---

## 5. Browser support matrix

Signal degrades gracefully — unsupported fields render as `null`, never as fabricated data. The classifier surfaces what it can defensibly measure.

| Field family | Chrome / Edge | Safari (macOS / iOS) | Firefox | Android WebView | Notes |
|---|---|---|---|---|---|
| `fcp_ms`, `ttfb_ms` (universal vitals) | ✅ all versions | ✅ all versions | ✅ all versions | ✅ | Always populated when measurable. |
| `lcp_ms`, `cls`, `inp_ms` (Chromium-only vitals) | ✅ all versions | ❌ not exposed | ❌ not exposed | ✅ | These fields are `null` on Safari and Firefox — Signal never fabricates metrics. Plan for a meaningful share of `null`s on iOS/macOS Safari traffic in particular. See [signal-technical-reference.md](./signal-technical-reference.md#vitals) for the canonical matrix. |
| `vitals.navigation_timing` (per-subpart breakdown) | ✅ all versions | ✅ Safari 14+ | ✅ all versions | ✅ | TLS isolation requires HTTPS |
| `vitals.loaf` (Long Animation Frame) | ✅ Chromium 123+ | ❌ not exposed | ❌ not exposed | ✅ Chromium 123+ | Field is `null` elsewhere |
| `lcp_attribution` (which element was LCP) | ✅ all | ❌ not exposed | ❌ not exposed | ✅ | Field is `null` elsewhere |
| `inp_attribution` (which interaction phase dominated) | ✅ Chromium 124+ | ❌ not exposed | ❌ not exposed | ✅ | Field is `null` elsewhere |
| `context.effective_type`, `downlink`, `rtt` (Network Information API) | ✅ all | ❌ not exposed | ❌ not exposed | ✅ | Browser-reported, often imprecise — not used for tier classification |
| `net_tier` (TCP-handshake substrate tier) | ✅ all | ✅ all | ✅ all | ✅ | Universal — derived from Navigation Timing, available everywhere |
| `device_*` (cores / memory / screen / hardware) | ✅ all | ⚠️ memory_gb absent | ⚠️ memory_gb absent | ✅ | Safari + Firefox deliberately don't expose `deviceMemory`; classifier handles `null` |

**Bottom line**: every field has a documented presence rule. The substrate-true axis (`net_tier`) is universal. The richer attribution + LoAF story is Chromium-biased — operators with mostly-iOS audiences will see those fields as `null`. That's honest, not broken.

---

## 6. Privacy + data ownership

Signal is engineered to be **zero-PII at the SDK level**. Specifically:

| Concern | Posture |
|---|---|
| **Cookies set by Signal** | None. Signal does not set cookies. |
| **PII captured by SDK** | None. No IP, no user ID, no email, no name, no UA string sent anywhere by the SDK. |
| **User-agent string** | Parsed for browser family bucket only (chrome / safari / firefox / edge / other). Full UA is NOT sent to your warehouse via the SDK. |
| **Geolocation** | Not captured. |
| **Cross-site tracking** | None. Signal does not correlate sessions across sites or visits. Each event is anonymous. |
| **GDPR / POPI / CCPA consent** | The SDK does not capture personal data, so it generally does not require consent under these regimes. **Consult your DPO** — if you transmit Signal events into a warehouse that already has user identifiers, the joined dataset may be subject to consent requirements. |
| **Data residency** | The SDK sends events to whatever sink you configure (your GA4 property, your beacon endpoint, your warehouse). Stroma does not receive any of your event data. |
| **The hosted `/r` report** | Encoded in the URL — anyone with the URL can view it. By design. Treat shareable report URLs the same way you'd treat a Google Sheet "anyone with link can view". |
| **The `/api/v1/intent` demand-signal endpoint** | When a reader of `/r` opens the closing modal and picks one of the four customer-lens choices (e.g. "I just want a fix list for this page"), Stroma receives the intent payload server-side (event kind + capture id + optional email + optional cadence / pill_id / freeform text). The email field is universally optional — capturing intent in aggregate is the primary purpose; email is the affordance for direct follow-up. User-agent is captured server-side for product-research purposes. Documented in the report's privacy posture. |
| **The `signal init` install wizard telemetry** | When a developer runs `npx @stroma-labs/signal init`, the CLI sends anonymous install telemetry to `api.stroma.design/api/v1/install` to help us prioritise framework support. We capture: framework + version, sink choice, sample rate, package manager, Node version, OS family, CLI version. We NEVER capture: project name, file paths, file contents, free text, emails, hostnames, full user-agent string. Disable per-run via `--no-telemetry`, persistent via `STROMA_TELEMETRY=0`, also honoured: `DO_NOT_TRACK=1` (industry standard). Auto-disabled in CI / non-TTY environments. IP addresses are not stored in `install_events`; Cloudflare's edge processes request IPs for routing and rate limiting (a property of any Cloudflare-hosted endpoint we cannot opt out of) — we do not log or persist them. |

The SDK is open-source MIT — you can audit every byte of what it captures. See [why-signal.md](./why-signal.md) for the design philosophy on what NOT to capture and why.

---

## 7. When NOT to use the GA4 lane

Use Signal's beacon path instead of GA4 if any of these apply:

- You're already over the GA4 10M-events-per-month sampling threshold and don't want to manage sample rates
- You want events to land in a warehouse outside Google's stack (Snowflake, ClickHouse, Postgres, BigQuery direct without GA4)
- You need access to the **full SignalEventV1 surface**, not the GA4 25-param compact subset (e.g., the rich `vitals.navigation_timing` block is warehouse-only)
- Your team's analytics stack doesn't include GA4 (some EU-headquartered teams have moved off GA4 for residency reasons)

Wire the beacon sink to your own collector:

```ts
import { init, createBeaconSink } from '@stroma-labs/signal';

init({ sinks: [createBeaconSink({ endpoint: '/rum/signal' })] });
```

Schema for the receiving endpoint: [collector-contract.md](./collector-contract.md).

---

## 8. Cost summary

For a typical operator running Signal at moderate scale:

| Item | Cost |
|---|---|
| `@stroma-labs/signal` SDK (MIT) | Free |
| `signal.stroma.design/r/...` hosted report | Free (Stroma-hosted, Cloudflare Pages) |
| `api.stroma.design/api/v1/intent` demand-signal endpoint | Free for current scale (no plans to charge for the free `/r` flow) |
| GA4 ingestion + BigQuery export (under 10M events / month) | Free (Google's free tier) |
| BigQuery storage at typical scale | < $1 / month |
| BigQuery query cost (one daily refresh) | < $0.50 / month under 10M events |
| **Total at typical scale** | **Effectively zero** — you pay only for your own hosting if you self-host the report |

At very high scale (100M+ events / month) or with frequent BigQuery scans, you'll start to see meaningful BigQuery costs. Sampling at the SDK level (§2) is the standard mitigation.

---

## 9. What can go wrong (preventive checklist)

Before going live, walk this list:

- [ ] You've decided whether your site is MPA / SPA-hard / SPA-soft and whether single-event-per-load coverage is sufficient (§1)
- [ ] You've sized your monthly traffic against the GA4 10M / BigQuery 1M-per-day caps (§3)
- [ ] You've decided on a `sampleRate` (default `1.0` is right for under 1M / month)
- [ ] You've checked browser-support implications against your audience mix — heavily-iOS audiences should expect `lcp_attribution` and `loaf` as `null` (§5)
- [ ] You've reviewed the SDK's privacy posture against your DPO's requirements (§6)
- [ ] You have a plan for refreshing the `signal_report_url` (manual via [first-successful-report.md](./first-successful-report.md), scheduled via [production-report-automation.md](./production-report-automation.md))
- [ ] If you're SPA + soft-nav-heavy, you've decided whether one-event-per-entry is enough or you'll wait for v0.2's `markRoute()` API ([RFC 0001](./rfcs/0001-soft-navigation-markroute.md) — comment now if the proposed shape doesn't fit your stack)

---

## 10. Where to go next

**For first-time operators:**
- [Marketer quickstart](./marketer-quickstart.md) — GTM-first, plain-English deployment in under an hour
- [First successful report](./first-successful-report.md) — the validation walkthrough
- [Launch troubleshooting](./launch-troubleshooting.md) — when something doesn't fire

**For engineers:**
- [Client integrations](./client-integrations.md) — three install paths with detail
- [Framework recipes](./framework-recipes.md) — React / Next / Vue / SvelteKit / Nuxt / Angular
- [SPA / SSR caveats](./spa-ssr-caveats.md) — the soft-nav reality

**For technical reference:**
- [Public API (v0.1)](./public-api-v0.1.md) — every export
- [Technical reference](./signal-technical-reference.md) — schema + thresholds
- [Aggregation spec](./aggregation-spec.md) — warehouse aggregation rules
- [Collector contract](./collector-contract.md) — beacon endpoint schema
- [Why Signal exists](./why-signal.md) — design philosophy + what was deliberately omitted
