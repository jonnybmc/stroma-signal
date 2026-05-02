// Glossary — every term that might be jargon to a Paid-Media / CMO reader
// gets a plain-English definition + an explicit "what this means for your
// KPIs" line. Used by `renderTerm()` in render-helpers.ts.
//
// Discipline (per /r boundary memos):
// - The `plain` line is descriptive (what the term measures).
// - The `cmo` line translates to KPI consequence — never prescription.
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
    cmo: 'When LCP is slow, it is the #1 reason Google lowers your Landing Page Experience score — which raises CPC and shrinks ad reach. Meta uses similar signals on placements that link out to your site.'
  },
  fcp: {
    name: 'FCP',
    long: 'First Contentful Paint',
    plain:
      'How long until the page shows anything at all — first text or shape on screen. Anything beyond 3s feels broken.',
    cmo: 'When FCP is late, that is the moment ad clicks start bouncing before they ever became sessions. The cost was already paid; the conversion never had a chance.'
  },
  inp: {
    name: 'INP',
    long: 'Interaction to Next Paint',
    plain:
      'How quickly the page responds when someone taps or clicks — the lag between input and visible reaction. Over 500ms feels broken.',
    cmo: 'When INP is slow, forms stall and CTAs feel mushy. It directly suppresses conversion at the bottom of the funnel — same ad spend, fewer leads.'
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
    cmo: 'When LCP is slow, it can drop Landing Page Experience by a tier and pull Quality Score down with it. The mechanism is render-side: when the page paints late, Google scores it lower regardless of why.'
  },
  roas: {
    name: 'ROAS',
    long: 'Return on Ad Spend',
    plain: 'Revenue divided by ad spend. The headline efficiency number for paid media.',
    cmo: 'When landings are slow, they drag ROAS in two ways: more bounces (lost intent) and inflated CPC (paying more per click that left). Both compound.'
  },
  cac: {
    name: 'CAC',
    long: 'Customer Acquisition Cost',
    plain: 'Total spend to acquire one customer.',
    cmo: 'When slow loading drives bounce, every percentage point of that bounce lands in CAC. The click was paid for; the customer never existed.'
  },
  cpc: {
    name: 'CPC',
    long: 'Cost per Click',
    plain: 'What you pay each time someone clicks your ad.',
    cmo: 'When Landing Page Experience drops a tier, CPC rises by single-digit percentages on Google paid search. Compounds across every campaign and every keyword.'
  },
  cpa: {
    name: 'CPA',
    long: 'Cost per Acquisition',
    plain: 'Total cost to drive one conversion (lead, signup, sale).',
    cmo: 'When CPC inflates and conversion rate softens together, CPA rises while spend stays the same.'
  },
  poor: {
    name: 'Poor threshold',
    long: 'Core Web Vitals "poor" boundary',
    plain:
      'The line where Google grades your page as poor: LCP > 4s, INP > 500ms, FCP > 3s. Sessions past this line are the ones the auction penalises.',
    cmo: 'This is not an internal engineering yardstick — it is the line Google uses to decide your ad cost.'
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
