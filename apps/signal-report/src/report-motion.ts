import type { ReportMotionMode, ReportMotionPayload } from './report-view-model';

type Phase = 'idle' | 'reveal' | 'cluster-hold' | 'race' | 'funnel' | 'horizon';

type ParticleState = 'entering' | 'clustering' | 'streaming' | 'flowing' | 'falling' | 'horizon';

export const DECK_TOTAL_SLIDES = 5;

/**
 * Pure mapping of deck slide index → particle phase. Exported so unit tests
 * can cover the mapping without needing a DOM. Slide 0 keeps particles in
 * their initial reveal/cluster state; Act 1 holds the cluster formation
 * with minimal drift; Acts 2/3/4 progress through race/funnel/horizon.
 */
export function computePhaseForSlide(index: number): Phase {
  const clamped = clampSlideIndex(index);
  switch (clamped) {
    case 0:
      return 'reveal';
    case 1:
      return 'cluster-hold';
    case 2:
      return 'race';
    case 3:
      return 'funnel';
    case 4:
      return 'horizon';
    default:
      return 'reveal';
  }
}

/**
 * Clamp an arbitrary integer (or parsed URL hash value) to the valid deck
 * slide range. Exported so unit tests can cover the edge cases.
 */
export function clampSlideIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  if (index < 0) return 0;
  if (index > DECK_TOTAL_SLIDES - 1) return DECK_TOTAL_SLIDES - 1;
  return Math.floor(index);
}

interface Particle {
  tier: string;
  color: string;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  clusterX: number;
  clusterY: number;
  homeOffsetX: number;
  homeOffsetY: number;
  opacity: number;
  targetOpacity: number;
  state: ParticleState;
  // Timestamp of the entering→clustering state flip. Drives the gather →
  // jump → dissolve phased spring in updateParticle. Null when the particle
  // was flipped by a non-orchestrated path (mobile / qa skip), in which
  // case the legacy steady-state spring is used.
  clusterStartedAt: number | null;
  // Particles whose home sits on the outer edge of the cluster pool fade
  // to a dimmer target opacity during the dissolve phase, creating the
  // "dense inner core + soft halo" silhouette that reads as sessions
  // melting into the tier-dot.
  outerParticle: boolean;
}

interface DeckState {
  enabled: boolean;
  currentSlide: number;
  totalSlides: number;
  visitedSlides: Set<number>;
  container: HTMLElement | null;
  slides: HTMLElement[];
  counterLabel: HTMLElement | null;
  dots: HTMLElement[];
  prevButton: HTMLButtonElement | null;
  nextButton: HTMLButtonElement | null;
  hint: HTMLElement | null;
  keydownHandler: ((event: KeyboardEvent) => void) | null;
  popstateHandler: ((event: PopStateEvent) => void) | null;
}

interface MotionRuntime {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  particles: Particle[];
  phase: Phase;
  rafId: number | null;
  scrollRafPending: boolean;
  payload: ReportMotionPayload;
  moodMultiplier: number;
  actsObserved: Set<number>;
  horizonEntryAt: number | null;
  reachedHorizon: boolean;
  scrollableHeight: number;
  resizeTimer: number | null;
  deck: DeckState;
  // When true, initDeck holds slide 0's data-visible attribute so that
  // runLandingOrchestration can flip it at the correct beat.
  holdLandingReveal: boolean;
}

const TIER_COLORS: Record<string, string> = {
  urban: '#378add',
  moderate: '#5dcaa5',
  constrained_moderate: '#ef9f27',
  constrained: '#e24b4a',
  unknown: '#888780'
};

const TIER_COLOR_FALLBACK = '#888780';

function moodMultiplierFor(mood: ReportMotionPayload['mood']): number {
  if (mood === 'urgent') return 1.3;
  if (mood === 'affirming') return 0.75;
  return 1;
}

function readMotionPayload(root: HTMLElement): ReportMotionPayload | null {
  const script = root.querySelector<HTMLScriptElement>('script#sr-motion-data');
  const raw = script?.textContent?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReportMotionPayload;
  } catch {
    return null;
  }
}

function sizeCanvas(runtime: MotionRuntime): void {
  runtime.width = window.innerWidth;
  runtime.height = window.innerHeight;
  runtime.dpr = Math.min(window.devicePixelRatio || 1, 2);
  runtime.canvas.width = Math.floor(runtime.width * runtime.dpr);
  runtime.canvas.height = Math.floor(runtime.height * runtime.dpr);
  runtime.canvas.style.width = `${runtime.width}px`;
  runtime.canvas.style.height = `${runtime.height}px`;
  runtime.ctx.setTransform(runtime.dpr, 0, 0, runtime.dpr, 0, 0);
}

/**
 * Resolve cluster anchor positions for the given slide. Different slides
 * position their pools differently:
 *   - Slide 0 (landing): pool sits AT the tier-row's left edge, aligned
 *     horizontally with the tier-dot and vertically centred on the row.
 *     Creates the literal "each particle is a session in this tier"
 *     metaphor — the cluster dissolves into the row's coloured dot.
 *   - Slide 1 (Act 1 narrative cards): pool sits BELOW each narrative card,
 *     centred under its horizontal midpoint — a compact blob attached to
 *     the base of the card.
 * When no slide is passed (scroll mode or bootstrap before deck init), the
 * resolver falls back to the whole root and the landing-style math.
 */
function resolveClusterAnchors(runtime: MotionRuntime, slideIndex?: number): Map<string, { x: number; y: number }> {
  const anchors = new Map<string, { x: number; y: number }>();
  const scope = slideIndex != null && runtime.deck.slides[slideIndex] ? runtime.deck.slides[slideIndex] : runtime.root;
  const nodes = scope.querySelectorAll<HTMLElement>('[data-cluster-anchor]');

  for (const node of nodes) {
    const key = node.dataset.clusterAnchor;
    if (!key) continue;
    const rect = node.getBoundingClientRect();

    if (slideIndex === 1) {
      // Act 1 narrative: pool sits BELOW the narrative card, centred.
      const clampedY = Math.min(runtime.height - 60, rect.bottom + 52);
      anchors.set(key, {
        x: rect.left + rect.width / 2,
        y: clampedY
      });
      continue;
    }

    // Landing positioning: aligned with the tier-dot at the row's left
    // edge. The ~20px offset compensates for the cell's left padding plus
    // the dot's own inset inside the flex layout of .sr-tier-label-name.
    // Vertically centred on the row so the cluster reads as "this row's
    // tier-dot, multiplied by session count".
    const centerY = rect.top + rect.height / 2;
    const clusterX = rect.left + 20;
    anchors.set(key, {
      x: clusterX,
      y: centerY
    });
  }
  return anchors;
}

