import type { SignalDeviceTier, SignalNetworkTier, SignalRaceFallbackReason } from '@stroma-labs/signal-contracts';

import { escapeHtml } from './render-utils';
import { REPORT_BRAND } from './report-brand';
import { type IconName, renderIcon } from './report-icons';
import {
  extractMotionPayload,
  formatMetricDuration,
  type ReportActionableSignalsViewModel,
  type ReportDeviceTierVisual,
  type ReportExperienceStageViewModel,
  type ReportFormFactorViewModel,
  type ReportInpStoryViewModel,
  type ReportLcpStoryViewModel,
  type ReportMotionMode,
  type ReportPersonaContrast,
  type ReportPersonaProfile,
  type ReportTierVisual,
  type ReportViewModel
} from './report-view-model';

type SeverityTone = 'steady' | 'watch' | 'alert';

// Compact footer copy for the race-fallback signal — shorter than the /build
// QA map because the credibility strip is dot-separated and must stay tight.
const FOOTER_FALLBACK_COPY: Record<SignalRaceFallbackReason, string> = {
  lcp_coverage_below_threshold: 'FCP race (LCP coverage below threshold)',
  fcp_unavailable: 'TTFB race (FCP unavailable)',
  insufficient_comparable_data: 'No race (no comparable cohort)'
};

/**
 * Radial severity gauge (LogRocket health-score pattern). One circular
 * track plus a coloured arc whose length telegraphs the tone on a 3-step
 * spectrum. A Lucide icon sits inside the centre hole.
 */
function renderSeverityGauge(tone: SeverityTone, label: string): string {
  return `
    <span class="sr-severity-gauge" data-tone="${tone}" role="img" aria-label="${escapeHtml(label)}">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle class="sr-severity-gauge-track" cx="18" cy="18" r="15.915" />
        <circle class="sr-severity-gauge-fill" cx="18" cy="18" r="15.915" pathLength="100" />
      </svg>
    </span>
  `;
}

/**
 * Stage label → Lucide icon map. Each cliff stage gets a discreet visual
 * marker (zap for FCP, eye for LCP, click cursor for INP).
 */
const STAGE_ICON_NAME: Record<'fcp' | 'lcp' | 'inp', IconName> = {
  fcp: 'zap',
  lcp: 'eye',
  inp: 'mousePointerClick'
};

function stageIcon(stageKey: string): string {
  const icon = STAGE_ICON_NAME[stageKey as keyof typeof STAGE_ICON_NAME];
  return icon ? renderIcon(icon, 'sr-icon sr-icon-sm') : '';
}

// Classification criteria derived from the SDK classification thresholds.
// These explain what each tier MEANS in real measurable terms so the
// landing tables tell the full story, not just the label + share.
// Typed as exhaustive records — adding a new tier to the contract's
// SignalNetworkTier / SignalDeviceTier enum will fail to compile here
// until the criteria + meaning copy is added, preventing silent empty
// fallback on future tier additions.
type TierKeyAll = SignalNetworkTier | 'unknown';

const NETWORK_CRITERIA: Record<TierKeyAll, string> = {
  urban: '< 50 ms TCP',
  moderate: '50–150 ms TCP',
  constrained_moderate: '150–400 ms TCP',
  constrained: '≥ 400 ms TCP',
  unknown: 'Not classifiable'
};

const DEVICE_CRITERIA: Record<SignalDeviceTier, string> = {
  high: '6+ cores · 4+ GB · 1280px+',
  mid: '4–6 cores · 2–4 GB · 768px+',
  low: '≤2 cores · ≤2 GB · <768px'
};

// Plain-English interpretation copy for desktop hover tooltips. These are
// not measured values — they're empathetic pre-interpretation aimed at a
// non-technical paid-media / CRO / SEO buyer. Stays within the truth
// boundary: describes what the tier *means* in real user terms, without
// claiming root cause, commercial exposure, or prescription.
const NETWORK_MEANING: Record<TierKeyAll, string> = {
  urban: 'Fibre, strong mobile, low latency. Usually the cohort your internal team tests on.',
  moderate: 'Solid home broadband or good LTE. Small but measurable delays vs urban.',
  constrained_moderate: 'Congested mobile, older 4G, or backup connections. Slowdowns are visible to the user.',
  constrained: 'Unstable cell, roaming, or satellite tethers. Where the experience starts to break.',
  unknown: 'Classifier could not determine the tier — usually Safari or privacy browsers that hide connection timing.'
};

const DEVICE_MEANING: Record<SignalDeviceTier, string> = {
  high: 'Recent flagship phones and modern laptops. Ample CPU and memory for heavy pages.',
  mid: 'Two- to three-year-old devices, the mainstream market. Start to feel JS-heavy pages.',
  low: 'Older, low-RAM, or entry-level devices. Below the threshold where heavy bundles stay responsive.'
};

