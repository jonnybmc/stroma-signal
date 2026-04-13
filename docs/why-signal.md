# Why Signal Exists

<img src="./images/signal-stroma-logo.png" alt="Signal by Stroma logo" width="320" />

Your analytics platform says most of your mobile users are on "4g." That label is hiding a 10x performance gap.

A user on fibre in a major city and a user on a congested mobile tower in a dense suburb both report as "4g" in Chrome's Network Information API. Both land in the same CrUX bucket. Both look identical in your GA4 segments. But one loads your page in 1.8 seconds. The other waits 9.

That gap is invisible in every standard analytics tool. It is not invisible to the user who leaves.

Signal exists to make that gap measurable, honest, and impossible to ignore.

## What Signal Does

Signal is a browser instrumentation package that classifies real-user network and device conditions on every page load, tags Web Vitals to those classifications, and delivers the enriched data to your own analytics.

The classification is not based on browser-estimated labels. It uses the actual TCP handshake time from the Navigation Timing API, a direct measurement of the round-trip between the user's device and your server. That measurement becomes a tier: urban, moderate, constrained moderate, or constrained. Device capability gets the same treatment: low, mid, or high, scored from real hardware signals.

Every page load produces one canonical event. Network tier, device tier, Core Web Vitals, and enough diagnostic context to understand what the load actually felt like. One event. One beacon. Under 4 KB added to your page. Zero dependencies. No PII.

## Who It Is For

Signal is for teams where performance is not just a debugging concern. It is a delivery concern, a reporting concern, and a business communication concern.

That usually means some combination of:

- **Product teams** that need to understand what users actually experience, not what a lab score suggests
- **Growth and martech teams** that need a shareable performance artifact for launches and campaigns
- **Engineering teams** that want a small, opinionated runtime instead of another heavyweight vendor
- **Analytics and ops teams** that want clean warehouse truth instead of ad hoc tag sprawl
- **Commercial and strategy teams** that need a credible report link, not a pile of dashboards and caveats

If your only goal is to inspect one failing page load in devtools, Signal is more structured than you need. If your goal is to move from "we think the site might feel slow for some users" to "here is the segment-aware field evidence, and here is the report we can share," Signal is built for exactly that.

## Two Paths, Same Truth

Signal supports two persistence paths, and the choice depends on your team's maturity and tooling.

**The GA4 path** pushes a compact event into `window.dataLayer` as a `perf_tier_report` custom event. If you already live in GTM and GA4, this is the fastest route to deployment. It is intentionally constrained: enough for segmentation and BigQuery export, not so much that GA4 becomes an accidental warehouse.

**The warehouse path** sends the full canonical event via beacon or callback to your own endpoint. This carries everything: extended device detail, full attribution context, normalized navigation semantics, and connection diagnostics. This is where the deeper analytical value lives, and it is the better fit for teams that want durable ownership of the data model.

The key insight: one organization can run both paths simultaneously. A GTM-led martech team moves quickly. A warehouse-led analytics team keeps the richer truth. Same instrumentation, same schema, different fidelity.

## What the Report Unlocks

Collecting a payload is not the point. What matters is what it makes possible.

Signal includes a complete aggregation layer that turns raw events into comparable, honest performance segments. It answers the questions that matter:

- What share of your users are on urban versus constrained conditions?
- Is there enough data in each tier to compare fairly?
- If LCP coverage is too thin, what fallback metric should be used instead?
- How much of your traffic was unclassifiable, and why?

That coverage honesty is a feature, not a caveat. It means the output says "here is the comparison, and here is how much trust you should place in it." That is a very different posture from most analytics implementations, and it is often the difference between a report that persuades and one that gets challenged immediately.

The final output is a shareable report URL. Not a dashboard login. Not a vendor portal. A link that encodes your real user distribution, the performance gap between your best and worst tier, and the metrics that back it up. You can paste it in Slack, present it in a boardroom, or attach it to a product brief. It carries its own evidence.

That report matters because the report is the wedge. It is the part that turns raw instrumentation into a visible internal decision. Signal is not just "data into BigQuery." It is a measured path from browser event to report artifact.

The Tier Report is not a diagnostic, attribution, or commercial modelling artifact. It is the measured proof layer: who your users are, how far apart their experiences are, and where performance crosses into poor territory using explicit thresholds. The deeper "why" and "what to fix first" layers stay outside the free artifact on purpose.

## How It Works

```bash
npm install @stroma-labs/signal
```

```javascript
import { init, createBeaconSink } from '@stroma-labs/signal';

init({
  sinks: [createBeaconSink({ endpoint: '/collect' })],
});
```

Data flows on the first page load. No build step. No vendor account. No cookies set. The runtime observes browser-native performance APIs, classifies the conditions, and emits a single event when the page is hidden.

For GA4 integration, add the dataLayer sink. For a preview report during development, add the preview collector. For full warehouse persistence, point the beacon at your own endpoint and use the provided SQL templates to query BigQuery.

The architecture is modular by design. The base package is the collection edge. The GA4 helper handles compact flattening. The report module handles aggregation and URL encoding. Import only what you need.

For the presentation-layer source of truth behind the hosted report artifact, see the [Tier Report Design Spec](./tier-report-design-spec.md).

## Why Not Just Use What You Already Have

Because each alternative solves only part of the problem.

GTM and GA4 give you transport, but not a canonical event contract, not tier comparison logic, not coverage rules, and not a report URL. A RUM vendor gives you dashboards, but also opinions, pricing, and a black-box definition of "good." Lighthouse gives you lab data, but cannot tell you what real users on constrained networks are actually experiencing. CrUX gives you Chrome field data, but segments by the same coarse labels that hide the gap in the first place.

Signal is not trying to replace any of these. It occupies the space between raw instrumentation and opinionated platform: small enough to embed anywhere, structured enough to produce trustworthy output, and explicit enough about its boundaries that you know exactly what you are getting.

## The Architecture in One Sentence

Collect an opinionated browser event, preserve it in a canonical contract, persist it through GA4 or a warehouse path, aggregate it with explicit honesty rules, and turn it into a shareable report URL.

That chain, from browser event to boardroom artifact, is the actual product.

For the full technical specification, including field definitions, browser support matrices, classification thresholds, aggregation rules, and edge case handling, see the [Signal Technical Reference](./signal-technical-reference.md).

---

**Install it. See your real users. Then decide what to do about it.**

`npm install @stroma-labs/signal` | [Documentation](./public-api-v0.1.md) | [Quick start for marketers](./marketer-quickstart.md) | [GTM recipe](./gtm-recipe.md)