function refreshClusterAnchors(runtime: MotionRuntime, slideIndex?: number): void {
  const anchors = resolveClusterAnchors(runtime, slideIndex);
  if (anchors.size === 0) return;
  for (const particle of runtime.particles) {
    const anchor = anchors.get(particle.tier);
    if (!anchor) continue;
    particle.clusterX = anchor.x;
    particle.clusterY = anchor.y;
  }
}

function createParticles(runtime: MotionRuntime): void {
  const tiers = runtime.payload.act1.tiers.filter((tier) => tier.share > 0);
  const totalShare = tiers.reduce((sum, tier) => sum + tier.share, 0);
  if (totalShare <= 0) {
    runtime.particles = [];
    return;
  }

  const base = runtime.width < 768 ? 80 : 160;
  const particles: Particle[] = [];
  // On init, query the landing anchors (slide 0). The deck will
  // retarget on slide navigation via refreshClusterAnchors.
  const anchors = resolveClusterAnchors(runtime, 0);
  const fallbackClusterY = runtime.height * 0.5;

  tiers.forEach((tier, index) => {
    const count = Math.max(8, Math.round((tier.share / totalShare) * base));
    const color = TIER_COLORS[tier.key] ?? TIER_COLOR_FALLBACK;
    const anchor = anchors.get(tier.key);
    const sectionWidth = runtime.width / tiers.length;
    const clusterX = anchor?.x ?? sectionWidth * (index + 0.5);
    const clusterY = anchor?.y ?? fallbackClusterY;

    // Tight vertical column — reads as a "bar" of dots aligned to the tier
    // row's left edge rather than a loose radial blob. poolHeight clamps at
    // ~20px so low-share tiers still form a visible stack and high-share
    // tiers don't bleed into neighbouring rows. Skewed more vertical than
    // horizontal so outer particles form a soft top/bottom halo around the
    // tier-dot rather than spilling sideways into the row copy.
    const countScale = Math.sqrt(count);
    const poolWidth = 6;
    const poolHeight = Math.min(20, 8 + countScale * 1.2);

    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random());
      const homeOffsetX = Math.cos(angle) * distance * poolWidth;
      const homeOffsetY = Math.sin(angle) * distance * poolHeight;
      particles.push({
        tier: tier.key,
        color,
        radius: 1.6 + tier.share / 40 + Math.random() * 0.5,
        x: Math.random() * runtime.width,
        y: Math.random() * runtime.height,
        vx: (Math.random() - 0.5) * 1.1,
        vy: (Math.random() - 0.5) * 1.1,
        clusterX,
        clusterY,
        homeOffsetX,
        homeOffsetY,
        opacity: 0,
        targetOpacity: 0.55 + Math.random() * 0.3,
        state: 'entering',
        clusterStartedAt: null,
        // ~30% of particles are "outer" — those with |homeOffsetY| above
        // 55% of pool height. These fade to 65% target opacity during the
        // dissolve phase, forming the soft halo that makes the bright
        // inner core read as the tier's concentrated presence.
        outerParticle: Math.abs(homeOffsetY) > poolHeight * 0.55
      });
    }
  });

  runtime.particles = particles;
}