function renderTierLabels(tiers: readonly ReportTierVisual[], sampleSize: number): string {
  const rows = tiers
    .map((tier) => {
      const sessions = Math.round((tier.share / 100) * sampleSize);
      const emptyAttr = tier.share === 0 ? ' data-empty="true"' : '';
      const criteria = NETWORK_CRITERIA[tier.key] ?? '';
      const meaning = NETWORK_MEANING[tier.key] ?? '';
      const tooltipAttr = meaning ? ` data-tooltip="${escapeHtml(meaning)}" tabindex="0"` : '';
      return `
        <tr
          class="sr-tier-label"
          data-tier="${escapeHtml(tier.key)}"
          data-cluster-anchor="${escapeHtml(tier.key)}"
          style="--share:${tier.share}"${emptyAttr}${tooltipAttr}
        >
          <th scope="row" class="sr-tier-label-name">
            <span class="sr-tier-dot" aria-hidden="true"></span>
            <span>${escapeHtml(tier.label)}</span>
          </th>
          <td class="sr-tier-label-criteria sr-mono sr-mono-sm">${escapeHtml(criteria)}</td>
          <td class="sr-tier-label-sessions sr-mono sr-mono-sm">${sessions.toLocaleString()} sessions</td>
          <td class="sr-tier-label-share sr-mono">${tier.share}%</td>
        </tr>
      `;
    })
    .join('');
  return `
    <thead>
      <tr>
        <th class="sr-tier-col-head">Tier</th>
        <th class="sr-tier-col-head">Criteria</th>
        <th class="sr-tier-col-head">Sessions</th>
        <th class="sr-tier-col-head sr-tier-col-head-right">Share</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

/**
 * Device spread table — same 4-column structure as renderTierLabels but
 * keyed off device class (high / mid / low). The criteria column shows
 * what the SDK's composite scoring model counts as "high-end" vs "budget"
 * in real hardware terms.
 */
function renderDeviceLabels(devices: readonly ReportDeviceTierVisual[], sampleSize: number): string {
  const rows = devices
    .map((device) => {
      const sessions = Math.round((device.share / 100) * sampleSize);
      const emptyAttr = device.share === 0 ? ' data-empty="true"' : '';
      const criteria = DEVICE_CRITERIA[device.key] ?? '';
      const meaning = DEVICE_MEANING[device.key] ?? '';
      const tooltipAttr = meaning ? ` data-tooltip="${escapeHtml(meaning)}" tabindex="0"` : '';
      return `
        <tr
          class="sr-tier-label sr-device-row"
          data-device-tier="${escapeHtml(device.key)}"
          style="--share:${device.share}"${emptyAttr}${tooltipAttr}
        >
          <th scope="row" class="sr-tier-label-name">
            <span class="sr-tier-dot" aria-hidden="true"></span>
            <span>${escapeHtml(device.label)}</span>
          </th>
          <td class="sr-tier-label-criteria sr-mono sr-mono-sm">${escapeHtml(criteria)}</td>
          <td class="sr-tier-label-sessions sr-mono sr-mono-sm">${sessions.toLocaleString()} sessions</td>
          <td class="sr-tier-label-share sr-mono">${device.share}%</td>
        </tr>
      `;
    })
    .join('');
  return `
    <thead>
      <tr>
        <th class="sr-tier-col-head">Device</th>
        <th class="sr-tier-col-head">Criteria</th>
        <th class="sr-tier-col-head">Sessions</th>
        <th class="sr-tier-col-head sr-tier-col-head-right">Share</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

/**
 * Act 1 proportional dot strip (ContentSquare audience segmentation pattern).
 * 50 dots in a row, each dot = 2% of the audience, coloured by the tier that
 * owns that percentile. The whole strip reads in under a second as "your
 * audience looks like this", with the two boundaries between tier bands
 * telegraphing proportion without asking the reader to parse any number.
 */
function _renderAudienceStrip(tiers: readonly ReportTierVisual[]): string {
  const ordered = [...tiers].sort((a, b) => {
    const order = ['urban', 'moderate', 'constrained_moderate', 'constrained', 'unknown'];
    return order.indexOf(a.key) - order.indexOf(b.key);
  });

  const dotCount = 50;
  const dots: string[] = [];
  let cursor = 0;
  for (let i = 0; i < dotCount; i += 1) {
    const percentile = (i + 0.5) * (100 / dotCount);
    while (cursor < ordered.length - 1 && percentile > cumulativeShareUpTo(ordered, cursor)) {
      cursor += 1;
    }
    const tier = ordered[cursor]?.key ?? 'unknown';
    dots.push(`<span class="sr-audience-dot" data-tier="${escapeHtml(tier)}"></span>`);
  }

  return `
    <div
      class="sr-audience-strip"
      role="img"
      aria-label="Audience split across network tiers"
      title="Each dot is 2% of the measured audience, coloured by network tier."
    >
      ${dots.join('')}
    </div>
  `;
}

function cumulativeShareUpTo(tiers: readonly ReportTierVisual[], index: number): number {
  let total = 0;
  for (let i = 0; i <= index; i += 1) total += tiers[i]?.share ?? 0;
  return total;
}

function _renderTierNarratives(tiers: readonly ReportTierVisual[], sampleSize: number): string {
  // Act 1's narrative layer only surfaces tiers that actually carry weight in
  // the measured sample. Zero-share tiers are quietly dropped — the landing
  // section already shows the full spectrum, so Act 1 stays focused on the
  // stories that shape the experience.
  const material = tiers.filter((tier) => tier.share > 0);
  return material
    .map((tier) => {
      const sessions = Math.round((tier.share / 100) * sampleSize);
      return `
        <article
          class="sr-tier-narrative"
          data-tier="${escapeHtml(tier.key)}"
          data-cluster-anchor="${escapeHtml(tier.key)}"
        >
          <header class="sr-tier-narrative-head">
            <span class="sr-tier-narrative-dot" aria-hidden="true"></span>
            <p class="sr-eyebrow sr-tier-narrative-label">${escapeHtml(tier.label)}</p>
          </header>
          <div class="sr-tier-narrative-stats">
            <strong class="sr-tier-narrative-share sr-mono">${tier.share}%</strong>
            <span class="sr-tier-narrative-sessions sr-mono sr-mono-sm">${sessions.toLocaleString()} sessions</span>
          </div>
          <p class="sr-tier-narrative-body">${escapeHtml(tier.narrative)}</p>
        </article>
      `;
    })
    .join('');
}

/**
 * Device-class audience strip — parallel to renderAudienceStrip but coloured
 * by hardware tier (high / mid / low) instead of network tier. Reuses the
 * same 50-dot layout so both strips on Act 1 share a visual voice.
 */
function _renderDeviceAudienceStrip(devices: readonly ReportDeviceTierVisual[]): string {
  const order: ReportDeviceTierVisual['key'][] = ['high', 'mid', 'low'];
  const ordered = order
    .map((key) => devices.find((d) => d.key === key))
    .filter((d): d is ReportDeviceTierVisual => d != null);

  const dotCount = 50;
  const dots: string[] = [];
  let cursor = 0;
  let cumulative = 0;
  for (let i = 0; i < dotCount; i += 1) {
    const percentile = (i + 0.5) * (100 / dotCount);
    while (cursor < ordered.length - 1 && percentile > cumulative + (ordered[cursor]?.share ?? 0)) {
      cumulative += ordered[cursor]?.share ?? 0;
      cursor += 1;
    }
    const tier = ordered[cursor]?.key ?? 'low';
    dots.push(`<span class="sr-audience-dot" data-device-tier="${escapeHtml(tier)}"></span>`);
  }

  return `
    <div
      class="sr-audience-strip"
      role="img"
      aria-label="Audience split across device classes"
      title="Each dot is 2% of the measured audience, coloured by device class."
    >
      ${dots.join('')}
    </div>
  `;
}

/**
 * Device narrative cards — the device-class sibling of renderTierNarratives.
 * Only renders device classes with material share; zero-share classes are
 * dropped so Act 1 stays focused on the hardware realities that actually
 * shape the experience.
 */
function _renderDeviceNarratives(devices: readonly ReportDeviceTierVisual[], sampleSize: number): string {
  const material = devices.filter((device) => device.share > 0);
  return material
    .map((device) => {
      const sessions = Math.round((device.share / 100) * sampleSize);
      return `
        <article class="sr-tier-narrative sr-device-narrative" data-device-tier="${escapeHtml(device.key)}">
          <header class="sr-tier-narrative-head">
            <span class="sr-tier-narrative-dot" aria-hidden="true"></span>
            <p class="sr-eyebrow sr-tier-narrative-label">${escapeHtml(device.label)}</p>
          </header>
          <div class="sr-tier-narrative-stats">
            <strong class="sr-tier-narrative-share sr-mono">${device.share}%</strong>
            <span class="sr-tier-narrative-sessions sr-mono sr-mono-sm">${sessions.toLocaleString()} sessions</span>
          </div>
          <p class="sr-tier-narrative-body">${escapeHtml(device.narrative)}</p>
        </article>
      `;
    })
    .join('');
}

/**
 * Act 1 persona contrast cards — two side-by-side cards showing a
 * representative hardware + network profile derived from aggregate-wide
 * histograms for the best-connected vs most-constrained audience segments.
 * Values are dominant-bucket summaries, not per-cohort measurements.
 */
function renderPersonaCard(profile: ReportPersonaProfile): string {
  // Empty-state variant — cohort share is 0%. Drops the detail rows (none
  // of which can be honestly attributed) and renders a muted explanatory
  // card instead. Preserves the two-card layout symmetry in Act 1 so the
  // persona grid rhythm stays intact across every scenario.
  if (profile.is_empty) {
    return `
      <article class="sr-persona-card sr-persona-card-empty" data-tone="${profile.tone}" data-state="empty">
        <header class="sr-persona-card-header">
          <h3 class="sr-persona-card-title">${escapeHtml(profile.label)}</h3>
          <span class="sr-persona-card-share sr-mono">0%</span>
        </header>
        <div class="sr-persona-card-body sr-persona-card-empty-body">
          <p class="sr-persona-empty-message">${escapeHtml(profile.empty_message)}</p>
        </div>
      </article>
    `;
  }

  const rows: Array<{ icon: IconName; label: string; value: string }> = [
    {
      icon: 'users',
      label: 'Network',
      value: `${escapeHtml(profile.network_tier)} · ${escapeHtml(profile.network_criteria)}`
    }
  ];
  if (profile.effective_type) {
    rows.push({
      icon: 'zap',
      label: 'Connection',
      value:
        escapeHtml(profile.effective_type) + (profile.downlink_label ? ` · ${escapeHtml(profile.downlink_label)}` : '')
    });
  }
  if (profile.rtt_label) {
    rows.push({ icon: 'eye', label: 'Latency', value: `${escapeHtml(profile.rtt_label)} RTT` });
  }
  rows.push({ icon: 'smartphone', label: 'CPU', value: escapeHtml(profile.cores_label) });
  rows.push({ icon: 'smartphone', label: 'Memory', value: escapeHtml(profile.memory_label) });
  if (profile.browser) {
    rows.push({ icon: 'eye', label: 'Browser', value: escapeHtml(profile.browser) });
  }
  if (profile.save_data) {
    rows.push({ icon: 'zap', label: 'Save-Data', value: 'On' });
  }

  const rowsMarkup = rows
    .map(
      (row) => `
        <div class="sr-persona-row">
          <span class="sr-persona-row-icon">${renderIcon(row.icon, 'sr-icon sr-icon-sm')}</span>
          <span class="sr-persona-row-label">${row.label}</span>
          <span class="sr-persona-row-value sr-mono">${row.value}</span>
        </div>
      `
    )
    .join('');

  return `
    <article class="sr-persona-card" data-tone="${profile.tone}">
      <header class="sr-persona-card-header">
        <h3 class="sr-persona-card-title">${escapeHtml(profile.label)}</h3>
        <span class="sr-persona-card-share sr-mono">${profile.share}%</span>
      </header>
      <div class="sr-persona-card-body">${rowsMarkup}</div>
    </article>
  `;
}

function renderPersonaCards(contrast: ReportPersonaContrast): string {
  return `
    <div class="sr-persona-grid" data-reveal style="--reveal-order:1">
      ${renderPersonaCard(contrast.best)}
      ${renderPersonaCard(contrast.constrained)}
    </div>
  `;
}

/**
 * Act 1 form-factor block — appears below the persona grid when the
 * aggregate carries form_factor_distribution. Three-up numeric display
 * with a proportional bar below, monochromatic opacity ramp on --sr-fg so
 * segments are distinguishable without colliding with the network-tier or
 * device-tier colour palettes. aria-label on the bar describes the split.
 */
function renderAct1FormFactor(formFactor: ReportFormFactorViewModel | null): string {
  if (!formFactor || formFactor.segments.length === 0) return '';
  const ariaSegments = formFactor.segments.map((s) => `${s.label} ${s.share}%`).join(', ');
  const columns = formFactor.segments
    .map((segment, index) => {
      // Three states:
      //   - empty: share === 0 → placeholder column (fixed width, muted,
      //     dashed bar). Communicates "absence measured" not "data missing".
      //   - narrow: 0 < share < 14 → hides text label and tightens the
      //     share-number scale so a tight column still reads.
      //   - wide: share >= 14 → full treatment.
      const state = segment.share === 0 ? 'empty' : 'populated';
      const band = segment.share >= 14 ? 'wide' : segment.share > 0 ? 'narrow' : 'wide';
      return `
        <div
          class="sr-act1-ff-column"
          data-rank="${index}"
          data-state="${state}"
          data-share-band="${band}"
          style="--share:${segment.share}"
        >
          <div class="sr-act1-ff-column-head">
            <span class="sr-act1-ff-share sr-mono">${segment.share}%</span>
            <span class="sr-act1-ff-label">${escapeHtml(segment.label)}</span>
          </div>
          <span class="sr-act1-ff-segment" data-rank="${index}"></span>
        </div>
      `;
    })
    .join('');
  return `
    <section class="sr-act1-form-factor" data-reveal style="--reveal-order:2">
      <header class="sr-act1-ff-header">
        <p class="sr-eyebrow">Form factor</p>
        <p class="sr-act1-ff-header-caption">Mobile-page-experience axis</p>
      </header>
      <div class="sr-act1-ff-body">
        <div
          class="sr-act1-ff-stack"
          role="img"
          aria-label="Audience form-factor distribution: ${escapeHtml(ariaSegments)}"
        >${columns}</div>
      </div>
    </section>
  `;
}

/**
/**
 * Render a single horizontal stacked bar from bucket data. Each segment's
 * width is proportional to its share; colour is tone-driven (alert red,
 * watch amber, steady teal, neutral grey). Segments wider than ~12% carry
 * their label inline; narrower ones show the label on hover via `title`.
 */
function renderSignalBar(buckets: ReadonlyArray<{ label: string; share: number; tone: string }>): string {
  const safeBuckets = buckets.filter((b) => Number.isFinite(b.share) && b.share > 0);
  if (safeBuckets.length === 0) return '<span class="sr-mono sr-mono-sm">—</span>';
  const segments = safeBuckets
    .map(
      (bucket) => `
        <span
          class="sr-signal-segment"
          data-tone="${escapeHtml(bucket.tone)}"
          style="flex-basis:${bucket.share}%"
          title="${escapeHtml(bucket.label)}: ${bucket.share}%"
        >
          ${bucket.share >= 12 ? `<span class="sr-signal-segment-label sr-mono">${escapeHtml(bucket.label)} ${bucket.share}%</span>` : ''}
        </span>
      `
    )
    .join('');
  return `<div class="sr-signal-bar" role="img" aria-label="Distribution bar">${segments}</div>`;
}

function _renderActionableSignals(signals: ReportActionableSignalsViewModel): string {
  if (signals.cells.length === 0) return '';
  const cells = signals.cells
    .map(
      (cell) => `
        <div class="sr-signal-cell" data-decision="${escapeHtml(cell.key)}">
          <dt>
            ${escapeHtml(cell.label)}${
              cell.coverage_caveat
                ? `<span class="sr-coverage-caveat"> (${escapeHtml(cell.coverage_caveat)})</span>`
                : ''
            }
          </dt>
          <dd>${cell.buckets ? renderSignalBar(cell.buckets) : `<span class="sr-mono">${escapeHtml(cell.value)}</span>`}</dd>
          <p class="sr-signal-decision">${escapeHtml(cell.decision)}</p>
        </div>
      `
    )
    .join('');
  return `
    <section class="sr-act1-signals" data-reveal style="--reveal-order:3">
      <p class="sr-eyebrow">Actionable signals</p>
      <dl class="sr-signal-grid">${cells}</dl>
    </section>
  `;
}

function severityToneForWaitDelta(waitDeltaMs: number | null): SeverityTone {
  if (waitDeltaMs == null) return 'steady';
  if (waitDeltaMs >= 2000) return 'alert';
  if (waitDeltaMs >= 900) return 'watch';
  return 'steady';
}

function renderLaneSampleLine(coverage: number | null, tierLabel: string): string {
  // Distinguish genuine 0% (measured the cohort, none had the metric) from
  // absent (coverage field unset). The legacy `coverage ?? 0` coercion read
  // "0% measured" for both, silently conflating absence with zero.
  const measuredFragment = coverage != null ? `${coverage}% measured` : 'coverage unavailable';
  return `
    <span class="sr-lane-sample sr-mono sr-mono-sm">
      ${escapeHtml(tierLabel.toLowerCase())} cohort
      <span class="sr-lane-sample-sep" aria-hidden="true">·</span>
      ${measuredFragment}
    </span>
  `;
}

/**
 * Act 2 LCP-subpart story block — inline narrative plus a compact 4-row
 * micro-chart that sits inside the `sr-wait` aside, immediately below the
 * wait-caption. The chart's dominant row takes the mood accent; non-
 * dominant rows stay muted so the eye lands on the single claim the
 * narrative makes. When the story is hedged (no clear dominant), the
 * chart renders without a tinted row and the narrative switches to the
 * honest "spread across multiple phases" line.
 *
 * Returns an empty string when the aggregate carries no LCP story
 * (Safari / Firefox / below race-observation threshold / no defensible
 * subpart breakdown) — the wait aside retains its existing rhythm with
 * no phantom caption or empty container (§4.1 of the enrichment plan).
 */
function renderAct2LcpStory(story: ReportLcpStoryViewModel | null): string {
  if (!story) return '';
  const chart = story.rows
    .map(
      (row) => `
        <div
          class="sr-lcp-story-row"
          data-subpart="${escapeHtml(row.key)}"
          data-dominant="${row.is_dominant ? 'true' : 'false'}"
          style="--share:${row.share}"
        >
          <span class="sr-lcp-story-row-label">${escapeHtml(row.label)}</span>
          <span class="sr-lcp-story-row-bar" aria-hidden="true">
            <span class="sr-lcp-story-row-fill"></span>
          </span>
          <span class="sr-lcp-story-row-value sr-mono sr-mono-sm">${row.share}%</span>
        </div>
      `
    )
    .join('');
  const ariaSummary = story.rows.map((row) => `${row.label} ${row.share}%`).join(', ');
  return `
    <div
      class="sr-lcp-story"
      data-hedged="${story.is_hedged ? 'true' : 'false'}"
      ${story.dominant_subpart ? `data-dominant-subpart="${escapeHtml(story.dominant_subpart)}"` : ''}
    >
      <p class="sr-lcp-story-narrative">${escapeHtml(story.narrative)}</p>
      <div class="sr-lcp-story-chart" role="img" aria-label="LCP subpart distribution: ${escapeHtml(ariaSummary)}">
        ${chart}
      </div>
    </div>
  `;
}

function renderAct2(viewModel: ReportViewModel): string {
  const race = viewModel.race;

  if (!race.race_available) {
    return `
      <header class="sr-act-header" data-reveal style="--reveal-order:0">
        <p class="sr-eyebrow">Act 2</p>
        <h2 class="sr-act-title">How far apart are their experiences?</h2>
        <p class="sr-act-lede">${escapeHtml(race.race_story)}</p>
      </header>
      <div class="sr-race-fallback" data-reveal style="--reveal-order:2">
        <p class="sr-eyebrow">Not enough data yet</p>
        <h3 class="sr-fallback-title">There isn't enough comparable data for a defensible race.</h3>
        <p class="sr-support">Reason: ${escapeHtml(race.fallback_label)}.</p>
      </div>
    `;
  }

  const tone = severityToneForWaitDelta(race.wait_delta_ms);
  const severityLabel =
    tone === 'alert' ? 'Critical wait gap' : tone === 'watch' ? 'Meaningful wait gap' : 'Controlled wait gap';
  const ratio =
    race.urban_ms != null && race.comparison_ms != null && race.urban_ms > 0
      ? Math.round((race.comparison_ms / race.urban_ms) * 100)
      : null;

  return `
    <header class="sr-act-header" data-reveal style="--reveal-order:0">
      <p class="sr-eyebrow">Act 2</p>
      <h2 class="sr-act-title">How far apart are their experiences?</h2>
      <p class="sr-act-lede">${escapeHtml(race.race_story)}</p>
    </header>

    <div class="sr-race" data-reveal style="--reveal-order:2">
      <article class="sr-lane sr-lane-urban" data-tone="urban">
        <header class="sr-lane-header">
          <span class="sr-eyebrow">Urban</span>
          ${renderLaneSampleLine(race.urban_coverage, 'urban')}
        </header>
        ${renderDevice('premium', 'urban-progress')}
        <strong class="sr-mono sr-lane-time" data-role="urban-time">
          ${escapeHtml(formatMetricDuration(race.urban_ms))}
        </strong>
      </article>

      <aside class="sr-wait" aria-live="polite" data-tone="${tone}">
        ${renderSeverityGauge(tone, severityLabel)}
        <p class="sr-eyebrow sr-wait-eyebrow">Wait delta</p>
        <strong class="sr-mono sr-wait-value" data-role="wait-delta" data-wait-final="${escapeHtml(
          race.wait_delta_seconds
        )}">${escapeHtml(race.wait_delta_seconds)}</strong>
        <div class="sr-delta-chip" data-tone="${tone}">
          ${renderIcon('trendingUp', 'sr-icon sr-icon-sm')}
          <span class="sr-delta-chip-abs sr-mono">+${escapeHtml(race.wait_delta_seconds)}</span>
          ${
            ratio != null
              ? `<span class="sr-delta-chip-sep" aria-hidden="true">·</span>
                 <span class="sr-delta-chip-ratio sr-mono">${ratio}% of urban baseline</span>`
              : ''
          }
        </div>
        <p class="sr-wait-caption">${escapeHtml(race.comparison_label)} users wait this much longer than urban users, every visit.</p>
        ${renderAct2LcpStory(race.lcp_story)}
      </aside>

      <article class="sr-lane sr-lane-comparison" data-tone="comparison">
        <header class="sr-lane-header">
          <span class="sr-eyebrow">${escapeHtml(race.comparison_label)}</span>
          ${renderLaneSampleLine(race.comparison_coverage, race.comparison_label)}
        </header>
        ${renderDevice('budget', 'comparison-progress')}
        <strong class="sr-mono sr-lane-time" data-role="comparison-time">
          ${escapeHtml(formatMetricDuration(race.comparison_ms))}
        </strong>
      </article>
    </div>

    ${renderAct2Timeline(race)}
  `;
}

function renderAct2Timeline(race: ReportViewModel['race']): string {
  if (!race.race_available || race.urban_ms == null || race.comparison_ms == null) return '';
  const maxMs = Math.max(race.urban_ms, race.comparison_ms, 1);
  const urbanPct = Math.max(4, Math.round((race.urban_ms / maxMs) * 100));
  const comparisonPct = Math.max(4, Math.round((race.comparison_ms / maxMs) * 100));
  return `
    <div class="sr-timeline-compare" data-reveal style="--reveal-order:3" aria-hidden="true">
      <p class="sr-eyebrow sr-timeline-title">${escapeHtml(race.metric_label)} p75 comparison</p>
      <div class="sr-timeline-tracks">
        <div class="sr-timeline-row" data-tone="urban">
          <span class="sr-timeline-label sr-mono sr-mono-sm">Urban</span>
          <div class="sr-timeline-bar">
            <span class="sr-timeline-fill" style="width: ${urbanPct}%"></span>
            <span class="sr-timeline-marker" style="left: ${urbanPct}%"></span>
          </div>
          <span class="sr-timeline-value sr-mono sr-mono-sm">${escapeHtml(formatMetricDuration(race.urban_ms))}</span>
        </div>
        <div class="sr-timeline-row" data-tone="comparison">
          <span class="sr-timeline-label sr-mono sr-mono-sm">${escapeHtml(race.comparison_label)}</span>
          <div class="sr-timeline-bar">
            <span class="sr-timeline-fill" style="width: ${comparisonPct}%"></span>
            <span class="sr-timeline-marker" style="left: ${comparisonPct}%"></span>
          </div>
          <span class="sr-timeline-value sr-mono sr-mono-sm">${escapeHtml(formatMetricDuration(race.comparison_ms))}</span>
        </div>
      </div>
    </div>
  `;
}

function renderDevice(variant: 'premium' | 'budget', progressRole: string): string {
  const network = variant === 'premium' ? '5G' : '3G';
  const signalLevel = variant === 'premium' ? 4 : 1;
  const batteryLevel = variant === 'premium' ? 82 : 64;
  const bars = [1, 2, 3, 4]
    .map((index) => `<span class="sr-device-signal-bar" data-active="${index <= signalLevel}"></span>`)
    .join('');

  return `
    <div class="sr-device" data-device="${variant}" aria-hidden="true">
      <div class="sr-device-frame">
        <div class="sr-device-screen">
          <div class="sr-device-statusbar">
            <span class="sr-device-time sr-mono">9:41</span>
            <div class="sr-device-status-right">
              <span class="sr-device-signal" title="${network} signal">${bars}</span>
              <span class="sr-device-network sr-mono">${network}</span>
              <span class="sr-device-battery" data-level="${batteryLevel}">
                <span class="sr-device-battery-fill" style="width:${batteryLevel}%"></span>
              </span>
            </div>
          </div>

          ${
            variant === 'premium'
              ? '<div class="sr-device-island" aria-hidden="true"></div>'
              : '<div class="sr-device-punchhole" aria-hidden="true"></div>'
          }

          <div class="sr-device-content">
            <div class="sr-frame-line sr-frame-hero"></div>
            <div class="sr-frame-line sr-frame-body"></div>
            <div class="sr-frame-line sr-frame-body sr-frame-short"></div>
            <div class="sr-frame-line sr-frame-footer"></div>
          </div>

          <div class="sr-device-home" aria-hidden="true"></div>
          <div class="sr-frame-progress" data-role="${escapeHtml(progressRole)}"></div>
        </div>
      </div>
      <div class="sr-device-glare" aria-hidden="true"></div>
    </div>
  `;
}

function stageToneForShare(share: number): SeverityTone {
  if (share >= 50) return 'alert';
  if (share >= 15) return 'watch';
  return 'steady';
}

const ACT3_STAGE_ORDER: ReadonlyArray<{
  key: 'fcp' | 'lcp' | 'inp';
  label: string;
  caption: string;
  tooltip: string;
}> = [
  {
    key: 'fcp',
    label: 'First content appears',
    caption: 'Is the page even trying to load?',
    tooltip:
      "The moment your page shows its first sign of life — a logo, heading, or any visible pixel. Slow here and visitors bounce before they ever see what you're offering."
  },
  {
    key: 'lcp',
    label: 'Main content becomes visible',
    caption: 'Can the user see what they came for?',
    tooltip:
      "The moment your hero image or main content fully renders. This is the visitor's real 'page loaded' sensation — slow here and they've mentally moved on before your value proposition lands."
  },
  {
    key: 'inp',
    label: 'Interaction becomes ready',
    caption: 'Can the user act without waiting?',
    tooltip:
      'The delay between a tap or click and the site responding. Slow here and form submits feel broken, checkouts stall, and trust erodes silently — often costing conversion without any visible error.'
  }
];

/**
 * Act 3 horizontal funnel waterfall (FullStory / ContentSquare journey
 * pattern). Three stage nodes connected by arrow connectors; each connector
 * annotates the inter-stage attrition delta (marginal drop from one step
 * to the next). Inactive stages become dashed placeholder nodes so the
 * reduced-funnel state is a visible property, not an invisible absence.
 */
function renderFunnelWaterfall(act3: ReportViewModel['act3']): string {
  const byKey = new Map(act3.stages.map((stage) => [stage.key, stage]));
  const parts: string[] = [];
  let previousActive: ReportExperienceStageViewModel | null = null;

  ACT3_STAGE_ORDER.forEach(({ key, label, caption, tooltip }, index) => {
    if (index > 0) {
      const current = byKey.get(key);
      parts.push(renderFunnelConnector(previousActive, current ?? null));
    }
    const stage = byKey.get(key);
    if (stage) {
      // The INP node receives an inline phase-story caption when the
      // aggregate carries a defensible INP story (see §3.3 / §4.1).
      // Other nodes pass `null` so the active-node renderer stays generic.
      const inpStoryForNode = stage.key === 'inp' ? act3.inp_story : null;
      parts.push(renderFunnelNodeActive(stage, tooltip, inpStoryForNode));
      previousActive = stage;
    } else {
      parts.push(renderFunnelNodeInactive(key, label, caption, tooltip));
    }
  });

  return `
    <div class="sr-funnel-section" data-reveal style="--reveal-order:3">
      <p class="sr-viz-caption sr-mono">Stage-weighted cohort summaries · not a per-session path</p>
      <div class="sr-funnel-waterfall">${parts.join('')}</div>
    </div>
  `;
}

function renderFunnelNodeActive(
  stage: ReportExperienceStageViewModel,
  tooltip: string,
  inpStory: ReportInpStoryViewModel | null = null
): string {
  const tone = stageToneForShare(stage.weighted_poor_share);
  // Inline INP-phase caption under the threshold line. The caption stays
  // inside the existing node card so the funnel waterfall keeps its
  // three-column rhythm — no new box, no new section (§3.3 of the plan).
  const inpCaption =
    inpStory && stage.key === 'inp'
      ? `<p class="sr-funnel-node-story" data-hedged="${inpStory.is_hedged ? 'true' : 'false'}">${escapeHtml(inpStory.narrative)}</p>`
      : '';
  return `
    <article
      class="sr-funnel-node"
      data-stage="${escapeHtml(stage.key)}"
      data-tone="${tone}"
      data-tooltip="${escapeHtml(tooltip)}"
      tabindex="0"
    >
      <header class="sr-funnel-node-head">
        <span class="sr-funnel-node-icon" aria-hidden="true">${stageIcon(stage.key)}</span>
        <p class="sr-eyebrow sr-funnel-node-label">${escapeHtml(stage.label)}</p>
      </header>
      <strong class="sr-funnel-node-metric sr-mono">${stage.weighted_poor_share}%</strong>
      <p class="sr-funnel-node-threshold sr-mono sr-mono-sm">${escapeHtml(stage.threshold_label)}</p>
      ${inpCaption}
    </article>
  `;
}

function renderFunnelNodeInactive(key: 'fcp' | 'lcp' | 'inp', label: string, caption: string, tooltip: string): string {
  return `
    <article
      class="sr-funnel-node sr-funnel-node-inactive"
      data-stage="${escapeHtml(key)}"
      data-tooltip="${escapeHtml(tooltip)}"
      tabindex="0"
    >
      <header class="sr-funnel-node-head">
        <span class="sr-funnel-node-icon" aria-hidden="true">${stageIcon(key)}</span>
        <p class="sr-eyebrow sr-funnel-node-label">${escapeHtml(label)}</p>
      </header>
      <p class="sr-funnel-node-placeholder sr-mono">—</p>
      <p class="sr-funnel-node-threshold sr-mono sr-mono-sm">Not enough data in this sample</p>
      <p class="sr-funnel-node-caption">${escapeHtml(caption)}</p>
    </article>
  `;
}

function renderFunnelConnector(
  previous: ReportExperienceStageViewModel | null,
  current: ReportExperienceStageViewModel | null
): string {
  if (!previous || !current) {
    return `
      <div class="sr-funnel-connector sr-funnel-connector-inactive" aria-hidden="true">
        ${renderIcon('arrowRight', 'sr-icon sr-icon-sm')}
      </div>
    `;
  }
  const delta = current.weighted_poor_share - previous.weighted_poor_share;
  // Arrow + tone colour carries the stage-to-stage direction. The reader
  // can compare the two node percentages themselves; a text label would
  // just restate what the numbers already show.
  const tone = delta > 5 ? 'alert' : delta > 0 ? 'watch' : delta < 0 ? 'steady' : 'neutral';
  const ariaLabel =
    delta > 0
      ? `Next stage poor-share is ${delta} points higher than the previous stage.`
      : delta < 0
        ? `Next stage poor-share is ${Math.abs(delta)} points lower than the previous stage.`
        : 'Next stage poor-share matches the previous stage.';
  return `
    <div
      class="sr-funnel-connector"
      data-tone="${tone}"
      role="img"
      aria-label="${escapeHtml(ariaLabel)}"
    >
      ${renderIcon('arrowRight', 'sr-icon sr-icon-md')}
    </div>
  `;
}

function renderAct3(viewModel: ReportViewModel): string {
  const act3 = viewModel.act3;

  const header = `
    <header class="sr-act-header" data-reveal style="--reveal-order:0">
      <p class="sr-eyebrow">Act 3</p>
      <h2 class="sr-act-title">Where does performance become poor?</h2>
      <p class="sr-act-lede">${escapeHtml(act3.narrative_line)}</p>
    </header>
  `;

  if (act3.mode === 'legacy') {
    return `
      ${header}
      <div class="sr-legacy" data-reveal style="--reveal-order:1">
        <p class="sr-eyebrow">Reduced legacy state</p>
        <h3 class="sr-fallback-title">${escapeHtml(act3.legacy_message ?? '')}</h3>
        <p class="sr-support">Acts 1 and 2 remain trustworthy. Regenerate the URL to add the measured performance cliff.</p>
      </div>
    `;
  }

  if (act3.active_stage_keys.length === 0) {
    return `
      ${header}
      <div class="sr-legacy" data-reveal style="--reveal-order:1">
        <p class="sr-eyebrow">Insufficient measured data</p>
        <h3 class="sr-fallback-title">No defensible performance funnel in this sample.</h3>
        <p class="sr-support">The classified and measured session count is too low to build a reliable stage-by-stage cliff. Acts 1 and 2 remain trustworthy.</p>
      </div>
    `;
  }

  // Distinguish genuine 0% (measured and found none crossed threshold) from
  // absent (funnel exists but no defensible poor-share measurement). The
  // legacy ?? 0 coercion silently rendered "0% of classified sessions
  // crossed a poor-performance threshold" when the truth was "we couldn't
  // measure this" — actively misleading.
  const hasPoor = act3.poor_session_share != null;
  const hasCoverage = act3.measured_session_coverage != null;
  const poorShare = hasPoor ? (act3.poor_session_share as number) : 0;
  const coverage = hasCoverage ? (act3.measured_session_coverage as number) : 0;
  // Tone computation only trusts a measured share. Absent data defaults to
  // 'steady' (neutral) rather than 'alert' (which would imply risk).
  const tone = hasPoor ? stageToneForShare(poorShare) : 'steady';
  const severityLabel = !hasPoor
    ? 'Performance cliff unmeasurable'
    : tone === 'alert'
      ? 'Critical performance cliff'
      : tone === 'watch'
        ? 'Measurable performance cliff'
        : 'Controlled performance cliff';
  const heroNumber = hasPoor
    ? `<strong class="sr-takeaway-number sr-counter sr-mono" data-role="counter" data-counter-final="${poorShare}">${poorShare}%</strong>`
    : '<strong class="sr-takeaway-number sr-mono sr-takeaway-absent" aria-label="No measured poor-session share available">—</strong>';
  const heroCaption = hasPoor
    ? 'of classified sessions crossed a poor-performance threshold.'
    : 'Insufficient stage-level data to compute the threshold-crossing share for this window.';
  const titleAttr = hasCoverage
    ? `Threshold basis: ${escapeHtml(act3.threshold_basis)} · Confidence: ${coverage}% of sessions had every stage measured`
    : `Threshold basis: ${escapeHtml(act3.threshold_basis)} · Confidence: measured-session coverage unavailable for this window`;

  const reducedNote =
    act3.mode === 'reduced'
      ? `<p class="sr-support sr-reduced-note" data-reveal style="--reveal-order:3">Some stages don't have enough measured data in this sample, so we only show the stages we can prove.</p>`
      : '';

  return `
    ${header}

    <div
      class="sr-act3-hero"
      data-reveal
      style="--reveal-order:1"
      title="${titleAttr}"
    >
      ${renderSeverityGauge(tone, severityLabel)}
      <div class="sr-act3-hero-body">
        ${heroNumber}
        <p class="sr-act3-hero-caption">${heroCaption}</p>
      </div>
    </div>

    ${renderFunnelWaterfall(act3)}

    ${reducedNote}
  `;
}

function renderAct4(viewModel: ReportViewModel): string {
  return `
    <header class="sr-act-header" data-reveal style="--reveal-order:0">
      <p class="sr-eyebrow">Act 4</p>
      <h2 class="sr-act-title">What deeper layer exists beyond this?</h2>
      <p class="sr-act-lede">${escapeHtml(viewModel.act4_lede)}</p>
    </header>

    <div class="sr-act4-body" data-reveal style="--reveal-order:1">
      <div class="sr-act4-findings">
        <p class="sr-act4-findings-eyebrow sr-eyebrow">What you now know</p>
        ${
          viewModel.act4_summary_points.length > 0
            ? `<ul class="sr-act4-findings-list">${viewModel.act4_summary_points
                .map((point) => `<li>${escapeHtml(point)}</li>`)
                .join('')}</ul>`
            : `<p class="sr-act4-findings-empty">This sample did not produce enough measured signal for a defensible summary — Acts 1 and 2 carry the observed evidence.</p>`
        }
      </div>

      <div class="sr-act4-horizon">
        <p class="sr-eyebrow">The boundary of this artifact</p>
        <p class="sr-act4-horizon-body">This report proves the existence and shape of the experience gap. It does not explain root cause, quantify business exposure, or prescribe remediation.</p>
        <div class="sr-offers">
          ${viewModel.offer_cards
            .map(
              (offer, index) => `
                <a class="sr-offer" href="${escapeHtml(offer.href)}" data-offer-index="${index}">
                  <h3 class="sr-offer-title">${escapeHtml(offer.title)}</h3>
                  <p class="sr-offer-body">${escapeHtml(offer.body)}</p>
                  <span class="sr-offer-cta">
                    <span class="sr-offer-cta-label">${escapeHtml(offer.cta)}</span>
                    ${renderIcon('arrowRight', 'sr-icon sr-icon-md sr-offer-cta-icon')}
                  </span>
                </a>
              `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function slowerTakeawayTone(share: number): 'alert' | 'watch' | 'steady' {
  if (share >= 45) return 'alert';
  if (share >= 20) return 'watch';
  return 'steady';
}

function computeSlowerShare(viewModel: ReportViewModel): number {
  return viewModel.act1_tiers
    .filter((tier) => tier.key !== 'urban' && tier.key !== 'unknown')
    .reduce((sum, tier) => sum + tier.share, 0);
}

export function renderReportMarkup(viewModel: ReportViewModel, motionMode: ReportMotionMode): string {
  return renderFullReport(viewModel, motionMode);
}

function renderCredibilityStrip(viewModel: ReportViewModel): string {
  return `
    <div class="sr-credibility-strip">
      <span class="sr-credibility-item">${viewModel.credibility_strip.sample_size.toLocaleString()} sessions</span>
      <span class="sr-credibility-sep" aria-hidden="true">·</span>
      <span class="sr-credibility-item">${viewModel.credibility_strip.period_days}d window</span>
      <span class="sr-credibility-sep" aria-hidden="true">·</span>
      <span class="sr-credibility-item">${viewModel.credibility_strip.classified_share}% classified</span>
      <span class="sr-credibility-sep" aria-hidden="true">·</span>
      <span class="sr-credibility-item">${viewModel.credibility_strip.connection_reuse_share}% conn reuse</span>
      <span class="sr-credibility-sep" aria-hidden="true">·</span>
      <span class="sr-credibility-item">${viewModel.credibility_strip.metric_coverage}% ${escapeHtml(viewModel.credibility_strip.metric_coverage_label)}</span>
      ${
        viewModel.race.fallback_reason != null
          ? `
        <span class="sr-credibility-sep" aria-hidden="true">·</span>
        <span class="sr-credibility-item" data-role="fallback-honesty">${escapeHtml(FOOTER_FALLBACK_COPY[viewModel.race.fallback_reason])}</span>
      `
          : ''
      }
      ${
        viewModel.freshness_known
          ? `
        <span class="sr-credibility-sep" aria-hidden="true">·</span>
        <span class="sr-credibility-item">${new Date(viewModel.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      `
          : ''
      }
    </div>
  `;
}

function renderFooter(viewModel: ReportViewModel): string {
  return `
    <footer class="sr-landing-footer" data-role="persistent-footer">
      <p class="sr-landing-boundary">${escapeHtml(viewModel.boundary_statement)}</p>
      ${renderCredibilityStrip(viewModel)}
      ${viewModel.warnings.length > 0 ? `<div class="sr-warnings">${viewModel.warnings.map((w) => `<p class="sr-warning">${escapeHtml(w)}</p>`).join('')}</div>` : ''}
      <div class="sr-landing-brand">
        <button class="sr-share-btn sr-mono sr-mono-sm" data-role="share-copy" type="button">Copy report link</button>
        <img
          class="sr-wordmark"
          src="${REPORT_BRAND.wordmarkUrl}"
          alt="${escapeHtml(REPORT_BRAND.alt)}"
        />
      </div>
    </footer>
  `;
}

function renderFullReport(viewModel: ReportViewModel, motionMode: ReportMotionMode): string {
  const motionPayload = JSON.stringify(extractMotionPayload(viewModel));
  const slowerShare = computeSlowerShare(viewModel);

  return `
    <div
      class="sr-root"
      data-mood="${escapeHtml(viewModel.mood_tier)}"
      data-motion="${escapeHtml(motionMode)}"
      data-mode="${escapeHtml(viewModel.mode)}"
      data-orchestration="pending"
    >
      <canvas class="sr-canvas" data-role="canvas" aria-hidden="true"></canvas>

      <div class="sr-progress" aria-hidden="true">
        <div class="sr-progress-fill" data-role="scroll-progress"></div>
      </div>

      <button
        class="sr-deck-arrow sr-deck-arrow-prev"
        type="button"
        data-role="deck-prev"
        aria-label="Previous slide"
        disabled
      >
        <span aria-hidden="true">←</span>
      </button>
      <button
        class="sr-deck-arrow sr-deck-arrow-next"
        type="button"
        data-role="deck-next"
        aria-label="Next slide"
      >
        <span aria-hidden="true">→</span>
      </button>

      <nav class="sr-deck-pagination" data-role="deck-pagination" aria-label="Slide navigation">
        <span class="sr-deck-counter sr-mono">
          <span data-role="deck-current-label">01</span>
          <span class="sr-deck-counter-sep">/</span>
          <span>05</span>
        </span>
        <ol class="sr-deck-dots">
          ${['Landing', 'Who are your users?', 'How far apart?', 'Where does it break?', 'What lies beyond?']
            .map(
              (label, index) => `
                <li>
                  <button
                    type="button"
                    class="sr-deck-dot"
                    data-role="deck-dot"
                    data-slide-index="${index}"
                    aria-label="Go to slide ${index + 1}: ${escapeHtml(label)}"
                    ${index === 0 ? 'data-active="true"' : ''}
                  ></button>
                </li>
              `
            )
            .join('')}
        </ol>
      </nav>

      <div class="sr-deck-hint" data-role="deck-hint" aria-hidden="true">
        <span class="sr-mono sr-mono-sm">Use ← → to navigate</span>
      </div>

      <!-- Shared floating tooltip — positioned by the landing-tooltip handler
           (see report-motion.ts). Copy is empathetic interpretation for the
           non-technical buyer, desktop-hover only via @media (hover: hover). -->
      <div
        id="sr-landing-tooltip"
        class="sr-landing-tooltip"
        data-role="landing-tooltip"
        role="tooltip"
        aria-hidden="true"
      ></div>

      ${renderFooter(viewModel)}

      <div class="sr-deck" data-role="deck" style="--deck-current: 0;">
        <section class="sr-landing sr-slide" style="--slide-index: 0;" data-role="landing" data-slide-index="0" aria-labelledby="sr-hero-title">
          <div class="sr-landing-center">
            <div class="sr-landing-hero">
              <span class="sr-mood-pill sr-landing-mood" data-mood="${escapeHtml(viewModel.mood_tier)}" data-reveal style="--reveal-order:0">
                <span class="sr-mood-dot" aria-hidden="true"></span>
                <span class="sr-mono">${escapeHtml(viewModel.hero_kicker)}</span>
              </span>
              <!-- Prelude block — domain + fact line render immediately (no data-reveal) so they
                   appear during Stage A while particles are still drifting in. The .sr-root's
                   data-orchestration="pending" state translates the prelude toward viewport
                   centre; when the state flips, the prelude eases up to its natural position. -->
              <div class="sr-landing-prelude" data-role="landing-prelude">
                <h1 class="sr-hero" id="sr-hero-title">${escapeHtml(viewModel.hero_title)}</h1>
                <p class="sr-landing-fact">
                  <span
                    class="sr-mono sr-landing-fact-number"
                    data-count-up
                    data-count-up-target="${viewModel.sample_size}"
                  >${viewModel.sample_size.toLocaleString()}</span>
                  <span class="sr-landing-fact-text">sessions measured over</span>
                  <span class="sr-mono sr-landing-fact-number">${viewModel.period_days}</span>
                  <span class="sr-landing-fact-text">${viewModel.period_days === 1 ? 'day' : 'days'}</span>
                </p>
              </div>
              <p class="sr-lede" data-reveal style="--reveal-order:1">${escapeHtml(viewModel.hero_lede)}</p>
            </div>

            <div class="sr-kpi-grid" data-reveal style="--reveal-order:7">
              <div
                class="sr-kpi-card"
                data-tone="${escapeHtml(slowerTakeawayTone(slowerShare))}"
                data-tooltip="The share of sessions landing on a measurably weaker network or device tier than your fastest cohort. In paid-media terms, this is the portion of traffic arriving to a different post-click reality than the one your team sees."
                tabindex="0"
              >
                <div class="sr-kpi-card-header">
                  <span class="sr-kpi-icon-badge" aria-hidden="true">
                    ${renderIcon('trendingUp', 'sr-icon sr-icon-sm')}
                  </span>
                </div>
                <strong class="sr-kpi-value sr-mono">${slowerShare}%</strong>
                <span class="sr-kpi-label">slower than urban</span>
              </div>
              <div
                class="sr-kpi-card"
                data-tooltip="Your measured sample. More sessions means more stable tier shares. Below about 200 sessions the shares read as indicative rather than precise."
                tabindex="0"
              >
                <div class="sr-kpi-card-header">
                  <span class="sr-kpi-icon-badge" aria-hidden="true">
                    ${renderIcon('users', 'sr-icon sr-icon-sm')}
                  </span>
                </div>
                <strong class="sr-kpi-value sr-mono">${viewModel.sample_size.toLocaleString()}</strong>
                <span class="sr-kpi-label">sessions measured</span>
              </div>
              <div
                class="sr-kpi-card"
                data-tooltip="The observation window. Seven complete days is canonical — long enough to catch a weekly cycle, short enough to stay current. A single-day snapshot may not capture weekday / weekend variance."
                tabindex="0"
              >
                <div class="sr-kpi-card-header">
                  <span class="sr-kpi-icon-badge" aria-hidden="true">
                    ${renderIcon('zap', 'sr-icon sr-icon-sm')}
                  </span>
                </div>
                <strong class="sr-kpi-value sr-mono">${viewModel.period_days}</strong>
                <span class="sr-kpi-label">${viewModel.period_days === 1 ? 'day' : 'days'} measured</span>
              </div>
            </div>

            <div class="sr-landing-tables" data-reveal style="--reveal-order:8">
              <section class="sr-rail-section" aria-labelledby="sr-rail-network">
                <p class="sr-eyebrow sr-rail-eyebrow" id="sr-rail-network">
                  ${renderIcon('users', 'sr-icon sr-icon-sm')}
                  Network spread
                </p>
                <table class="sr-tier-labels" aria-label="Network tier distribution">${renderTierLabels(viewModel.act1_tiers, viewModel.sample_size)}</table>
              </section>
              <section class="sr-rail-section" aria-labelledby="sr-rail-device">
                <p class="sr-eyebrow sr-rail-eyebrow" id="sr-rail-device">
                  ${renderIcon('smartphone', 'sr-icon sr-icon-sm')}
                  Device spread
                </p>
                <table class="sr-tier-labels" aria-label="Device class distribution">${renderDeviceLabels(viewModel.act1_device_tiers, viewModel.sample_size)}</table>
              </section>
            </div>

          </div>
        </section>

        <section
          class="sr-act sr-act-1 sr-slide"
          style="--slide-index: 1;"
          id="sr-act-1"
          data-act="1"
          data-slide-index="1"
          data-role="act"
        >
          <header class="sr-act-header" data-reveal style="--reveal-order:0">
            <p class="sr-eyebrow">Act 1</p>
            <h2 class="sr-act-title">Who are your users?</h2>
            <p class="sr-act-lede">${escapeHtml(viewModel.act1_intro)}</p>
          </header>

          ${renderPersonaCards(viewModel.persona_contrast)}
          ${renderAct1FormFactor(viewModel.form_factor)}
        </section>

        <section
          class="sr-act sr-act-2 sr-slide"
          style="--slide-index: 2;"
          id="sr-act-2"
          data-act="2"
          data-slide-index="2"
          data-role="act"
        >
          ${renderAct2(viewModel)}
        </section>

        <section
          class="sr-act sr-act-3 sr-slide"
          style="--slide-index: 3;"
          id="sr-act-3"
          data-act="3"
          data-slide-index="3"
          data-role="act"
        >
          ${renderAct3(viewModel)}
        </section>

        <section
          class="sr-act sr-act-4 sr-slide"
          style="--slide-index: 4;"
          id="sr-act-4"
          data-act="4"
          data-slide-index="4"
          data-role="act"
        >
          ${renderAct4(viewModel)}
        </section>
      </div>

      <script type="application/json" id="sr-motion-data">${motionPayload}</script>
    </div>
  `;
}
