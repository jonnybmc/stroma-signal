# Tier Report Design Spec

This document is the canonical design and product specification for the hosted Signal Tier Report.

If an older plan, PRD note, or external draft disagrees with this file, this file wins for the live report artifact.

## Product Role

The Tier Report is a first-class Stroma product surface.

Its job is to:

- make measured user experience visceral for the Paid-Media / PPC specialist and the CMO who owns CAC, ROAS, and Quality Score
- create urgency from real traffic evidence
- translate measured Web Vitals into Paid-Media KPI consequence — without prescribing remediation
- stop before diagnosis, attribution, and commercial modelling

The Tier Report is not a diagnostic, attribution, or commercial modelling artifact.

It proves the existence and shape of the experience gap. It does not explain root cause, quantify business exposure in money terms, or prescribe remediation.

It is the measured proof layer that sits on top of:

- the browser instrumentation package
- the warehouse and URL-builder workflow

The report is a complete, standalone artifact. Its job is to make the experience gap visible and credible enough that a team can take it into a quarterly business review or sprint planning conversation and act on it from the report alone — no follow-on engagement is required for the report to be useful.

## Editorial Register

The reader is a Paid-Media / PPC specialist or CMO under pressure from rising CAC, soft ROAS, and AI-driven bid opacity. The register is **operator-empathetic, educational, never prescriptive**:

- Body copy stays diagnostic — it names what is observed.
- Glossary tooltips translate every Web Vital into Paid-Media language: a `plain` definition + a `cmo` line that explains the KPI consequence (e.g., "Slow LCP is the #1 reason Google lowers your Landing Page Experience score, which raises CPC and shrinks ad reach").
- Headlines never prescribe (`recommend` / `you should` / `optimize` / `the fix is` are forbidden in headline + lede slots).
- Action vocabulary stays in the **reroute / reshape / split** family (per `feedback_actionability_discipline`). Exclusionary or bid-down language is forbidden anywhere in the artifact (`exclude`, `avoid`, `bid down`, `lower CPC ceilings`, `the user was on 3G`).

## Layout Model

The report is a **vertical scroll narrative**, not a horizontal slide deck.

- Five stacked sections (`cover`, `audience`, `distance`, `funnel`, `business`).
- Each section opens with an `act-intro` block sized to ~78dvh (cover ~88dvh) so the next block visibly peeks at the bottom and invites scroll instead of forcing a second screen of empty air.
- A fixed top nav exposes a scroll-spy table of contents (`00 Cover` / `01 Audience` / `02 Distance` / `03 Funnel` / `04 Business`).
- A bottom reading-progress hairline tracks `window.scrollY` against `documentElement.scrollHeight`.
- Adjacent sections alternate between `paper` and `cream` background tones to mark chapter breaks.

## Theme

- **Light default** — warm cream paper aesthetic. Canonical look for the artifact.
- **Dark parity** — supported via `[data-theme="dark"]` attribute on the report root.
- A single canonical accent (warm amber, Signifier-tuned) drives all KPI cameos, ledger highlights, glossary cues, and the reading-progress fill. **No data-driven mood/accent/density CSS variation** — language and tone carry the editorial mood; the visual stays one consistent voice.

## Typography (Signifier pairing)

- **Display** — Fraunces (variable serif, opsz 144, SOFT 30, WONK 0). Used for hero numbers, act headlines, section titles.
- **Sans** — Schibsted Grotesk. Used for body copy, ledes, captions.
- **Mono** — JetBrains Mono. Used for eyebrows, scroll-spy chrome, KPI pills, footer metadata.

Loaded via Google Fonts CSS2 import with `<link rel="preconnect">` to `fonts.googleapis.com` + `fonts.gstatic.com`.

## Narrative Structure

The report is a five-section narrative artifact.

### Section `cover` (`Act 00`)

Editorial masthead.

