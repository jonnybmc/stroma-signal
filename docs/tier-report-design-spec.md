# Tier Report Design Spec

This document is the canonical design and product specification for the hosted Signal Tier Report.

If an older plan, PRD note, or external draft disagrees with this file, this file wins for the live report artifact.

## Product Role

The Tier Report is a first-class Stroma product surface.

Its job is to:

- make measured user experience visceral
- create urgency from real traffic evidence
- stop before diagnosis, attribution, and commercial modelling

The Tier Report is not a diagnostic, attribution, or commercial modelling artifact.

It proves the existence and shape of the experience gap. It does not explain root cause, quantify business exposure, or prescribe remediation.

It is the measured proof layer that sits between:

- the browser instrumentation package
- the warehouse and URL-builder workflow
- the broader Stroma engagement layer, where the proven gap is taken into commercial and remediation work

## Narrative Structure

The report is a four-act artifact, not a dashboard.

### Act 1: Who Are Your Users?

Act 1 shows audience shape.

It visualises:

- network distribution across urban, moderate, constrained moderate, constrained, and unknown
- form-factor split across mobile / tablet / desktop (buyer-first audience fact, surfaced in the persistent footer above the credibility strip)
- sample size
- days collected
- classified versus unclassified share
- connection reuse share
- LCP coverage
- freshness provenance when known

The emotional goal is population awareness. The viewer should feel that the traffic is made of materially different user conditions, not one average.

### Act 2: How Far Apart Are Their Experiences?

Act 2 shows the measured race between:

- urban
- the selected `comparison_tier`

The renderer does not choose the race metric. The aggregate chooses it using the documented fallback cascade.

Act 2 must always:

- name the active metric explicitly
- surface fallback reasons explicitly
- keep coverage honesty visible
- treat the visual page representation as schematic, not a reconstruction of the live page

If the landing/footer compresses coverage honesty into one compact comparison number, it must use the weaker measured side of the race rather than the stronger one.

### Act 3: Where Does Performance Become Poor?

Act 3 is a measured experience funnel.

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

Act 3 should still feel embodied. The visual and copy should communicate that sessions become late, then visibly late, then interaction-ready too late. It must not collapse into a clinical threshold table.

### Act 4: What Exists Beyond This?

Act 4 is the handoff layer.

The report should make the next step obvious:

- `Rapid Fix Plan` = trace the proven gap to the landing pages and routes causing the most drag, and return the sequenced fixes that close it fastest
- A second, generic engagement card invites the viewer to take the measured truth into a deeper diagnostic conversation with Stroma without naming or describing the downstream paid product

The report does not give away those deeper layers for free. It proves the gap and hands off cleanly.

## Truth Boundary

The report may show only:

- measured audience shape
- measured experience gap
- measured poor-performance progression
- explicit coverage and fallback honesty

The report must not show:

- revenue estimates
- monthly exposure figures
- vendor attribution
- root-cause ranking
- sprint plans
- commercial diagnosis

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
- additive measured `experience_funnel` data for Act 3

The additive `experience_funnel` block must include:

- `active_stages`
- `measured_session_coverage`
- `poor_session_share`
- stage thresholds
- per-tier coverage and poor-share summaries for classified tiers

## Visual Direction

The visual system should feel intentional and alive, not like analytics furniture.

The report should feel closer to a premium editorial artifact than a monitoring dashboard.

Truth must remain more visible than atmosphere. Cinematic presentation is only valid when the evidence layer stays obvious and challengeable.

The visual source of truth is `stroma.design`, but the report must implement that direction through a report-owned token layer rather than ad hoc copied values.

Primary vocabulary:

- particle fields
- temporal comparison
- staged degradation
- accumulation
- horizon and handoff

Allowed secondary vocabulary:

- compact labels
- small coverage chips
- simple bars where they improve comprehension

Avoid:

- axes
- chart frames
- legends
- dashboard chrome
- anything that looks like generic BI output

## Mood System

The same four acts render for both negative and positive cases.

The renderer may shift:

- copy tone
- motion intensity
- color emphasis
- atmosphere

But it must not change the report's measured contract or invent a separate "good case" product.

Presentation moods:

- `urgent` for severe measured gap and high poor-session share
- `sober` for meaningful but not severe measured conditions
- `affirming` for low gap and low poor-session share

Positive cases should feel controlled and reassuring, not artificially dramatic.

## Reduced And Legacy States

The report must degrade honestly.

### Reduced measured funnel

If later-stage coverage is too weak:

- keep Act 3
- reduce the active stages
- say why in plain language

### Legacy URL state

If an older `rv=1` URL predates the additive funnel block:

- keep Acts 1 and 2 working
- render Act 3 as a safe reduced legacy state
- tell the viewer to regenerate the URL for the measured experience funnel

## CTA Boundary

The free report is a proof artifact, not a consulting deliverable.

The CTA language must preserve that:

- Rapid Fix Plan pinpoints the landing pages and routes carrying the most drag and returns a sequenced fix order
- The second engagement card invites the viewer into a wider Stroma conversation about turning measured user-experience evidence into commercial decisions, without naming or describing the downstream paid product

Benchmark or comparative extras, if present later, should remain tertiary.

Act 4 must close the evidence journey cleanly:

- who is affected
- how far apart the experience is
- where performance becomes poor
- what deeper layer answers why and what to fix first

## Drift Rules

The report product surface must stay aligned with:

- the hosted route at `https://signal.stroma.design/r`
- the canonical package name `@stroma-labs/signal`
- the additive `rv=1` report contract

No old references to `@stroma/perf-tiers` or `tiers.stroma.design` should remain in live report docs.

## Validation Expectations

Changes to the report surface should be validated together across:

- aggregate generation
- report URL encoding/decoding
- BigQuery SQL templates
- `/build` summary behavior
- `/r` rendering
- smoke and e2e tests
- deterministic visual snapshot tests

The goal is simple:

the report should stay vivid, measured, and commercially useful without drifting into fake certainty or free consulting.
