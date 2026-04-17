import type {
  SignalAggregateV1,
  SignalExperienceStage,
  SignalInpPhase,
  SignalLcpCulpritKind,
  SignalLcpSubpart,
  SignalNetworkTier,
  SignalRaceMetric
} from './types.js';

const TIER_LABELS: Record<SignalNetworkTier | 'unknown', string> = {
  urban: 'Urban',
  moderate: 'Moderate',
  constrained_moderate: 'Constr. mod',
  constrained: 'Constrained',
  unknown: 'Unknown'
};

const DEVICE_LABELS: Record<'high' | 'mid' | 'low', string> = {
  high: 'High',
  mid: 'Mid',
  low: 'Low'
};

const STAGE_LABELS: Record<SignalExperienceStage, string> = {
  fcp: 'FCP > 3s',
  lcp: 'LCP > 4s',
  inp: 'INP > 500ms'
};

const METRIC_LABELS: Record<SignalRaceMetric, string> = {
  lcp: 'LCP',
  fcp: 'FCP',
  ttfb: 'TTFB',
  none: 'None'
};

const LCP_SUBPART_LABELS: Record<SignalLcpSubpart, string> = {
  ttfb: 'TTFB',
  resource_load_delay: 'Load delay',
  resource_load_time: 'Load time',
  element_render_delay: 'Render delay'
};

const LCP_CULPRIT_LABELS: Record<SignalLcpCulpritKind, string> = {
  hero_image: 'Hero image',
  headline_text: 'Headline text',
  banner_image: 'Banner image',
  product_image: 'Product image',
  video_poster: 'Video poster',
  unknown: 'Unknown'
};

const INP_PHASE_LABELS: Record<SignalInpPhase, string> = {
  input_delay: 'Input delay',
  processing: 'Processing',
  presentation: 'Presentation'
};