function updateParticle(particle: Particle, runtime: MotionRuntime): void {
  const { phase, width, height, moodMultiplier } = runtime;

  if (particle.targetOpacity <= 0) {
    particle.opacity = Math.max(0, particle.opacity - 0.015);
    return;
  }

  if (phase === 'reveal') {
    if (particle.state === 'entering') {
      particle.x += particle.vx + (Math.random() - 0.5) * 0.25;
      particle.y += particle.vy + (Math.random() - 0.5) * 0.25;
      if (particle.opacity < particle.targetOpacity) particle.opacity += 0.014;
      return;
    }
    if (particle.state === 'clustering') {
      const homeX = particle.clusterX + particle.homeOffsetX;
      const homeY = particle.clusterY + particle.homeOffsetY;
      const dx = homeX - particle.x;
      const dy = homeY - particle.y;
      const distance = Math.hypot(dx, dy);
      const elapsed = particle.clusterStartedAt != null ? performance.now() - particle.clusterStartedAt : null;

      // Phased spring — only the orchestrated path (elapsed != null) runs
      // the gather → jump → dissolve choreography. Mobile and qa-skip paths
      // keep the legacy steady-state spring so unorchestrated entrances
      // still look coherent.
      let springConstant: number;
      let jitter: number;

      if (elapsed == null) {
        // Non-orchestrated (mobile / qa skip): legacy steady spring.
        springConstant = 0.06;
        jitter = distance < 8 ? 0.18 : 0.35;
      } else if (elapsed < CLUSTER_GATHER_MS) {
        // GATHER — particles pause in place, velocity dampened. The 220ms
        // lull reads as "listening" before the jump. Low spring + small
        // jitter means they stop drifting but don't snap yet.
        springConstant = 0.012;
        jitter = 0.14;
      } else if (elapsed < CLUSTER_GATHER_MS + CLUSTER_JUMP_MS) {
        // JUMP — decisive acceleration toward home. Spring ramps from
        // gather to peak over the first 120ms of the jump window, then
        // holds. Jitter minimum → directional, clean convergence.
        const rampT = Math.min(1, (elapsed - CLUSTER_GATHER_MS) / CLUSTER_JUMP_RAMP_MS);
        springConstant = CLUSTER_GATHER_SPRING + (CLUSTER_JUMP_SPRING - CLUSTER_GATHER_SPRING) * rampT;
        jitter = 0.07;
      } else if (elapsed < CLUSTER_GATHER_MS + CLUSTER_JUMP_MS + CLUSTER_DISSOLVE_MS) {
        // DISSOLVE — spring decays from peak back to steady state as the
        // particle nears home; jitter returns to its living-motion level.
        // Outer particles begin fading toward 65% of target opacity, so
        // the bright inner core reads as the concentrated tier presence
        // and the softer halo reads as "dissolving into the row".
        const dissolveT = Math.min(1, (elapsed - CLUSTER_GATHER_MS - CLUSTER_JUMP_MS) / CLUSTER_DISSOLVE_MS);
        const eased = 1 - (1 - dissolveT) ** 3;
        springConstant = CLUSTER_JUMP_SPRING - (CLUSTER_JUMP_SPRING - CLUSTER_HOMED_SPRING) * eased;
        jitter = 0.07 + (0.22 - 0.07) * eased;
      } else {
        // HOMED — settled. Gentle living motion so the cluster still feels
        // alive without drawing the eye away from surrounding content.
        springConstant = CLUSTER_HOMED_SPRING;
        jitter = distance < 8 ? 0.18 : 0.3;
      }

      particle.x += dx * springConstant;
      particle.y += dy * springConstant;
      particle.x += (Math.random() - 0.5) * jitter;
      particle.y += (Math.random() - 0.5) * jitter;

      // Opacity target: outer particles fade to 65% once the dissolve beat
      // begins. Inner particles always target full targetOpacity. Lerp
      // toward whichever target applies — going UP fades in, going DOWN
      // softens the outer halo on dissolve.
      const dissolveStarted = elapsed != null && elapsed >= CLUSTER_GATHER_MS + CLUSTER_JUMP_MS;
      const opacityTarget =
        dissolveStarted && particle.outerParticle
          ? particle.targetOpacity * CLUSTER_OUTER_OPACITY_RATIO
          : particle.targetOpacity;
      if (particle.opacity < opacityTarget) {
        particle.opacity = Math.min(opacityTarget, particle.opacity + 0.012);
      } else if (particle.opacity > opacityTarget) {
        particle.opacity = Math.max(opacityTarget, particle.opacity - 0.008);
      }
      return;
    }
  }

  if (phase === 'cluster-hold') {
    // Act 1: particles drift to the top of the viewport and dim to an
    // ambient presence so the persona cards and data own the attention.
    const ceilingY = height * 0.08 + particle.homeOffsetY * 0.3;
    const targetX = width / 2 + particle.homeOffsetX * 1.2;
    particle.x += (targetX - particle.x) * 0.025;
    particle.y += (ceilingY - particle.y) * 0.03;
    particle.x += (Math.random() - 0.5) * 0.3;
    particle.y += (Math.random() - 0.5) * 0.15;
    const ambient = 0.14;
    if (particle.opacity > ambient) {
      particle.opacity = Math.max(ambient, particle.opacity - 0.008);
    } else if (particle.opacity < ambient) {
      particle.opacity = Math.min(ambient, particle.opacity + 0.004);
    }
    return;
  }

  if (phase === 'race') {
    const targetY = height * 0.14 + (Math.random() - 0.5) * 18;
    particle.y += (targetY - particle.y) * 0.045;
    particle.x += (Math.random() - 0.5) * 0.55;
    particle.opacity = Math.max(0.1, particle.opacity - 0.012);
    return;
  }

  if (phase === 'funnel') {
    const cliffY = height * 0.44;
    const bottom = height + 40;

    if (particle.state === 'falling') {
      particle.vy += 0.32 * moodMultiplier;
      particle.y += particle.vy;
      particle.x += particle.vx;
      particle.opacity -= 0.012;
      if (particle.opacity <= 0 || particle.y > bottom) {
        particle.state = 'flowing';
        particle.y = height * 0.1 + Math.random() * 36;
        particle.x = width * 0.3 + Math.random() * (width * 0.4);
        particle.vy = 1.2 + Math.random();
        particle.vx = 0;
        particle.opacity = 0;
      }
      return;
    }

    if (particle.opacity < particle.targetOpacity) particle.opacity += 0.018;
    particle.y += 1.7 + moodMultiplier * 0.35;
    particle.state = 'flowing';

    const centerX = width / 2;
    const funnelHalf = width * 0.22;
    const progress = Math.max(0, (particle.y - height * 0.1) / (height * 0.55));
    const halfWidth = funnelHalf * (1 - Math.min(0.72, progress ** 0.55));
    if (particle.x < centerX - halfWidth) particle.x += 1.8;
    if (particle.x > centerX + halfWidth) particle.x -= 1.8;

    if (particle.y > cliffY && particle.y < cliffY + 10) {
      const poorShare = runtime.payload.act3.poor_session_share ?? 0;
      const fallChance = fallChanceFor(particle.tier, poorShare, moodMultiplier);
      if (Math.random() < fallChance) {
        particle.state = 'falling';
        particle.vx = (Math.random() - 0.4) * 4.2;
        particle.vy = 1 + Math.random() * 0.8;
      }
    }

    if (particle.y > bottom) {
      particle.y = height * 0.1;
      particle.x = width * 0.3 + Math.random() * (width * 0.4);
    }
    return;
  }

  if (phase === 'horizon') {
    // Surviving particles ease into a thin horizon band at the bottom of
    // the viewport and dim to an ambient glow; particles still falling
    // from Act 3 continue off-screen and fade out.
    if (particle.state === 'falling') {
      particle.vy += 0.3 * moodMultiplier;
      particle.y += particle.vy;
      particle.x += particle.vx;
      particle.opacity = Math.max(0, particle.opacity - 0.02);
      return;
    }

    const horizonY = height * 0.86;
    const targetX = width / 2 + particle.homeOffsetX;
    const targetY = horizonY + particle.homeOffsetY + Math.sin(particle.x * 0.012) * 3;
    const dx = targetX - particle.x;
    const dy = targetY - particle.y;
    particle.x += dx * 0.055;
    particle.y += dy * 0.065;
    particle.vx *= 0.92;
    particle.vy *= 0.92;

    // Dim to an ambient horizon presence so the handoff feels resolved,
    // not abandoned. ~0.22 keeps the line visible without drawing focus.
    const ambient = 0.22;
    if (particle.opacity > ambient) {
      particle.opacity = Math.max(ambient, particle.opacity - 0.006);
    } else if (particle.opacity < ambient) {
      particle.opacity = Math.min(ambient, particle.opacity + 0.01);
    }
  }
}

const TIER_FALL_WEIGHT: Record<string, number> = {
  urban: 0.08,
  moderate: 0.22,
  constrained_moderate: 0.55,
  constrained: 0.85,
  unknown: 0.2
};

function fallChanceFor(tier: string, poorShare: number, multiplier: number): number {
  const base = poorShare / 100;
  const w = TIER_FALL_WEIGHT[tier] ?? 0.2;
  return Math.min(0.72, base * w * multiplier);
}

const ALPHA_BINS = 4;
const TAU = Math.PI * 2;

