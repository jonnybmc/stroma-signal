# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-release identifiers (e.g. `-rc.N`) are published to the npm `next`
dist-tag. The `latest` dist-tag is reserved for stable releases.

```
pnpm add @stroma-labs/signal@next            # latest pre-release
pnpm add @stroma-labs/signal@0.1.0-rc.2      # exact rc.2 pin
pnpm add @stroma-labs/signal                 # latest stable (when published)
```

Bump the exact pin example whenever a new `-rc.N` is cut so onboarders default to the freshest pinned snapshot.

## [Unreleased]

### Added (RC3 — Closing-section needs-inquiry router + intent-capture telemetry)

- `/r` closing section reframed from a single CTA card into a co-equal three-card needs-inquiry router + five-pill freeform demand-signal row, anchored on the boundary statement. Editorial register: question-led card titles, mono text-link CTAs, no accent backgrounds, no button chrome, no celebration confirmations. Visual register reads as a continuation of body content, not a sales footer. Pricing posture: every CTA is FREE at the click — pricing decisions get made post-demand-signal.
- Three intent-capture cards: (1) campaign-attribution-layer early access with optional email follow-up, (2) **Rapid Fix Plan** (logs intent then redirects to `stroma.design/book?service=rapid-fix`), (3) **Scheduled monitoring** with optional email + cadence (weekly/daily) follow-up.
- Five freeform pills capture demand we haven't yet productized: weekly inbox digest, multi-page report, multi-client portfolio rollout, competitor / market context, and "something else" (expands to a 200-char freeform field).
- New `SignalReportInteractionKind` values: `intent_pi_early_access`, `intent_rapid_fix`, `intent_monitoring`, `intent_freeform`. Plus optional payload fields `intent_capture_id`, `intent_stage` (initial / followup), `intent_email`, `intent_cadence` (weekly / daily), `intent_pill_id`, `intent_freeform_text` on `SignalReportInteractionV1`.
- New `SIGNAL_REPORT_INTERACTION_INGEST_URL_DEFAULT = 'https://api.stroma.design/api/v1/intent'` — canonical full URL for cross-origin sendBeacon delivery to the snapshot-engine's encapsulated `intent` feature module.
- Client-side telemetry via `apps/signal-report/src/intent-telemetry.ts` — uses `navigator.sendBeacon()` (avoids CORS preflight, survives navigation, critical for the Rapid Fix click which redirects after queueing). Stable client-generated `intent_capture_id` lets the server UPSERT initial-click + follow-up-email events into ONE demand-signal row.
- New `report-render-honesty.test.ts` guards scoped to the business section: 15 sales-register tokens (`unlock`, `upgrade to`, `pro`, `premium`, `transform`, `revolutionize`, `costing you r`, etc.) + 11 celebration tokens (`thanks!`, `you're in!`, `welcome!`, `choose your`, `three paths`, etc.) mechanically blocked across all 19 fixtures.
- New `intent-wire-format-fixtures.json` cross-repo drift detection — 10 representative payloads parsed by both the signal-contracts validator AND the stroma-snapshot-engine zod validator. CI fails on either side if the wire format drifts.

### Changed (RC3 — Tier Report `/r` visual + editorial refactor)

- **Layout**: `/r` rewrites the four-act horizontal slide deck as a five-section vertical scroll narrative (`cover` · `audience` · `distance` · `funnel` · `business`). New top scroll-spy nav, smooth-scroll TOC anchors, and a bottom reading-progress hairline. Section IDs are semantic (no more `data-act="N"` chrome).
- **Theme**: light default (warm cream paper aesthetic) with full dark parity via `[data-theme="dark"]`. Drops the prior data-driven mood/accent/density CSS variation system — one canonical accent (warm amber) carries every report; `mood_tier` stays on the view-model for editorial copy template selection only.
- **Typography**: Signifier pairing — Fraunces (display, serif wedge) + Schibsted Grotesk (sans) + JetBrains Mono (mono). Loaded via Google Fonts CSS2 import.
- **Editorial register**: tailored to the Paid-Media / PPC specialist and CMO. Glossary tooltips translate every Web-Vital into Paid-Media language with a "what this means for your KPIs" line keyed to CPC / Quality Score / ROAS / CAC / CPA. Body copy stays diagnostic; headlines never prescribe.
- `tier-report-design-spec.md` rewritten end-to-end for the new structure + register; `tier-report-design-spec-alignment.test.ts` updated in lockstep (64 tests covering section IDs, mood enum, funnel stages, thresholds, CTA name, theme posture, typography, layout model).
- BigQuery URL-builder SQL recipes (GTM and normalized warehouse paths) re-aligned with the canonical aggregator's bucketing, tie-break, and rollup logic. Existing decoded URLs keep behaving identically; future generations match authored-side numbers byte-for-byte.