- Origin hero (the customer's domain).
- Sessions counter + measurement window + classified share.
- A short lede that names what the report makes visible — and where it leaks back into CPC, ROAS, and CAC (terms hyperlink to glossary tooltips).
- A three-card "At a glance" KPI strip (slower-than-urban share / sessions measured / measurement window).
- A tier-preview strip that visually previews the audience split before the user scrolls into Audience.

### Section `audience` (`Act 01`)

Audience shape.

It visualises:

- network distribution across `urban`, `moderate`, `constrained_moderate`, `constrained`, and `unknown`
- device distribution across `high`, `mid`, `low`
- form-factor split across mobile / tablet / desktop (lives inside the section body, not in a fixed footer)
- a persona-pair contrast (best-connected vs most-constrained) showing real hardware signals (CPU cores, memory, browser, RTT, save-data share)
- sample size and classified-share honesty inline

The emotional goal is population awareness. The viewer should feel that the traffic is made of materially different user conditions, not one average.

### Section `distance` (`Act 02`)

The measured race between `urban` and the selected `comparison_tier`.

The renderer does not choose the race metric. The aggregate chooses it using the documented fallback cascade.

This section must always:

- name the active metric explicitly
- surface fallback reasons explicitly
- keep coverage honesty visible
- treat the visual page representation as schematic, not a reconstruction of the live page

It carries:

- the race-devices block (two phone-frame lanes filling at real wall-clock duration; a wait-delta counter between them tweens to the measured ms gap)
- an LCP subparts breakdown showing where the gap actually lives (TTFB / load delay / load time / render delay)
- a Paid-Media impact block ("for paid media, what this delta costs you") translating into Quality Score impact, CPC pressure, and mobile bounce — terms anchored to the glossary

If the landing/footer compresses coverage honesty into one compact comparison number, it must use the weaker measured side of the race rather than the stronger one.

### Section `funnel` (`Act 03`)

A measured experience funnel.

It is not a revenue funnel, conversion funnel, or exposure model.

The funnel stages are:

- `fcp`
- `lcp`
- `inp` when coverage is defensible

The aggregate owns stage activation. The renderer does not invent missing stages.

The language boundary is strict:

- say sessions crossed into poor performance territory using explicit metric thresholds
- do not claim the report has measured abandonment, conversion loss, or commercial value

Thresholds:

- FCP poor: `> 3000ms`
- LCP poor: `> 4000ms`
- INP poor: `> 500ms`

The section should still feel embodied. The visual and copy should communicate that sessions become late, then visibly late, then interaction-ready too late. It must not collapse into a clinical threshold table.

### Section `business` (`Act 04`)

The closing section.

It restates what the report has already proven — who is affected, how far apart the experience is, where performance becomes poor — and names where each measured number lands in the reader's KPI vocabulary (Quality Score, CPC, CPA, ROAS, Audience Reach).

The KPI ledger is rendered from `act4_impact_rows` — each row carries a measured `metric_value`, a `kpi_label` cameo, an `impact_sentence_html` body, and an optional `glossary_key` anchor. Rows are emitted only when underlying aggregate evidence supports them (per the act4-impact builder gates). When fewer than two rows qualify, the renderer falls back to flat `act4_summary_points` bullets so the artifact never ships an anaemic one-row ledger.

After the ledger, the section closes with a **needs-inquiry router** — three co-equal cards + a multi-select demand-signal dropdown, anchored on the boundary statement. Visual restraint is load-bearing: the router uses the same `.figure` token surface as the rest of the section (no accent backgrounds, no button chrome on CTAs, hairline-pill submit buttons, hairline-bottom-only email inputs). Editorial register is needs-inquiry — every card title reads as a natural answer to the bridge question ("See which campaigns this affects.", "Get a fix list for this page.", "Run this report on a schedule."), declarative-imperative, never a packaged offer. Confirmations stay in observation register (`✓ thanks — we will let you know when it ships`, never `You're in!` or `Welcome!`).

The three cards capture latent demand for, in order:

1. **Campaign-attribution layer early access** (`intent_pi_early_access`) — joins substrate × spend × conversions; not yet shipped, free at click; collects optional email follow-up.
2. **Rapid Fix Plan** (`intent_rapid_fix`) — Stroma consulting engagement. Click logs intent then redirects to the booking page on `stroma.design`. Project-scoped pricing disclosed only on the booking page, never on the card.
3. **Scheduled monitoring** (`intent_monitoring`) — automated weekly/daily report regeneration; not yet shipped, free at click; collects optional email + cadence follow-up.

The five pills capture freeform demand we haven't yet productized: weekly-inbox digest of this domain, multi-page reports for the same domain, multi-client / portfolio rollout, competitor / market context, and "something else" (which expands inline into a 200-char freeform text field).

Every CTA emits a `SignalReportInteractionV1` event with the relevant `intent_*` kind via `navigator.sendBeacon()` to `https://api.stroma.design/api/v1/intent` (the snapshot-engine ingest endpoint). Server-side persistence + observability live in the `stroma-snapshot-engine` repo's `src/features/intent/` module — fully encapsulated, deletable in a single mount-call removal. A stable client-generated `intent_capture_id` UPSERTs initial-click + follow-up-email events into one demand-signal row.

**Pricing posture**: every CTA is FREE at the click. Pricing decisions get made post-demand-signal, not pre-data — the artifact must never feel like a paywall lobby.

## Truth Boundary

The report may show only:

- measured audience shape
- measured experience gap
- measured poor-performance progression
- measured KPI translation (educational consequence — never prescription)
- explicit coverage and fallback honesty

The report must not show:

- revenue estimates
- monthly exposure figures
- vendor attribution
- root-cause ranking
- sprint plans
- commercial diagnosis

The report must not contain (in headlines or ledes):

- prescription verbs (`recommend`, `optimize`, `you should`, `we suggest`, `the fix is`)
- bid-down or exclusion language (`bid down`, `lower CPC ceilings`, `lower bids`, `exclude`, `avoid`)

These constraints are enforced mechanically by `report-render-honesty.test.ts`.

## Contract Ownership

This design spec does not own the browser event schema or URL parameter list.

Canonical contract ownership lives in:

- [public-api-v0.1.md](./public-api-v0.1.md)
- [signal-technical-reference.md](./signal-technical-reference.md)
- [aggregation-spec.md](./aggregation-spec.md)

This design spec owns the presentation and product boundary of the report artifact.

## Required Data Capabilities

The report depends on these aggregate capabilities:

- network distribution including unknown share
- device distribution
- sample size and period
- coverage honesty metrics
- selected `comparison_tier`
- selected `race_metric`
- explicit `race_fallback_reason`
- top-page path hint
- additive measured `experience_funnel` data for the funnel section

The additive `experience_funnel` block must include:

- `active_stages`
- `measured_session_coverage`
- `poor_session_share`
- stage thresholds
- per-tier coverage and poor-share summaries for classified tiers

## Visual Direction

The visual system feels like a presentation-grade narrative document, not a monitoring console.

The report should feel closer to a premium editorial artifact (long-form essay; sprint review handout; QBR appendix) than a real-user-monitoring dashboard.

Truth must remain more visible than atmosphere. Cinematic presentation is only valid when the evidence layer stays obvious and challengeable.

The visual source of truth is `stroma.design`, but the report implements that direction through a report-owned token layer (`report-tokens-v2.css` + `report-scroll.css`) rather than ad hoc copied values.

Primary vocabulary:

- editorial typography (serif display, geometric sans, monospace metadata)
- vertical reading rhythm (chapter breaks, alternating tones, scroll-spy)
- temporal comparison (race-devices, race counter)
- staged progression (funnel bars filling on reveal)
- KPI translation (glossary-anchored cameos)

Allowed secondary vocabulary:

- compact labels
- small coverage chips
- simple bars where they improve comprehension
- KPI pills tying measured numbers to the reader's domain language

Avoid:

- axes
- chart frames
- legends
- dashboard chrome
- canvas particle effects (deferred indefinitely from RC3; revisit only on explicit product decision)
- anything that looks like generic BI output

## Mood System

The same five sections render for both negative and positive cases.

The renderer may shift:

- copy tone (which editorial template a headline / lede / boundary statement uses)
- which Act 4 KPI ledger rows are surfaced

But it must not change:

- the report's measured contract
- the canonical visual look (one accent, one typography pairing, one density)
- and it must not invent a separate "good case" product

Editorial moods (informs copy template selection only — never CSS):

- `urgent` for severe measured gap and high poor-session share
- `sober` for meaningful but not severe measured conditions
- `affirming` for low gap and low poor-session share

Positive cases should feel controlled and reassuring, not artificially dramatic.

## Reduced And Legacy States

The report must degrade honestly.

### Reduced measured funnel

If later-stage coverage is too weak:

- keep the funnel section
- reduce the active stages
- say why in plain language

### Legacy URL state

If an older `rv=1` URL predates the additive funnel block:

- keep the cover, audience, and distance sections working
- render the funnel section as a safe reduced legacy state
- tell the viewer to regenerate the URL for the measured experience funnel

## CTA Boundary

The report is a proof artifact, not a consulting deliverable.

The single closing-section CTA — `Rapid Fix Plan` — pinpoints the landing pages and routes carrying the most drag and returns a sequenced fix order. It is a Stroma consultancy engagement, opt-in, and explicitly framed as optional: a team should be able to take the report alone into a sprint review and act on it.

The closing section must close the evidence journey cleanly:

- who is affected
- how far apart the experience is
- where performance becomes poor
- which KPIs the measured gap lands in — and where to find help if they want it

## Drift Rules

The report product surface must stay aligned with:

- the hosted route at `https://signal.stroma.design/r`
- the canonical package name `@stroma-labs/signal`
- the additive `rv=1` report contract

## Validation Expectations

Changes to the report surface should be validated together across:

- aggregate generation
- report URL encoding/decoding
- BigQuery SQL templates
- `/build` summary behavior
- `/r` rendering
- smoke and e2e tests
- deterministic visual snapshot tests
- forbidden-words / prescription-verb guards

The goal is simple:

a team that opens the URL sees a coherent, honest, presentation-grade narrative artifact that names the experience gap, translates it into the Paid-Media KPIs they own, and lets them act on it without commissioning further work.