function draw(runtime: MotionRuntime): void {
  const { ctx, width, height, particles } = runtime;
  ctx.clearRect(0, 0, width, height);

  // Batch particles by (color, alpha-bin) so one path per bucket is
  // rasterised per frame instead of N separate beginPath/arc/fill calls.
  // With 5 tier colours × 4 alpha bins the upper bound is 20 fills/frame
  // instead of ~160, which is the single biggest per-frame main-thread
  // win for the particle system.
  const buckets = new Map<string, Particle[]>();
  for (const particle of particles) {
    if (particle.opacity <= 0.01) continue;
    const clamped = particle.opacity > 1 ? 1 : particle.opacity;
    const bin = Math.min(ALPHA_BINS - 1, Math.floor(clamped * ALPHA_BINS));
    const key = `${particle.color}|${bin}`;
    const existing = buckets.get(key);
    if (existing) existing.push(particle);
    else buckets.set(key, [particle]);
  }

  for (const [key, bucket] of buckets) {
    const separatorIndex = key.indexOf('|');
    const color = key.slice(0, separatorIndex);
    const bin = Number(key.slice(separatorIndex + 1));
    // Mid-bin alpha so visible banding across bins stays soft.
    ctx.globalAlpha = (bin + 0.5) / ALPHA_BINS;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const particle of bucket) {
      // moveTo before arc so arcs don't connect via implicit lineTo,
      // which would otherwise draw spiderweb lines between particles.
      ctx.moveTo(particle.x + particle.radius, particle.y);
      ctx.arc(particle.x, particle.y, particle.radius, 0, TAU);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function tick(runtime: MotionRuntime): void {
  for (const particle of runtime.particles) {
    updateParticle(particle, runtime);
  }
  draw(runtime);

  // Idle bailout: horizon phase is terminal. Once particles have had
  // enough time to settle into their ambient horizon band and dim, stop
  // the RAF loop so the main thread can breathe. The visual result is a
  // static horizon line — no ongoing paint, no dropped frames while the
  // reader engages with Act 4.
  if (
    runtime.phase === 'horizon' &&
    runtime.horizonEntryAt != null &&
    performance.now() - runtime.horizonEntryAt > 2200
  ) {
    runtime.rafId = null;
    return;
  }

  runtime.rafId = window.requestAnimationFrame(() => tick(runtime));
}

function revealAct(runtime: MotionRuntime, actNumber: number): void {
  if (runtime.actsObserved.has(actNumber)) return;
  runtime.actsObserved.add(actNumber);
  const section = runtime.root.querySelector<HTMLElement>(`[data-act="${actNumber}"]`);
  section?.setAttribute('data-visible', 'true');

  if (actNumber === 2) {
    runtime.phase = 'race';
    runAct2Race(runtime);
  } else if (actNumber === 3) {
    runtime.phase = 'funnel';
    for (const particle of runtime.particles) {
      if (particle.state !== 'falling') particle.state = 'flowing';
    }
    runAct3Counter(runtime);
  } else if (actNumber === 4) {
    runtime.phase = 'horizon';
    runtime.horizonEntryAt = performance.now();
    // Assign a permanent horizon home so particles settle into a calm
    // horizontal band across the bottom of the viewport rather than
    // freezing in place. Falling particles keep falling (they are gone).
    for (const particle of runtime.particles) {
      if (particle.state === 'falling') continue;
      particle.state = 'horizon';
      particle.homeOffsetX = (Math.random() - 0.5) * runtime.width * 0.9;
      particle.homeOffsetY = (Math.random() - 0.5) * 14;
    }
  }
}

function observeActs(runtime: MotionRuntime): IntersectionObserver {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const actRaw = entry.target.getAttribute('data-act');
        const actNumber = actRaw ? Number(actRaw) : NaN;
        if (Number.isFinite(actNumber)) revealAct(runtime, actNumber);
      }
    },
    { threshold: 0.32 }
  );
  for (const section of runtime.root.querySelectorAll<HTMLElement>('[data-role="act"]')) {
    observer.observe(section);
  }
  return observer;
}

// Playback plays real milliseconds so the animation matches the displayed
// wait delta 1:1. The floors keep sub-400ms readings visible and the
// ceiling clips pathological outliers so the deck stays watchable without
// distorting the 99% of real aggregates.
// Each device fill runs at its REAL p75 ms so the gradient duration
// matches the displayed timing number exactly. Only a ceiling caps
// pathological outliers (>10s) for watchability.
const RACE_PLAYBACK_CEILING_MS = 10_000;

// Race choreography:
//   t=0:        Both devices start filling simultaneously. Urban at its
//               real ms (e.g. 2400ms), comparison at its real ms (e.g.
//               6100ms). Wait delta shows 0.0s.
//   t=urbanMs:  Urban finishes (teal screen). Wait delta counter starts
//               counting up from 0.0s.
//   t=compMs:   Comparison finishes (red screen). Counter stops at the
//               final delta (e.g. 3.7s).
//
// Both fills use linear timing so progress matches wall-clock seconds 1:1.
function runAct2Race(runtime: MotionRuntime): void {
  if (!runtime.payload.act2.available) return;
  const urban = runtime.root.querySelector<HTMLElement>('[data-role="urban-progress"]');
  const comparison = runtime.root.querySelector<HTMLElement>('[data-role="comparison-progress"]');
  const waitEl = runtime.root.querySelector<HTMLElement>('[data-role="wait-delta"]');

  const rawUrbanMs = runtime.payload.act2.urban_ms;
  const rawComparisonMs = runtime.payload.act2.comparison_ms;
  // If either measurement is null the race has no defensible magnitude
  // to play against — render static. Fabricating decorative timings
  // (prior default was 2100/3400ms) risks the reader inferring numbers
  // from motion when none were measured.
  if (rawUrbanMs == null || rawComparisonMs == null) return;
  const waitDeltaMs = runtime.payload.act2.wait_delta_ms ?? 0;

  const urbanFillMs = Math.min(RACE_PLAYBACK_CEILING_MS, rawUrbanMs);
  const comparisonFillMs = Math.min(RACE_PLAYBACK_CEILING_MS, rawComparisonMs);

  if (waitEl) waitEl.textContent = '0.0s';

  // Both devices start filling at t=0, each at their real duration.
  if (urban) {
    urban.style.transitionDuration = `${urbanFillMs}ms`;
    window.requestAnimationFrame(() => {
      urban.style.transform = 'scaleY(1)';
    });
  }
  if (comparison) {
    comparison.style.transitionDuration = `${comparisonFillMs}ms`;
    window.requestAnimationFrame(() => {
      comparison.style.transform = 'scaleY(1)';
    });
  }

  // Wait delta counter starts after urban finishes and runs until
  // comparison finishes — the counter duration IS the gap.
  if (!waitEl || waitDeltaMs <= 0) return;
  const finalLabel = waitEl.dataset.waitFinal ?? waitEl.textContent ?? '';
  const counterDurationMs = Math.max(500, comparisonFillMs - urbanFillMs);

  setTimeout(() => {
    const startAt = performance.now();
    const animate = (now: number): void => {
      const elapsed = Math.min(1, (now - startAt) / counterDurationMs);
      const seconds = (waitDeltaMs / 1000) * elapsed;
      waitEl.textContent = `${seconds.toFixed(1)}s`;
      if (elapsed < 1) {
        window.requestAnimationFrame(animate);
      } else {
        waitEl.textContent = finalLabel;
      }
    };
    window.requestAnimationFrame(animate);
  }, urbanFillMs);
}