### Added

- `apps/signal-report/src/glossary.ts` — typed glossary (14 keys: lcp / fcp / inp / ttfb / p75 / cohort / qs / roas / cac / cpc / cpa / poor / classified / renderdelay) used by `renderTerm()` for KPI-translation tooltips.
- `apps/signal-report/src/render-helpers.ts` — vanilla-TS Reveal / HeroValue / Term builders + boot helpers (`bootRevealObserver`, `bootCounterTweens`, `bootGlossaryPopovers`, `bootScrollSpy`, `bootReadingProgress`, `bootSmoothAnchors`).
- `apps/signal-report/src/sections/render-{cover,audience,distance,funnel,business}.ts` + `render-shell.ts` — one file per section + the outer scroll-narrative shell.
- `apps/signal-report/src/report-render-honesty.test.ts` — replaces the prior motion-payload guard. 399 generated tests across every fixture covering whole-doc forbidden tokens (revenue/monthly exposure/commercial diagnosis/asv/mts/zar + bid-down vocabulary) and headline+lede prescription verbs (recommend / you should / optimize / we suggest / the fix is / exclude / avoid).
- `ReportPersonaProfile.save_data_share` (number) — surfaces the per-tier Data Saver share so the renderer can claim "X% of this cohort is on save-data" instead of a binary flag. Sourced from existing `network_summary.save_data_share`; no warehouse schema change.
- `ReportAct4ImpactRow.glossary_key` (optional `'qs' | 'cpc' | 'cpa' | 'roas' | 'cohort'`) — anchors KPI-ledger rows to the right glossary tooltip term.
- `SignalRuntimeLogger` interface and four optional `SignalInitConfig` dependency-injection points (`clock`, `random`, `eventIdFactory`, `logger`). Defaults preserve current behavior; supply your own to make event timestamps, ids, and sample-rate gating deterministic, or to forward runtime warnings + debug info into your observability stack without monkeypatching `console`.
- `DEFAULT_NETWORK_THRESHOLDS` and `DEFAULT_DEVICE_SCORE_BOUNDARIES` exported from `@stroma-labs/signal-contracts` as the canonical numbers behind the network and device classifiers. Previously SDK-internal; promoting them to the contract package means the SDK and downstream renderers / docs derive the same boundaries from one source.
- `SignalDeviceScoreBoundaries` interface companion to the new `DEFAULT_DEVICE_SCORE_BOUNDARIES` constant.
- `formatNetworkBand(tier)` and `formatDeviceSignature(tier)` helpers for deriving the human-readable boundary copy (e.g. `< 50 ms TCP`, `6+ cores · 4+ GB · 1280px+`) from the canonical thresholds. Both accept an optional override block for custom calibration.

### Removed

- Canvas particle system (`apps/signal-report/src/report-motion.ts`, ~1400 lines) and its phase-orchestration scaffolding. Particles deferred indefinitely from RC3.
- Legacy markup builder (`apps/signal-report/src/report-markup.ts`, ~1450 lines) and the immersive CSS layer (`report-immersive.css`, ~4300 lines). Replaced by per-section render functions + lean tokens-v2 / scroll CSS.
- Mood-, accent-, and density-driven CSS variation system. The view-model still computes `mood_tier` to inform editorial copy template selection, but no longer drives visuals.

### Fixed

- `destroy()` on the sealed (sampled-out) runtime controller now releases the global singleton, so a subsequent `init()` spins up a fresh runtime. Previously a no-op that left the sampled-out shape pinned in `globalThis` for the page lifetime.

### Note

- `SignalAggregateV1` contract unchanged. URL codec unchanged. Warehouse schema unchanged. The `/r` refactor is a presentation-layer change — every numeric value still traces to a canonical aggregate field.

## [0.1.0-rc.2] - 2026-04-30

First publishable release candidate. Package contents identical to
`0.1.0-rc.1` (which did not reach the registry).

### Added

