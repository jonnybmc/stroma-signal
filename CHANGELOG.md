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

- `vitals.navigation_timing` block on `SignalEventV1` — decomposes the full PerformanceNavigationTiming entry into named subparts (DNS / TCP / TLS / redirect / SW / request-to-first-byte / request-to-final-headers / response-download / interim-to-final-response), three named TTFB definitions (`nav_ttfb_ms`, `connection_ttfb_ms`, `activation_adjusted_ttfb_ms` clamped ≥ 0 for prerender), raw anchor timestamps for 103 Early Hints awareness (`first_interim_response_start_ms`, `final_response_headers_start_ms`), protocol + payload metadata (`next_hop_protocol`, `transfer_size`, `encoded_body_size`, `decoded_body_size`, `content_encoding`), and a `provenance` sub-block (`early_hints_present`, `activation_adjusted`, `timing_redacted_suspected`, `delivery_type`, `response_status`). Per-subpart `null` vs `0` discipline preserved (cached DNS, reused connection, no redirect = meaningful zeros). The block is preserved across prerender so backend timing visibility survives.
- `SignalNavigationTimingStory` aggregate block — per-subpart quartile summary with observation counts (so quartile honesty survives reused-connection bias on DNS/TCP/TLS), strict-denominator dominant TTFB subpart (only events where every comparable subpart is non-null contribute), `next_hop_protocol_histogram`, and `provenance_roll_up` (each share with its own observed-denominator).
- 24 new warehouse columns mirroring the breakdown — warehouse-only; the GA4 lane is unchanged at 24 fields.
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

- Documentation framing of `net_tier` softened to acknowledge it as "connection-setup tier when isolatable" rather than overclaiming as "network speed cohort." `net_tier` field name + behavior unchanged; consumers see no breaking change. The richer subpart picture lives in the new `vitals.navigation_timing` block.
- Canvas particle system (`apps/signal-report/src/report-motion.ts`, ~1400 lines) and its phase-orchestration scaffolding. Particles deferred indefinitely from RC3.
- Legacy markup builder (`apps/signal-report/src/report-markup.ts`, ~1450 lines) and the immersive CSS layer (`report-immersive.css`, ~4300 lines). Replaced by per-section render functions + lean tokens-v2 / scroll CSS.
- Mood-, accent-, and density-driven CSS variation system. The view-model still computes `mood_tier` to inform editorial copy template selection, but no longer drives visuals.

### Fixed

- `destroy()` on the sealed (sampled-out) runtime controller now releases the global singleton, so a subsequent `init()` spins up a fresh runtime. Previously a no-op that left the sampled-out shape pinned in `globalThis` for the page lifetime.

### Note (Navigation Timing)

- `SignalNetTcpSource` union UNCHANGED. The new navigation-timing provenance flags live on `vitals.navigation_timing.provenance.*` because they are independent telemetry-quality flags, not TCP-classifier source values.

### Added (RC3 — Brand surfaces, palette anchor, persona-card paid-media qualifiers)