function runAct3Counter(runtime: MotionRuntime): void {
  const counter = runtime.root.querySelector<HTMLElement>('[data-role="counter"]');
  if (!counter) return;
  const final = Number(counter.dataset.counterFinal ?? '0');
  if (!Number.isFinite(final) || final <= 0) {
    counter.textContent = `${Number.isFinite(final) ? final : 0}%`;
    return;
  }
  const durationMs = 1200;
  const startAt = performance.now();

  const animate = (now: number): void => {
    const elapsed = Math.min(1, (now - startAt) / durationMs);
    const eased = 1 - (1 - elapsed) ** 3;
    counter.textContent = `${Math.round(final * eased)}%`;
    if (elapsed < 1) {
      window.requestAnimationFrame(animate);
    } else {
      counter.textContent = `${final}%`;
    }
  };
  window.requestAnimationFrame(animate);
}

function attachScrollProgress(runtime: MotionRuntime): void {
  const fill = runtime.root.querySelector<HTMLElement>('[data-role="scroll-progress"]');
  if (!fill) return;

  // Reading scrollHeight triggers a synchronous style + layout recalc.
  // Cache it once and invalidate only on resize (done in the resize
  // handler below) so the scroll listener stays off the layout path.
  runtime.scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;

  const update = (): void => {
    runtime.scrollRafPending = false;
    const scrollable = runtime.scrollableHeight;
    const ratio = scrollable > 0 ? Math.max(0, Math.min(1, window.scrollY / scrollable)) : 0;
    fill.style.width = `${(ratio * 100).toFixed(2)}%`;
  };

  const onScroll = (): void => {
    if (runtime.scrollRafPending) return;
    runtime.scrollRafPending = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  update();
}

/* -------------------------------------------------------------------- */
/* Deck runtime                                                          */
/* -------------------------------------------------------------------- */

const DECK_HINT_STORAGE_KEY = 'sr-deck-hint-shown';
const DECK_HINT_TIMEOUT_MS = 3500;

function parseSlideFromHash(): number | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const match = /slide=(\d+)/.exec(hash);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return clampSlideIndex(parsed);
}

function writeSlideHash(index: number, replace: boolean): void {
  if (typeof window === 'undefined') return;
  const next = `#slide=${index}`;
  if (window.location.hash === next) return;
  if (replace) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`);
  } else {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${next}`);
  }
}

function updateDeckPagination(runtime: MotionRuntime): void {
  const { deck } = runtime;
  if (!deck.enabled) return;
  const current = deck.currentSlide;

  if (deck.container) {
    deck.container.style.setProperty('--deck-current', String(current));
  }
  if (deck.counterLabel) {
    deck.counterLabel.textContent = String(current + 1).padStart(2, '0');
  }
  for (const dot of deck.dots) {
    const indexAttr = dot.dataset.slideIndex;
    const index = indexAttr != null ? Number(indexAttr) : -1;
    if (index === current) {
      dot.setAttribute('data-active', 'true');
    } else {
      dot.removeAttribute('data-active');
    }
    if (deck.visitedSlides.has(index)) {
      dot.setAttribute('data-visited', 'true');
    }
  }
  if (deck.prevButton) {
    deck.prevButton.disabled = current === 0;
  }
  if (deck.nextButton) {
    deck.nextButton.disabled = current === deck.totalSlides - 1;
  }
}

function markSlideVisible(runtime: MotionRuntime, index: number): void {
  const slide = runtime.deck.slides[index];
  if (!slide) return;
  slide.setAttribute('data-visible', 'true');
  if (runtime.deck.visitedSlides.has(index)) {
    slide.setAttribute('data-visited', 'true');
  }
}

function navigateToSlide(runtime: MotionRuntime, rawIndex: number, options: { fromHistory?: boolean } = {}): void {
  const index = clampSlideIndex(rawIndex);
  if (!runtime.deck.enabled) return;
  if (index === runtime.deck.currentSlide && runtime.deck.visitedSlides.has(index)) return;

  runtime.deck.currentSlide = index;
  runtime.deck.visitedSlides.add(index);
  markSlideVisible(runtime, index);
  updateDeckPagination(runtime);

  if (!options.fromHistory) {
    writeSlideHash(index, true);
  }

  const nextPhase = computePhaseForSlide(index);
  applyPhaseTransition(runtime, nextPhase);
}

function applyPhaseTransition(runtime: MotionRuntime, phase: Phase): void {
  if (runtime.reachedHorizon && phase !== 'horizon') {
    // Post-horizon: particles have served their narrative purpose. Fade
    // out on any backward navigation instead of replaying.
    runtime.phase = phase;
    for (const particle of runtime.particles) {
      particle.targetOpacity = 0;
    }
    if (runtime.rafId == null) tick(runtime);
    return;
  }

  if (phase === 'race' && runtime.phase !== 'race') {
    runtime.phase = 'race';
    runAct2Race(runtime);
  } else if (phase === 'funnel' && runtime.phase !== 'funnel') {
    runtime.phase = 'funnel';
    for (const particle of runtime.particles) {
      if (particle.state !== 'falling') particle.state = 'flowing';
    }
    runAct3Counter(runtime);
  } else if (phase === 'horizon' && runtime.phase !== 'horizon') {
    runtime.phase = 'horizon';
    runtime.reachedHorizon = true;
    runtime.horizonEntryAt = performance.now();
    for (const particle of runtime.particles) {
      if (particle.state === 'falling') continue;
      particle.state = 'horizon';
      particle.homeOffsetX = (Math.random() - 0.5) * runtime.width * 0.9;
      particle.homeOffsetY = (Math.random() - 0.5) * 14;
    }
    if (runtime.rafId == null) tick(runtime);
  } else if (phase === 'cluster-hold' || phase === 'reveal') {
    runtime.phase = phase;
    if (phase === 'reveal') runtime.horizonEntryAt = null;

    const targetSlide = phase === 'reveal' ? 0 : 1;
    window.requestAnimationFrame(() => refreshClusterAnchors(runtime, targetSlide));
    window.setTimeout(() => refreshClusterAnchors(runtime, targetSlide), 820);
    if (runtime.rafId == null) tick(runtime);
  }
}

