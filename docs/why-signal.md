# Why Signal Exists

<img src="./images/signal-stroma-logo.png" alt="Signal by Stroma logo" width="320" />

**Attribution tools tell you which channel got credit. Server-side tracking makes sure the event was captured. Signal tells you whether the click landed in conditions where conversion ever stood a fair chance — and what to change when it didn't.**

Signal is the missing operational layer between attribution truth and landing reality. It sits beneath your server-side and attribution tools; it does not replace, compete with, or reconcile them.

Shortest form: *server-side fixes missing events; Signal explains missing performance — and names what to do about it.*

## The invisible gap, made specific

Your analytics platform says most of your mobile users are on "4g." That label is hiding a 10x performance gap.

A user on fibre in a major city and a user on a congested mobile tower in a dense suburb both report as "4g" in Chrome's Network Information API. Both land in the same CrUX bucket. Both look identical in your GA4 segments. But one loads your page in 1.8 seconds. The other waits 9.

That gap is invisible in every standard analytics tool. It is not invisible to the user who leaves. Your server-side tracking captured their session fine; your attribution tool credited the campaign correctly. Neither can tell you the click never had a fair chance to convert.

Signal exists to make that gap measurable, honest, and actionable — the third layer underneath server-side and attribution.

## What Signal Does

Signal is a browser instrumentation package that classifies real-user network and device conditions on every page load, tags Web Vitals to those classifications, and delivers the enriched data to your own analytics.

The classification is not based on browser-estimated labels. It uses the actual TCP handshake time from the Navigation Timing API, a direct measurement of the round-trip between the user's device and your server. That measurement becomes a tier: urban, moderate, constrained moderate, or constrained. Device capability gets the same treatment: low, mid, or high, scored from real hardware signals.

Every page load produces one canonical event. Network tier, device tier, Core Web Vitals, LCP / INP attribution context, and on Chromium 123+, the Long Animation Frame story (worst-frame duration plus dominant cause: script, layout, style, or paint) when coverage is defensible. Enough diagnostic context to understand what the load actually felt like. One event. One beacon. Zero dependencies. No PII.

The base SDK adds under 4 KB gzipped to your page. The GA4 helper and report-builder subpaths are optional and add roughly 0.5 KB and 1 KB respectively when used.

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

## What the Artifact Unlocks

Collecting a payload is not the point. What matters is what it makes possible.

**The Tier Report (`/r`)** is the measured proof layer — the shareable URL that encodes your real user distribution, the performance gap between your best and worst tier, and the metrics that back it up. It stops at proof on purpose. It is not a diagnostic, attribution, or commercial modelling artifact.

Signal's aggregation layer also answers the questions that matter for any honest comparison:

- What share of your users are on urban versus constrained conditions?
- Is there enough data in each tier to compare fairly?
- If LCP coverage is too thin, what fallback metric should be used instead?
- How much of your traffic was unclassifiable, and why?

That coverage honesty is a feature, not a caveat. The output says "here is the comparison, and here is how much trust you should place in it." That's the difference between a report that persuades and one that gets challenged immediately.

## What Signal deliberately is not

Named upfront so the wedge doesn't blur:

- **Not a server-side tracking replacement** — sGTM / Stape / Conversion APIs / HYROS live there
- **Not an attribution replacement** — Northbeam / Triple Whale / Meridian live there
- **Not an MMM or incrementality platform** — Meridian and Northbeam live there
- **Not a creative optimiser** — that's the ad platforms
- **Not a closed-loop autonomous bidder in v1** — the agentic trajectory is named as v2/v3, deliberately deferred so the wedge stays clean
- **Not a dashboard** — specialists already have Data Studio, Triple Whale, and native platform UIs

Every blurred wedge starts with "can you also…" — so these are stated explicitly.

There is also a deliberate field-level boundary: viewport dimensions, device pixel ratio, `navigator.userAgentData.mobile`, the legacy `navigator.connection.type` label, and TCP handshake quartiles are *not* captured. The reasoning for each exclusion is documented in [aggregation-spec.md](./aggregation-spec.md). The principle is the same: Signal measures what unlocks an action; it does not collect what merely sounds richer.

## Action vocabulary discipline

Signal outputs bridge diagnosis → decision → action. Diagnosis-only artifacts fail the "now what?" test and risk becoming an excuse generator. That framing is commercially dead and ethically indefensible for an Africa-calibrated product.

**Signal uses** reroute / reshape / split vocabulary:

- Flag landing pages whose payload is mismatched for the audience's tier
- Recommend routing, page variant, or lighter experience by tier
- Break account-wide blended decisions into tier-segmented reads

**Signal never uses** exclude / avoid / bid-down language:

- Not "exclude users on weak networks"
- Not "avoid constrained geographies"
- Not "bid down on low-end Android"
- Not "the user was on 3G" (excuse-generator phrasing)

Shrinking the audience to fit the experience is not a Signal recommendation. Reshaping the experience to fit the audience is.

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

Because each alternative answers a different question.

- **GTM, GA4, or server-side tracking (sGTM / Stape / HYROS)** — confirm the event was captured. Useful. Not what Signal does.
- **Attribution tools (Northbeam, Triple Whale, Meridian)** — tell you which channel got credit. Useful. Not what Signal does.
- **A RUM vendor** — gives you dashboards, plus opinions, pricing, and a black-box definition of "good."
- **Lighthouse** — lab data, cannot tell you what real users on constrained networks are experiencing.
- **CrUX** — Chrome field data, segments by the same coarse labels that hide the gap in the first place.

Signal fills the space beneath all of them: measured substrate classification on every page load, joined to your own warehouse, rendered as a shareable proof artifact. Small enough to embed anywhere, structured enough to produce trustworthy output, and explicit enough about its boundaries that you know exactly what you are getting — and what you are not.

## The Architecture in One Sentence

Collect an opinionated browser event, preserve it in a canonical contract, aggregate it in the client's own warehouse, and render that as a shareable URL that specialists can take into a client meeting.

That chain, from browser event to shareable proof, is the actual product.

For the full technical specification — field definitions, browser support matrices, classification thresholds, aggregation rules, and edge case handling — see the [Signal Technical Reference](./signal-technical-reference.md).

---

**Install it. See your real users. Then decide what to do about it.**

`npm install @stroma-labs/signal` | [Documentation](./public-api-v0.1.md) | [Quick start for marketers](./marketer-quickstart.md) | [GTM recipe](./gtm-recipe.md)