function bar(share: number, width: number = 20): string {
  const filled = Math.round((share / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function pct(value: number): string {
  return `${value}%`;
}

function ms(value: number | null): string {
  if (value == null) return 'n/a';
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

function section(title: string): string {
  return `\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length - 4))}`;
}

export function formatSignalSummary(aggregate: SignalAggregateV1): string {
  const lines: string[] = [];

  const date = new Date(aggregate.generated_at);
  const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

  lines.push(`Signal Report · ${aggregate.domain}`);
  lines.push(
    `${aggregate.sample_size.toLocaleString()} sessions · ${aggregate.period_days}d window · ${aggregate.mode} · ${dateStr}`
  );

  // Network tiers
  lines.push(section('Network tiers'));
  const nd = aggregate.network_distribution;
  const tiers: Array<[SignalNetworkTier | 'unknown', number]> = [
    ['urban', nd.urban],
    ['moderate', nd.moderate],
    ['constrained_moderate', nd.constrained_moderate],
    ['constrained', nd.constrained],
    ['unknown', nd.unknown]
  ];
  for (const [key, share] of tiers) {
    if (share === 0) continue;
    lines.push(`  ${pad(TIER_LABELS[key], 13)} ${pad(pct(share), 5)} ${bar(share)}`);
  }

  // Device tiers
  lines.push(section('Device tiers'));
  const dd = aggregate.device_distribution;
  const devices: Array<['high' | 'mid' | 'low', number]> = [
    ['high', dd.high],
    ['mid', dd.mid],
    ['low', dd.low]
  ];
  for (const [key, share] of devices) {
    if (share === 0) continue;
    lines.push(`  ${pad(DEVICE_LABELS[key], 13)} ${pad(pct(share), 5)} ${bar(share)}`);
  }

  // Form factor
  if (aggregate.form_factor_distribution) {
    const ff = aggregate.form_factor_distribution;
    lines.push(section('Form factor'));
    if (ff.mobile > 0) lines.push(`  ${pad('Mobile', 13)} ${pad(pct(ff.mobile), 5)} ${bar(ff.mobile)}`);
    if (ff.tablet > 0) lines.push(`  ${pad('Tablet', 13)} ${pad(pct(ff.tablet), 5)} ${bar(ff.tablet)}`);
    if (ff.desktop > 0) lines.push(`  ${pad('Desktop', 13)} ${pad(pct(ff.desktop), 5)} ${bar(ff.desktop)}`);
  }

  // Race
  lines.push(section('Race'));
  if (aggregate.race_metric === 'none') {
    lines.push('  No comparable race available.');
    if (aggregate.race_fallback_reason) {
      lines.push(`  Reason: ${aggregate.race_fallback_reason.replaceAll('_', ' ')}`);
    }
  } else {
    const urbanMs = metricValue(aggregate.race_metric, aggregate.vitals.urban);
    const compMs = metricValue(aggregate.race_metric, aggregate.vitals.comparison);
    const delta = urbanMs != null && compMs != null ? compMs - urbanMs : null;
    const compLabel = TIER_LABELS[aggregate.comparison_tier as SignalNetworkTier] ?? aggregate.comparison_tier;

    lines.push(
      `  Metric:     ${METRIC_LABELS[aggregate.race_metric]}${aggregate.race_fallback_reason ? ` (fallback: ${aggregate.race_fallback_reason.replaceAll('_', ' ')})` : ''}`
    );
    lines.push(`  Urban p75:  ${ms(urbanMs)}`);
    lines.push(`  ${compLabel} p75: ${ms(compMs)}`);
    if (delta != null) {
      lines.push(`  Wait delta: +${ms(delta)}`);
    }
  }

  // LCP story
  if (aggregate.lcp_story) {
    const story = aggregate.lcp_story;
    lines.push(section('LCP story'));
    if (story.dominant_subpart && story.dominant_subpart_share_pct != null) {
      lines.push(
        `  Dominant:     ${LCP_SUBPART_LABELS[story.dominant_subpart]} (${pct(story.dominant_subpart_share_pct)})`
      );
    } else {
      lines.push('  Dominant:     no clear dominant subpart');
    }
    if (story.dominant_culprit_kind && story.dominant_culprit_kind !== 'unknown') {
      lines.push(`  Culprit:      ${LCP_CULPRIT_LABELS[story.dominant_culprit_kind]}`);
    }
    if (story.subpart_distribution_pct) {
      const dist = story.subpart_distribution_pct;
      const rows: Array<[SignalLcpSubpart, number]> = [
        ['ttfb', dist.ttfb],
        ['resource_load_delay', dist.resource_load_delay],
        ['resource_load_time', dist.resource_load_time],
        ['element_render_delay', dist.element_render_delay]
      ];
      for (const [key, share] of rows) {
        lines.push(`  ${pad(LCP_SUBPART_LABELS[key], 13)} ${pad(pct(share), 5)} ${bar(share)}`);
      }
    }
  }

  // INP story
  if (aggregate.inp_story) {
    const story = aggregate.inp_story;
    lines.push(section('INP story'));
    if (story.dominant_phase && story.dominant_phase_share_pct != null) {
      lines.push(`  Dominant:     ${INP_PHASE_LABELS[story.dominant_phase]} (${pct(story.dominant_phase_share_pct)})`);
    } else {
      lines.push('  Dominant:     no clear dominant phase');
    }
    if (story.phase_distribution_pct) {
      const dist = story.phase_distribution_pct;
      const rows: Array<[SignalInpPhase, number]> = [
        ['input_delay', dist.input_delay],
        ['processing', dist.processing],
        ['presentation', dist.presentation]
      ];
      for (const [key, share] of rows) {
        lines.push(`  ${pad(INP_PHASE_LABELS[key], 13)} ${pad(pct(share), 5)} ${bar(share)}`);
      }
    }
  }

  // Experience funnel
  const funnel = aggregate.experience_funnel;
  if (funnel) {
    lines.push(section('Experience funnel'));
    if (funnel.active_stages.length === 0) {
      lines.push('  No active stages in this sample.');
    } else {
      lines.push(`  Poor session share: ${pct(funnel.poor_session_share)}`);
      lines.push(`  Measured coverage:  ${pct(funnel.measured_session_coverage)}`);
      lines.push('');
      for (const stageKey of funnel.active_stages) {
        const stage = funnel.stages[stageKey];
        const classifiedTiers = (['urban', 'moderate', 'constrained_moderate', 'constrained'] as const).filter(
          (t) => stage.tiers[t].coverage > 0
        );
        const weightedPoor =
          classifiedTiers.length > 0
            ? Math.round(
                classifiedTiers.reduce((sum, t) => sum + stage.tiers[t].poor_share, 0) / classifiedTiers.length
              )
            : 0;
        lines.push(`  ${pad(STAGE_LABELS[stageKey], 15)} ${pad(`${pct(weightedPoor)} poor`, 10)}`);
      }
    }
  } else {
    lines.push(section('Experience funnel'));
    lines.push('  Legacy aggregate — no experience funnel data. Regenerate URL for full funnel.');
  }

  // Coverage
  lines.push(section('Coverage'));
  const cov = aggregate.coverage;
  lines.push(`  Classified:       ${pct(cov.network_coverage)}`);
  lines.push(`  Conn. reuse:      ${pct(cov.connection_reuse_share)}`);
  lines.push(`  LCP coverage:     ${pct(cov.lcp_coverage)}`);
  if (cov.selected_metric_urban_coverage != null) {
    lines.push(`  Race urban cov:   ${pct(cov.selected_metric_urban_coverage)}`);
  }
  if (cov.selected_metric_comparison_coverage != null) {
    lines.push(`  Race comp. cov:   ${pct(cov.selected_metric_comparison_coverage)}`);
  }

  // Warnings
  if (aggregate.warnings.length > 0) {
    lines.push(section('Warnings'));
    for (const w of aggregate.warnings) {
      lines.push(`  ⚠ ${w}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function metricValue(
  metric: SignalRaceMetric,
  scope: { lcp_ms: number | null; fcp_ms: number | null; ttfb_ms: number | null }
): number | null {
  switch (metric) {
    case 'lcp':
      return scope.lcp_ms;
    case 'fcp':
      return scope.fcp_ms;
    case 'ttfb':
      return scope.ttfb_ms;
    default:
      return null;
  }
}