function initDeck(runtime: MotionRuntime): void {
  const container = runtime.root.querySelector<HTMLElement>('[data-role="deck"]');
  if (!container) return;

  const slides = Array.from(runtime.root.querySelectorAll<HTMLElement>('.sr-slide[data-slide-index]')).sort(
    (a, b) => Number(a.dataset.slideIndex) - Number(b.dataset.slideIndex)
  );
  if (slides.length === 0) return;

  const deck = runtime.deck;
  deck.enabled = true;
  deck.container = container;
  deck.slides = slides;
  deck.totalSlides = slides.length;
  deck.counterLabel = runtime.root.querySelector<HTMLElement>('[data-role="deck-current-label"]');
  deck.dots = Array.from(runtime.root.querySelectorAll<HTMLElement>('[data-role="deck-dot"]'));
  deck.prevButton = runtime.root.querySelector<HTMLButtonElement>('[data-role="deck-prev"]');
  deck.nextButton = runtime.root.querySelector<HTMLButtonElement>('[data-role="deck-next"]');
  deck.hint = runtime.root.querySelector<HTMLElement>('[data-role="deck-hint"]');

  const startIndex = parseSlideFromHash() ?? 0;
  deck.currentSlide = startIndex;
  // Mark all slides up to and including the start as visited so returning
  // to earlier slides via back-nav doesn't replay their stagger.
  for (let i = 0; i <= startIndex; i += 1) deck.visitedSlides.add(i);
  // Reveal every visited slide immediately — CSS collapses the stagger for
  // visited slides, so their atoms appear without the fade sequence.
  // Exception: when holdLandingReveal is active, skip slide 0 here and let
  // runLandingOrchestration flip it at the correct entrance beat.
  for (const visited of deck.visitedSlides) {
    if (runtime.holdLandingReveal && visited === 0) continue;
    markSlideVisible(runtime, visited);
  }

  updateDeckPagination(runtime);
  runtime.phase = computePhaseForSlide(startIndex);

  // Keyboard navigation
  const onKeydown = (event: KeyboardEvent): void => {
    if (!deck.enabled) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    switch (event.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        event.preventDefault();
        navigateToSlide(runtime, deck.currentSlide + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        event.preventDefault();
        navigateToSlide(runtime, deck.currentSlide - 1);
        break;
      case 'Home':
        event.preventDefault();
        navigateToSlide(runtime, 0);
        break;
      case 'End':
        event.preventDefault();
        navigateToSlide(runtime, deck.totalSlides - 1);
        break;
    }
  };
  window.addEventListener('keydown', onKeydown);
  deck.keydownHandler = onKeydown;

  // Pagination dot click
  for (const dot of deck.dots) {
    dot.addEventListener('click', () => {
      const index = Number(dot.dataset.slideIndex);
      if (Number.isFinite(index)) navigateToSlide(runtime, index);
    });
  }

  // Edge prev/next arrow clicks
  deck.prevButton?.addEventListener('click', () => navigateToSlide(runtime, deck.currentSlide - 1));
  deck.nextButton?.addEventListener('click', () => navigateToSlide(runtime, deck.currentSlide + 1));

  // Hash popstate support for browser back/forward
  const onPopState = (): void => {
    const hashIndex = parseSlideFromHash();
    if (hashIndex != null) navigateToSlide(runtime, hashIndex, { fromHistory: true });
  };
  window.addEventListener('popstate', onPopState);
  deck.popstateHandler = onPopState;

  // First-load keyboard hint — one-shot, remembered across reloads in the tab
  if (deck.hint && typeof window.sessionStorage !== 'undefined') {
    try {
      const shown = window.sessionStorage.getItem(DECK_HINT_STORAGE_KEY);
      if (!shown) {
        deck.hint.setAttribute('data-visible', 'true');
        window.setTimeout(() => {
          deck.hint?.removeAttribute('data-visible');
        }, DECK_HINT_TIMEOUT_MS);
        window.sessionStorage.setItem(DECK_HINT_STORAGE_KEY, '1');
      }
    } catch {
      // Ignore storage failures (private mode, quotas, etc.).
    }
  }
}

function revealStatically(root: HTMLElement): void {
  root.setAttribute('data-motion', 'reduced');
  const landing = root.querySelector<HTMLElement>('[data-role="landing"]');
  landing?.setAttribute('data-visible', 'true');
  for (const section of root.querySelectorAll<HTMLElement>('[data-role="act"]')) {
    section.setAttribute('data-visible', 'true');
  }
  const urban = root.querySelector<HTMLElement>('[data-role="urban-progress"]');
  const comparison = root.querySelector<HTMLElement>('[data-role="comparison-progress"]');
  for (const el of [urban, comparison]) {
    if (!el) continue;
    el.style.transform = 'scaleY(1)';
  }
  const fill = root.querySelector<HTMLElement>('[data-role="scroll-progress"]');
  if (fill) fill.style.width = '100%';
}

// Landing entrance orchestration ----------------------------------------
// The landing slide's data-visible attribute is gated: when staged entrance
// is enabled, particles enter first and we hold the landing content hidden
// for ORCHESTRATION_HOLD_MS before flipping data-visible. When the fact-line
// number becomes visible, we tween it from 0 to its final value. When the
// final reveal settles we mark the root with data-orchestration="complete"
// so tests and downstream code can depend on a single state bit.

const ORCHESTRATION_HOLD_MS = 1400;
const COUNT_UP_DURATION_MS = 520;
// Count-up fires during Stage A, just after the prelude fades in, so the
// number tweens while particles are still drifting and the landing cards
// are still held. Kept short so the count finishes before the reveal beat.
const COUNT_UP_START_DELAY_MS = 380;

// Cluster jump-and-dissolve choreography — the emotional beat that links
// drifting particles to the tier rows they represent. Times are measured
// from the moment the particle state flips entering→clustering.
//
//   0              → 220ms   GATHER   (pause, dampen velocity, "listen")
//   220            → 770ms   JUMP     (decisive acceleration toward home)
//   770            → 1170ms  DISSOLVE (settle, outer ring fades to halo)
//   1170+          → HOMED   (gentle living motion)
//
// The cluster flip fires 1400ms after the landing reveal cascade begins
// (= 2800ms from page load), once the network-spread rail has finished
// revealing and laid out for accurate anchor resolution. Total landing
// orchestration is ~4070ms — within Emil's "rare / first-time = considered
// motion is correct" bucket.
const CLUSTER_BEAT_DELAY_AFTER_REVEAL_MS = 1400;
const CLUSTER_GATHER_MS = 220;
const CLUSTER_JUMP_MS = 550;
const CLUSTER_JUMP_RAMP_MS = 120;
const CLUSTER_DISSOLVE_MS = 400;
const CLUSTER_HOMED_SETTLE_PAD_MS = 120;
// Spring constants — dimensionless per-frame pull toward home. Gather is
// near-zero (particles quiesce), jump peaks for decisive motion, dissolve
// decays back to the homed breathing spring.
const CLUSTER_GATHER_SPRING = 0.012;
const CLUSTER_JUMP_SPRING = 0.17;
const CLUSTER_HOMED_SPRING = 0.055;
// Opacity the outer ring of particles settles to during dissolve. Creates
// the dense-core + soft-halo silhouette that reads as sessions melting
// into the tier-dot rather than piling on top of it.
const CLUSTER_OUTER_OPACITY_RATIO = 0.65;

interface OrchestrationCompletion {
  settleCountUps?: boolean;
}

function completeOrchestration(root: HTMLElement, options: OrchestrationCompletion = {}): void {
  if (options.settleCountUps) {
    for (const el of root.querySelectorAll<HTMLElement>('[data-count-up]')) {
      const targetAttr = el.dataset.countUpTarget;
      if (!targetAttr) continue;
      const target = Number(targetAttr);
      if (!Number.isFinite(target)) continue;
      el.textContent = target.toLocaleString();
    }
  }
  root.setAttribute('data-orchestration', 'complete');
}

function tweenCountUp(el: HTMLElement, target: number): void {
  if (!Number.isFinite(target) || target <= 0) {
    el.textContent = target.toLocaleString();
    return;
  }
  const startedAt = performance.now();
  // Cubic ease-out — chosen to parity-match --sr-ease-out: cubic-bezier(0.22, 1, 0.36, 1).
  // The curve shape is similar enough that the count-up settling feels aligned
  // with the surrounding opacity/transform reveal transitions.
  const ease = (t: number): number => 1 - (1 - t) ** 3;
  const step = (now: number): void => {
    const progress = Math.min(1, (now - startedAt) / COUNT_UP_DURATION_MS);
    const value = Math.round(target * ease(progress));
    el.textContent = value.toLocaleString();
    if (progress < 1) window.requestAnimationFrame(step);
    else el.textContent = target.toLocaleString();
  };
  window.requestAnimationFrame(step);
}

function scheduleCountUps(root: HTMLElement, delayMs: number): void {
  const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-count-up]'));
  for (const el of elements) {
    const targetAttr = el.dataset.countUpTarget;
    if (!targetAttr) continue;
    const target = Number(targetAttr);
    if (!Number.isFinite(target)) continue;
    el.textContent = '0';
    window.setTimeout(() => tweenCountUp(el, target), delayMs);
  }
}

