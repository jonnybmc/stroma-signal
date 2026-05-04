// Glossary — every term that might be jargon to a Paid-Media / CMO reader
// gets a plain-English definition + a translation line that names the
// mechanism + user-behaviour consequence in KPI vocabulary. Used by
// `renderTerm()` in render-helpers.ts.
//
// Discipline (per /r boundary memos + feedback_no_self_deprecation_in_artifacts):
// - The `plain` line is descriptive (what the term measures).
// - The `cmo` line names mechanism + user-behaviour consequence in KPI
//   vocabulary. NEVER asserts a commercial figure (CPC %, conversion %,
//   ROAS movement) the report cannot measure. NEVER uses self-deprecating
//   hedges ("the report doesn't see X") — the boundary disclosure lives
//   ONCE in the Act 4 section-lede; here we just describe.
// - No "do this" verbs anywhere in this module.

export interface GlossaryEntry {
  name: string;
  long: string;
  plain: string;
  cmo: string;
}

export const GLOSSARY = {
  lcp: {
    name: 'LCP',
    long: 'Largest Contentful Paint',
    plain:
      'How long until the biggest thing on your landing page (usually a hero image or headline) actually appears. Google grades it: under 2.5s good, over 4s poor.',
    cmo: 'Slow LCP is one of the inputs platforms use when scoring landing-page experience: the experience signal that gets baked into auction weighting alongside competitive bids. Meta uses similar signals on placements that link out to your site.'
  },
  fcp: {
    name: 'FCP',
    long: 'First Contentful Paint',
    plain:
      'How long until the page shows anything at all — first text or shape on screen. Anything beyond 3s feels broken.',
    cmo: 'Late FCP is when ad-click intent starts decaying. A user who clicked through expects to see the page register their click; a fast-blank page reads as a stalled one and disengagement starts before the session has even begun.'
  },
  inp: {
    name: 'INP',
    long: 'Interaction to Next Paint',
    plain:
      'How quickly the page responds when someone taps or clicks — the lag between input and visible reaction. Over 500ms feels broken.',
    cmo: 'Slow INP shows up as friction at the moment of intent: the page registered the click but takes long enough to commit the next action that some users disengage before the action lands. Forms feel stalled, CTAs feel mushy.'
  },
  ttfb: {
    name: 'TTFB',
    long: 'Time to First Byte',
    plain: 'How long the browser waits for the server to start sending the page. Under 800ms is fine.',
    cmo: 'Mostly an infrastructure number. Usually not the dominant problem on landing pages — render delay is.'
  },
  p75: {
    name: 'p75',
    long: '75th percentile',
    plain:
      'The experience worse than three out of four sessions had. Not the average — averages hide bad tails. Google grades Core Web Vitals at p75.',
    cmo: 'This is the number Google uses to score you. Improving the median does not move it; only fixing the slow tail does.'
  },
  cohort: {
    name: 'Cohort',
    long: 'A measured group of sessions',
    plain:
      'A slice of your real traffic grouped by network and device class — for example, all the sessions on 3G with a 4GB phone.',
    cmo: 'Cohorts are how you stop treating "your audience" as one average user. They are the basis for tier-aware landing-page variants and creative.'
  },
  qs: {
    name: 'Quality Score',
    long: 'Google Ads Quality Score',
    plain:
      "Google's 1–10 grade for an ad based on expected CTR, ad relevance, and landing page experience. Higher score = lower CPC and better placement.",
    cmo: 'Landing Page Experience is one of the inputs Quality Score weights, alongside expected CTR and ad relevance. Slow LCP is a render-side input the score reads regardless of why the paint was late.'
  },
  roas: {
    name: 'ROAS',
    long: 'Return on Ad Spend',
    plain: 'Revenue divided by ad spend. The headline efficiency number for paid media.',
    cmo: 'Landing-page experience sits upstream of ROAS through two mechanisms — disengagement at the click (intent decays before the page presents) and auction weighting (slower experience scoring shifts what each click costs). Both compound.'
  },
  cac: {
    name: 'CAC',
    long: 'Customer Acquisition Cost',
    plain: 'Total spend to acquire one customer.',
    cmo: 'Disengagement at the click sits upstream of CAC: the click is paid for whether or not the session converts. Anything that slows the moment between paid click and visible page lands somewhere in the customer-acquisition arithmetic.'
  },
  cpc: {
    name: 'CPC',
    long: 'Cost per Click',
    plain: 'What you pay each time someone clicks your ad.',
    cmo: 'CPC is what platforms charge per click; landing-page experience is one of the inputs they read when weighting auctions. Slower experience scoring shifts the auction weight, which is why per-click cost is sensitive to render-side speed.'
  },
  cpa: {
    name: 'CPA',
    long: 'Cost per Acquisition',
    plain: 'Total cost to drive one conversion (lead, signup, sale).',
    cmo: 'CPA sits where CPC and conversion rate meet: anything that moves either input moves CPA, with experience signals upstream of both.'
  },
  poor: {
    name: 'Poor threshold',
    long: 'Core Web Vitals "poor" boundary',
    plain:
      'The line where Google grades your page as poor: LCP > 4s, INP > 500ms, FCP > 3s. Sessions past this line are the ones the auction penalises.',
    cmo: 'This is not an internal engineering yardstick: it is the line platforms read when scoring landing-page experience.'
  },
  classified: {
    name: 'Classified',
    long: 'Sessions placed into a tier',
    plain:
      'The share of measured sessions for which we have enough signal to confidently assign a network/device tier.',
    cmo: "High classified share means the report's claims about your audience apply to most of your real traffic — not a fragmentary sample."
  },
  renderdelay: {
    name: 'Render delay',
    long: 'LCP render delay subpart',
    plain:
      'After the browser has the bytes for the hero image or main text, this is how long it still spends before painting it. Almost always blocked by JavaScript.',
    cmo: 'When this dominates, third-party tags and scripts are eating your landing page. The pattern is rarely a bandwidth issue — it is a script-volume issue.'
  }
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