- New `--brand: #556700` token (Signal logo olive) plus `--brand-soft` (10% alpha tint) and `--brand-strong` (#3d4a00) for emphasis. New `.brand-text` utility uses `var(--brand)` as a solid color (replaces the prior `.duotone-text` accent→cyan gradient — off-brand against the warm-cream paper surface). Used for all editorial headline highlights inside `<h2>` titles.
- Signal logo (`docs/images/signal-stroma-logo.png` — 108×34 green-square mark) now appears in the sticky top nav alongside a mono-small "by Stroma" sub-text. The wave-motif full lockup (`signal-stroma-logo_1.png` — 368×112 RGBA with "BY STROMA" baked in) replaces the prior small mark in `README.md` + 4 public-facing docs (`why-signal.md`, `client-integrations.md`, `production-report-automation.md`, `marketer-quickstart.md`) — higher fidelity at doc display sizes + proper transparency on GitHub white background.
- New `bootShareCopy()` in `render-helpers.ts` — restores the "copy report link" affordance in the footer (incidentally lost in the RC3 vertical-scroll rewrite). Uses `navigator.clipboard.writeText(window.location.href)` → flips label to "✓ copied" → reverts after 2s. Mono small text-link, no button chrome — matches the RC3 visual restraint discipline.
- New persona-card paid-media qualifier system in `apps/signal-report/src/view-model/builders/persona-paid-media-notes.ts`. Pure functions (`effectiveTypeNote`, `bandwidthNote`, `rttNote`, `coresNote`, `memoryNote`) take the canonical bucket key / numeric value the persona builder already has and return a 2–5 word qualifier framed for the Paid-Media operator. Five new optional fields on `ReportPersonaProfile` (`effective_type_note`, `downlink_note`, `rtt_note`, `cores_note`, `memory_note`) — renderer composes "value · qualifier" via a small helper, with the qualifier toned to `--ink-mute`.
- `formatNetworkBand(tier)` enriched: leads with a plain-English real-world equivalent then trails with the threshold (e.g. `fast 4G / fibre · < 50 ms TCP` instead of bare `< 50 ms TCP`). Same `--bar-scale` derivation drives the network-spread tier tables AND the persona-card NETWORK row, single source of truth.
- New `<h3>` semantic level for sub-section headings (Network spread / Device spread / Form factor / At a glance / Stage progression / Per-stage detail / Context that shapes the experience / persona section eyebrow / metric race header / business section eyebrow). Eleven sites converted from `<div class="section-eyebrow">` to `<h3 class="section-eyebrow">` to give screen readers proper sub-section navigation.
- New `aria-labelledby` on each `<section>` pointing to either `cover-heading` (cover only — the page's single `<h1>`) or `{section}-eyebrow` (the stable "Act 0X · …" label on the four other sections). Section landmarks now announce a meaningful name when AT users navigate by landmark.
- New `role="status"` on the closing-card and multiselect-form confirmation slots — when state flips to "logged" via `intent-telemetry.ts`, the `✓ noted — we will be in touch` text is announced via the implicit `aria-live="polite"` + `aria-atomic="true"` semantics. `aria-live="polite"` also added to the share-copy footer button so the "✓ copied" text-content change announces.
- New `<table>` semantic for the network-spread + device-spread tier tables in Act 01 — `<thead>` + `<tbody>` + `<tr>` + `<th scope="col">` + `<td>` with `display: grid` on the table + `display: contents` on table parts. Native tabular semantics for screen readers + grid layout for visual control. AT users can navigate cells via Cmd+Option+Arrow with proper header announcement.
- New `font-variant-numeric: tabular-nums` on `.hero-value-num` and `.hero-value-unit` — counter tweens (`bootCounterTweens` writes `.textContent` 40+ times during the 720ms count-up) no longer shift sibling text width. Estimated CLS −0.04 to −0.08 on slow networks where RAF frames batch unevenly.
- New `<link rel="preload" as="style">` for the Google Fonts CSS request in `r/index.html` — boosts the request to "Highest" priority. Fraunces (the LCP candidate for the hero `<h1>`) starts downloading sooner. Estimated −100 to −200 ms LCP on 4G p75 globally.
- New `inputmode="email"` on the closing-card email input + explicit `id` / `for` association between the `<label>` and the input (belt-and-braces alongside the existing implicit-wrap label semantics) for AT compatibility + mobile-keyboard layout hints.
- New `Content-Security-Policy` + `Referrer-Policy` meta tags on `r/index.html`. CSP blocks framing (`frame-ancestors 'none'`), restricts XHR/fetch/sendBeacon to self + `https://api.stroma.design` (the snapshot-engine intent endpoint), and restricts form submissions to self + `https://www.stroma.design` (the Rapid Fix booking redirect). Defense-in-depth on top of the consistent `escapeHtml` discipline at every template-literal interpolation.

### Changed (RC3 — Iterative editorial polish, plain-English copy, brand cohesion)

- PI-card body rewritten in plain operator vocabulary — dropped "substrate" / "join" / "campaign-side question" SQL/engineering jargon in favour of the same problem→solution→status pattern the Monitoring card uses ("This report shows the gap, but it does not tell you which specific campaigns or audiences are most exposed to it. We are working on a separate tool that links this report to your ad-platform data. Not built yet — collecting interest first."). PI + Monitoring CTAs unified to "Keep me posted" (was "Tell me when it ships"). Confirmation copy "✓ noted — we will be in touch" (was "✓ thanks — we will let you know when it ships"). Removes the "Signal as freemium teaser" frame for npm-discovered SDK readers who have no Stroma brand context.
- AI-cadence sweep across the editorial registry — removed rule-of-three "first…again…and finally" + "stage by stage" closer + double-em-dash parentheticals + appended "and where a deeper engagement starts" salesy tails. Em-dashes preserved only where they carry actual rhetorical weight (single "however" pivots in headlines, definitional expansions in glossary).
- `weekly_inbox` pill removed from the closing-section multiselect dropdown — duplicated the Monitoring card's demand signal at lower fidelity (no email, no cadence). `pill_id 'weekly_inbox'` removed from the `IntentPillId` union, the zod validator, and the cross-repo drift fixtures. The SQL CHECK constraint in snapshot-engine keeps `weekly_inbox` as a permissive dead value (SQLite ALTER doesn't drop CHECK; rebuilding the table for one removed enum value isn't worth the migration risk).
- Network-spread + Device-spread tables in Act 01 now use the canonical `formatNetworkBand()` / `formatDeviceSignature()` helpers — replaces local hardcoded `criteriaForTier()` / `deviceCriteriaFor()` functions that had silently drifted in punctuation (`< 50ms TCP` no-space vs the helper's `< 50 ms TCP` with-space).
- Top sticky nav simplified — dropped the `/ r /` route-jargon span and the `{domain}` mute text. Logo + the contextual cover h1 establish scope; in-nav domain was redundant chrome.
- Footer collapsed to a flex `space-between` — meta strip ("generated DATE · N sessions · D day window") flush left at the section-padding edge, "copy link" button flush right. The Signal logo no longer renders in the footer (sticky header carries the brand persistently). Mobile (<640px) stacks vertically center-aligned.
- Cover scroll-cue (animated "scroll" hairline below the hero) removed — the full-viewport cover height + the natural scroll affordance of a long-form report makes the prompt unnecessary. `.section-inner > .act-intro + *` margin compensation tightened from `-0.5 * --stack-xl` → `-1 * --stack-xl` so the next block lands closer to the centered hero.
- Closing-card titles + small_note hedges trimmed — small_note set to null on all three cards (the card titles + bodies + CTAs already carry their own honesty, footnote hedges read as redundant disclaimers).
- Persona-card NETWORK row no longer wraps in the constrained-cohort variant — dropped the redundant tier-name prefix (already visible in the persona-card header + the Network Spread table at the top of the section), keeping just `{qualifier} · {threshold}` which is unambiguous on its own.

### Fixed (RC3 — A11y, perf, contrast, layout)

- Editorial section headlines demoted from `<h1>` to `<h2 class="section-title">` so the cover hero is the only `<h1>` on the page (was 5 h1s — one per section). Honesty test still scans `<h2 class="section-title">` headlines for forbidden tokens. CSS `.act-intro h1` selector extended to `.act-intro h1, .act-intro h2` so the demoted h2s preserve the large display styling.
- `bootScrollSpy` no longer attaches a scroll/resize fallback listener when `IntersectionObserver` is available — the manual `probe()` was running `getBoundingClientRect()` on every section every scroll event in parallel with the observer (300 forced layout recalcs/sec). Modern browsers always have the observer; the fallback now only attaches for browsers without it (effectively zero in 2026).
- `bootReadingProgress` caches `scrollHeight - innerHeight` once per resize instead of recomputing per scroll-RAF — `scrollHeight` is layout-reading; reading it 60×/sec forced synchronous layout whenever DOM was dirty (reveal animations, glossary popovers, intent-card flips).
- Funnel bar fill animates `transform: scaleX()` (compositor-only) instead of `width:` (layout-triggering) — preserves the visual exactly while shaving ~80–120 ms render cost per funnel reveal on slow Android. `--bar-w` (percentage) → `--bar-scale` (unitless 0–1) in the funnel renderer to match scaleX's expected unit. `prefers-reduced-motion` disables the bar transition.
- `--ink-faint` (#b3ad9e ≈ 2:1 contrast on cream — fails WCAG AA hard) swapped to `--ink-mute` at three live text sites (TOC numerals "00 01 02 03 04" in sticky nav, funnel stage prefix numerals, closing-card-note rule). `--ink-faint` token comment updated to flag decorative-only constraint so future contributors don't reach for it as a text color.
- `prefers-reduced-motion` now also disables the `.scroll-progress-fill` transition.
- Persona-card paid-media row composition (`composeRowValue`) wraps the qualifier in a `<span class="row-note">` toned to `--ink-mute` so the technical value reads first.
- Lint blockers cleared for CI: `useLiteralKeys` (12 dataset bracket-key access sites in `intent-telemetry.ts` + 1 in `render-helpers.ts`), `noNonNullAssertion` (rand[6]/rand[8] in the crypto.randomUUID fallback rewritten with `?? 0`), unused `viewModel` parameter on `renderTopNav` removed.

### Note (RC3 follow-up)

- `SignalAggregateV1` contract unchanged. URL codec unchanged. Warehouse schema unchanged. All RC3 follow-up work is presentation-layer + a11y + perf + brand surface — every numeric value still traces to a canonical aggregate field.
- `intent-capture` feature module on `stroma-snapshot-engine` is deployed and live at `https://api.stroma.design/api/v1/intent` (POST, sendBeacon-friendly) + `/api/v1/intent/stats` (GET, Bearer-token gated). Per-IP rate limit of 30 req/hr on POST via the existing Upstash Ratelimit middleware (separate `intent_rl` Redis prefix from scan).
- Security audit (a11y + semantic HTML + perf + XSS data-flow review) found zero exploitable XSS — `escapeHtml` consistently applied at every template-literal interpolation, codec input is whitelist-validated, no `innerHTML` with unsanitized data. CSP meta tag added as defense-in-depth.

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