// Report hover tooltips --------------------------------------------------
// Singleton floating tooltip that populates from any [data-tooltip] element
// across the report (landing actionable signals, network/device tier rows,
// Act 3 stage cards, and any future empathetic-interpretation surfaces) on
// hover or keyboard focus. Desktop-only via @media (hover: hover) in CSS;
// the handler still wires focus-visible so keyboard users get access.
// Positioning is below the element by default, flipping above when too
// close to the viewport bottom. Pointer-events:none on the panel so
// moving between rows doesn't trap hover.

const TOOLTIP_GAP_PX = 10;
const TOOLTIP_EDGE_PADDING_PX = 12;

function attachLandingTooltips(root: HTMLElement): void {
  const tooltip = root.querySelector<HTMLElement>('[data-role="landing-tooltip"]');
  if (!tooltip) return;

  // Only register when the environment supports hover — otherwise tooltips
  // would be stuck open on touch devices after a tap.
  const hoverMedia = typeof window.matchMedia === 'function' ? window.matchMedia('(hover: hover)') : null;
  if (hoverMedia && !hoverMedia.matches) return;

  const hosts = Array.from(root.querySelectorAll<HTMLElement>('[data-tooltip]'));
  if (hosts.length === 0) return;

  let activeHost: HTMLElement | null = null;

  const hide = (): void => {
    activeHost = null;
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.removeAttribute('data-visible');
  };

  const show = (host: HTMLElement): void => {
    const copy = host.dataset.tooltip ?? '';
    if (!copy) return;
    activeHost = host;
    tooltip.textContent = copy;
    tooltip.setAttribute('aria-hidden', 'false');
    // Force a synchronous layout read so width is known before we position.
    tooltip.setAttribute('data-visible', 'true');
    position(host);
  };

  const position = (host: HTMLElement): void => {
    const hostRect = host.getBoundingClientRect();
    const panelRect = tooltip.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    // Default: below the host, horizontally centered on its midpoint.
    let top = hostRect.bottom + TOOLTIP_GAP_PX;
    let left = hostRect.left + hostRect.width / 2 - panelRect.width / 2;

    // Flip above if we'd clip the viewport bottom.
    if (top + panelRect.height + TOOLTIP_EDGE_PADDING_PX > viewportH) {
      top = hostRect.top - panelRect.height - TOOLTIP_GAP_PX;
    }

    // Clamp horizontally so we never clip left/right edges.
    left = Math.max(TOOLTIP_EDGE_PADDING_PX, left);
    left = Math.min(viewportW - panelRect.width - TOOLTIP_EDGE_PADDING_PX, left);

    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.style.left = `${Math.round(left)}px`;
  };

  for (const host of hosts) {
    // Give each host a stable aria-describedby → the shared tooltip id. This
    // works because only one host is "active" at a time; screen readers read
    // the description whenever the user navigates onto the host.
    if (!host.getAttribute('aria-describedby')) {
      host.setAttribute('aria-describedby', 'sr-landing-tooltip');
    }
    host.addEventListener('mouseenter', () => show(host));
    host.addEventListener('mouseleave', () => {
      if (activeHost === host) hide();
    });
    host.addEventListener('focus', () => show(host));
    host.addEventListener('blur', () => {
      if (activeHost === host) hide();
    });
  }

  // Re-position on scroll or resize in case the active host has moved.
  const refresh = (): void => {
    if (activeHost) position(activeHost);
  };
  window.addEventListener('scroll', refresh, { passive: true });
  window.addEventListener('resize', refresh, { passive: true });

  // Hide on Escape for keyboard users.
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeHost) {
      activeHost.blur();
      hide();
    }
  });
}