- `init()` runtime with automatic page-lifecycle collection
- `createBeaconSink()` for sending events via `sendBeacon` / `fetch` fallback
- `createCallbackSink()` for custom in-app handling
- `createDataLayerSink()` via `@stroma-labs/signal/ga4` for GTM / GA4 integration
- `createPreviewCollector()` via `@stroma-labs/signal/report` for local preview URLs
- `@stroma-labs/signal/summary` helper surface for plain-text summaries plus JSON/CSV export
- Device tier classification (cores, memory, screen width)
- Network tier classification (TCP round-trip from Navigation Timing)
- Web Vitals observation (LCP, INP, CLS) with attribution
- Chromium LCP subpart breakdown (`resource_load_delay_ms`, `resource_load_time_ms`, `element_render_delay_ms`) with all-or-nothing null discipline
- Chromium LCP culprit-kind classifier (`hero_image`, `headline_text`, `banner_image`, `product_image`, `video_poster`, `unknown`) on sanitized resource hints
- Chromium INP dominant-phase attribution (`input_delay`, `processing`, `presentation`) with deterministic tiebreak ordering
- Third-party pre-LCP script weight capture (`pre_lcp_script_share_pct`, `origin_count`) with eTLD+1 first-party classification, optional `firstPartyOriginsAllowlist` init hook, and privacy mask hiding origin counts below 3
- GA4 enum summaries: `lcp_culprit_kind`, `lcp_dominant_subpart`, `inp_dominant_phase`, `third_party_weight_tier`
- Aggregate stories surfaced in the hosted report: Act 2 LCP subpart narrative + micro-chart, Act 2 third-party pre-race headline (with positive narration when zero off-domain weight), Act 3 INP-phase inline caption
- Warehouse columns for LCP breakdown, culprit kind, INP phase, third-party share/origin count
- Chromium 123+ Long Animation Frame capture (`vitals.loaf.worst_duration_ms`, `dominant_cause`, `script_origin_count`) using `PerformanceObserver('long-animation-frame')`; retains only the worst-duration frame per session (running max) for bounded memory
- Aggregate `loaf_story` with dominant-cause share, p75 worst-frame duration, and observation-threshold gating (25 observations minimum, 35% dominance hedge)
- Act 3 inline LoAF narrative line beneath the INP funnel caption — never claimed when the INP funnel stage itself could not be defended
- Warehouse column `loaf_dominant_cause` (CSV column 45, positional lock: immediately before `context_visibility_hidden_at_load`)
- Background-tab visibility filter: `context.visibility_hidden_at_load` captured per event; default aggregation pre-filters background-tab loads from every percentile, share, and accumulator
- `coverage.raw_sample_size` and `coverage.excluded_background_sessions` preserved so the report credibility strip can narrate the exclusion transparently (invariant: `raw_sample_size === sample_size + excluded_background_sessions`)
- Marginal-coverage warning (`coverage_marginal`) emitted when the LCP cohort lands within 10% / 10 observations of the ship thresholds; credibility strip renders *"coverage at the defensible edge"* so readers temper their read
- Report URL byte budget assertions in `encodeSignalReportUrl`: soft limit (2048 bytes) pushes `signal_report_url_exceeds_soft_limit` warning; hard limit (4096 bytes) throws
- Named constants for threshold tuning: `SIGNAL_COVERAGE_MARGINAL_THRESHOLD_PCT`, `SIGNAL_COVERAGE_MARGINAL_THRESHOLD_OBS`, `SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT`, `SIGNAL_REPORT_URL_SOFT_LIMIT_BYTES`, `SIGNAL_REPORT_URL_HARD_LIMIT_BYTES`
- Warehouse column `context_visibility_hidden_at_load` (CSV column 46)
- Back/forward cache restore and prerender-aware lifecycle
- Sample rate support
- Frozen data contracts (`SignalEventV1`, `SignalAggregateV1`)
- URL codec for hosted report state
- GA4 event flattening
- Aggregation rules with percentile bucketing
- Hosted report shell and zero-code builder app
- Proof-of-life spike lab with local collector
- Playwright E2E tests across Chromium, Firefox, and WebKit
- Bundle size budgets, import boundary checks, and export validation

### Changed

- release metadata and docs now align to the canonical `jonnybmc/stroma-signal` repository
- npm packaging excludes sourcemaps while keeping local build sourcemaps enabled
- contributor installs now fail fast on unsupported Node versions via root `engine-strict=true`
- Act 2 race-bar motion no longer animates when `urban_ms` or `comparison_ms` is null — static render replaces the hardcoded `2100ms`/`3400ms` fallback so viewers cannot infer magnitude from decorative motion
- Default report math now also excludes `context.visibility_hidden_at_load = true` rows alongside the existing `navigation_type = restore` / `navigation_type = prerender` filter; both BigQuery URL-builder recipes updated (the normalized recipe emits `rs`/`xb` params; the GA4 recipe documents the asymmetry — visibility is warehouse-only)

### Removed

- **Breaking:** `meta.nav_type` has been dropped from `SignalEventV1`, the GA4 flatten (`nav_type` param), the normalized warehouse row (`nav_type` column), the GTM recipe / workspace template, and the BigQuery SQL recipes. Use `meta.navigation_type` — identical semantics, wider browser coverage (includes `prerender` and `restore`, which the legacy field could not represent). Consumers pinned to the old column must migrate the warehouse SELECT list, any GA4 custom-definition mappings, and any DLV references before upgrading to 0.1.x.

### Security

- strengthened collector and warehouse guidance around validation, dedupe, rate limiting, privacy retention, and access control