function runLandingOrchestration(runtime: MotionRuntime): void {
  // Stage A: particles drift in, domain + fact-line prelude renders with the
  // data-orchestration="pending" state translating it into viewport centre.
  // initDeck's visitedSlides loop skipped slide 0 while holdLandingReveal
  // is true, so the landing slide's data-reveal children (mood pill, lede,
  // KPI grid, tables) remain hidden.
  const landing = runtime.root.querySelector<HTMLElement>('[data-role="landing"]');
  if (!landing) {
    completeOrchestration(runtime.root, { settleCountUps: true });
    return;
  }

  // Fire the count-up early in Stage A so the number tweens while the
  // prelude is still centred and particles are drifting.
  scheduleCountUps(runtime.root, COUNT_UP_START_DELAY_MS);

  // Stage B→C: release the prelude translate and reveal the landing slide.
  // Both happen on the same beat — the prelude eases up to its natural
  // position while the surrounding cards fade in beneath it.
  window.setTimeout(() => {
    runtime.root.setAttribute('data-orchestration', 'revealing');
    markSlideVisible(runtime, 0);

    // Stage D (the emotional beat): once the network-spread rail has
    // finished revealing and the tier rows are laid out, trigger the
    // gather → jump → dissolve cluster transition. Anchors are refreshed
    // here so getBoundingClientRect reads the final post-reveal rect
    // positions rather than the pre-reveal translated ones.
    window.setTimeout(() => {
      refreshClusterAnchors(runtime, 0);
      const stampedAt = performance.now();
      for (const particle of runtime.particles) {
        if (particle.state === 'entering') {
          particle.state = 'clustering';
          particle.clusterStartedAt = stampedAt;
        }
      }

      // Mark orchestration complete once the cluster settles. Fires AFTER
      // the dissolve phase resolves so downstream waiters (e2e, keyboard
      // handoff) don't observe a still-moving canvas.
      const clusterTotal = CLUSTER_GATHER_MS + CLUSTER_JUMP_MS + CLUSTER_DISSOLVE_MS + CLUSTER_HOMED_SETTLE_PAD_MS;
      window.setTimeout(() => completeOrchestration(runtime.root), clusterTotal);
    }, CLUSTER_BEAT_DELAY_AFTER_REVEAL_MS);
  }, ORCHESTRATION_HOLD_MS);
}

export interface ReportMotionFlags {
  // When true, skip the landing entrance orchestration and reveal everything
  // in its final state immediately. Set by qa=deterministic, qa=1, scene=*,
  // or any condition where staged entrance would break a snapshot/test lane.
  skipOrchestration?: boolean;
}

export function initReportMotion(motionMode: ReportMotionMode, flags: ReportMotionFlags = {}): void {
  const root = document.querySelector<HTMLElement>('.sr-root');
  if (!root) return;

  const prefersReduced =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (motionMode === 'reduced' || prefersReduced) {
    revealStatically(root);
    completeOrchestration(root, { settleCountUps: true });
    return;
  }

  const payload = readMotionPayload(root);
  if (!payload) {
    revealStatically(root);
    completeOrchestration(root, { settleCountUps: true });
    return;
  }

  const canvas = root.querySelector<HTMLCanvasElement>('[data-role="canvas"]');
  const ctx = canvas?.getContext('2d') ?? null;
  if (!canvas || !ctx) {
    revealStatically(root);
    completeOrchestration(root, { settleCountUps: true });
    return;
  }

  const runtime: MotionRuntime = {
    root,
    canvas,
    ctx,
    width: 0,
    height: 0,
    dpr: 1,
    particles: [],
    phase: 'reveal',
    rafId: null,
    scrollRafPending: false,

    payload,
    moodMultiplier: moodMultiplierFor(payload.mood),
    actsObserved: new Set(),
    horizonEntryAt: null,
    reachedHorizon: false,
    scrollableHeight: 0,
    resizeTimer: null,
    holdLandingReveal: !flags.skipOrchestration,
    deck: {
      enabled: false,
      currentSlide: 0,
      totalSlides: DECK_TOTAL_SLIDES,
      visitedSlides: new Set(),
      container: null,
      slides: [],
      counterLabel: null,
      dots: [],
      prevButton: null,
      nextButton: null,
      hint: null,
      keydownHandler: null,
      popstateHandler: null
    }
  };

  sizeCanvas(runtime);
  createParticles(runtime);

  // Desktop deck mode (≥1024px) uses keyboard/click navigation and the
  // horizontal slide translateX layout. Below that breakpoint we fall back
  // to the original scroll-driven experience with IntersectionObserver.
  const deckMedia = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1024px)') : null;
  const isDeckViewport = deckMedia ? deckMedia.matches : window.innerWidth >= 1024;

  attachScrollProgress(runtime);

  if (isDeckViewport) {
    initDeck(runtime);
  } else {
    observeActs(runtime);
    // Landing is always visible on scroll mode — it's the executive summary
    // layer, not part of the narrative act sequence. Mark it visible so its
    // staggered [data-reveal] atoms unfold immediately.
    const landing = root.querySelector<HTMLElement>('[data-role="landing"]');
    landing?.setAttribute('data-visible', 'true');
    runtime.phase = 'reveal';
  }

  // Landing entrance orchestration — runs only on deck viewport + full motion.
  // Flags.skipOrchestration covers qa=deterministic, qa=1, scene=*, and any
  // mode where staged reveal would race a snapshot or test assertion.
  const orchestrationWillRun = isDeckViewport && !flags.skipOrchestration;
  if (orchestrationWillRun) {
    runLandingOrchestration(runtime);
  } else {
    completeOrchestration(root, { settleCountUps: true });
    // Mobile / qa / skip paths: fire the legacy cluster flip at the
    // original 1400ms beat and refresh anchors once the reveal cascade
    // has settled. These paths do NOT get the gather/jump/dissolve beat
    // (clusterStartedAt stays null → the phased-spring branch falls
    // through to the legacy steady-state spring).
    window.setTimeout(() => {
      for (const particle of runtime.particles) {
        if (particle.state === 'entering') particle.state = 'clustering';
      }
    }, 1400);
    // The act wrapper uses transform: translateY(24px) in its hidden
    // state, and individual data-reveal atoms also start translated.
    // When anchors are first resolved, getBoundingClientRect returns
    // pre-reveal positions, so particle clusters land a few dozen pixels
    // off their final row centres. Re-resolve once the reveal stagger
    // has settled.
    window.setTimeout(() => refreshClusterAnchors(runtime, 0), 1600);
  }

  // Attach landing hover tooltips — desktop-only via (hover: hover), no-op
  // elsewhere. Runs regardless of orchestration state so tooltips work in
  // both live and QA modes once content is visible.
  attachLandingTooltips(root);

  tick(runtime);

  // Debounced resize — 200ms settle window so rapid window drags do not
  // thrash particle recreation. Also invalidates the cached scrollable
  // height, and restarts the RAF loop if it had previously bailed out.
  window.addEventListener(
    'resize',
    () => {
      if (runtime.resizeTimer != null) window.clearTimeout(runtime.resizeTimer);
      runtime.resizeTimer = window.setTimeout(() => {
        runtime.resizeTimer = null;
        sizeCanvas(runtime);
        createParticles(runtime);
        runtime.scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (runtime.rafId == null) {
          runtime.horizonEntryAt = runtime.phase === 'horizon' ? performance.now() : null;
          tick(runtime);
        }
      }, 200);
    },
    { passive: true }
  );
}
