// Vanilla TS render helpers + DOM hydrators for the scroll-narrative report.
// String builders emit semantic HTML with data-* hooks; boot fns attach
// IntersectionObservers / RAF tweens / popovers after innerHTML injection.
//
// Replaces the runtime React <Reveal> / <HeroValue> / <Term> components from
// the design reference. No framework runtime; ~300 lines total.

import { GLOSSARY, type GlossaryKey } from './glossary.js';
import { escapeHtml } from './render-utils.js';

// ─── Reveal (fade + lift on scroll-in) ──────────────────────────────────

export interface RevealOpts {
  delay?: number;
  as?: 'card' | 'item';
}

export function renderReveal(content: string, opts: RevealOpts = {}): string {
  const styleAttr = opts.delay && opts.delay > 0 ? ` style="--reveal-delay:${opts.delay}ms"` : '';
  const variantAttr = opts.as === 'card' ? ' data-reveal="card"' : ' data-reveal';
  return `<div${variantAttr}${styleAttr}>${content}</div>`;
}

export function bootRevealObserver(root: ParentNode = document): void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (!els.length) return;

  if (typeof IntersectionObserver === 'undefined') {
    for (const el of els) el.dataset.in = 'true';
    return;
  }

  const obs = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.in = 'true';
          obs.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.18, rootMargin: '-8% 0px 0px 0px' }
  );

  for (const el of els) obs.observe(el);
}

// ─── HeroValue (animated numeric + italic-serif unit) ──────────────────

export interface HeroValueOpts {
  countTo?: boolean;
  delayMs?: number;
  durationMs?: number;
}

const NUMERIC_SPLIT = /^([+-]?\d+(?:[.,]\d+)?)(.*)$/;

export function renderHeroValue(value: string, opts: HeroValueOpts = {}): string {
  const match = NUMERIC_SPLIT.exec(value.trim());
  if (!match) return escapeHtml(value);

  const numeric = (match[1] ?? '').trim();
  const unit = (match[2] ?? '').trim();

  const dataAttrs = opts.countTo
    ? ` data-count-to="${escapeHtml(numeric)}" data-count-delay="${opts.delayMs ?? 0}" data-count-duration="${opts.durationMs ?? 720}"`
    : '';
  const initialNumeric = opts.countTo ? '0' : escapeHtml(numeric);

  if (!unit) {
    return `<span class="hero-value-num"${dataAttrs}>${initialNumeric}</span>`;
  }
  return `<span class="hero-value-num"${dataAttrs}>${initialNumeric}</span><span class="hero-value-unit">${escapeHtml(unit)}</span>`;
}

export function bootCounterTweens(root: ParentNode = document): void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-count-to]'));
  if (!els.length) return;

  if (typeof IntersectionObserver === 'undefined') {
    for (const el of els) {
      el.textContent = el.dataset.countTo ?? '';
      delete el.dataset.countTo;
    }
    return;
  }

  const obs = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const target = el.dataset.countTo;
        if (!target) continue;
        const delay = Number(el.dataset.countDelay ?? '0');
        const duration = Number(el.dataset.countDuration ?? '720');
        tweenCounter(el, target, delay, duration);
        delete el.dataset.countTo;
        obs.unobserve(el);
      }
    },
    { threshold: 0.4 }
  );

  for (const el of els) obs.observe(el);
}

function tweenCounter(el: HTMLElement, target: string, delay: number, duration: number): void {
  const numericTarget = Number.parseFloat(target.replace(',', '.'));
  if (!Number.isFinite(numericTarget)) {
    el.textContent = target;
    return;
  }

  const isInteger = !target.includes('.') && !target.includes(',');
  const start = performance.now() + delay;
  const ease = (t: number): number => 1 - (1 - t) ** 3;

  const step = (now: number): void => {
    const elapsed = now - start;
    if (elapsed < 0) {
      requestAnimationFrame(step);
      return;
    }
    const progress = Math.min(1, elapsed / duration);
    const eased = ease(progress);
    const current = numericTarget * eased;
    el.textContent = isInteger ? String(Math.round(current)) : current.toFixed(target.split(/[.,]/)[1]?.length ?? 1);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };

  requestAnimationFrame(step);
}

// ─── Term / glossary popover ───────────────────────────────────────────

export function renderTerm(key: GlossaryKey, label?: string): string {
  const def = GLOSSARY[key];
  const display = label ?? def.name;
  return `<span class="gloss" data-term="${key}" tabindex="0">${escapeHtml(display)}</span>`;
}

export function bootGlossaryPopovers(root: ParentNode = document): void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-term]'));
  if (!els.length) return;

  let openEl: HTMLElement | null = null;
  let openPop: HTMLElement | null = null;

  const close = (): void => {
    if (openPop) {
      openPop.remove();
      openPop = null;
    }
    openEl = null;
  };

  const open = (el: HTMLElement): void => {
    if (openEl === el) return;
    close();
    const key = el.dataset.term as GlossaryKey | undefined;
    if (!key) return;
    const def = GLOSSARY[key];
    if (!def) return;

    const pop = document.createElement('span');
    pop.className = 'gloss-pop';
    pop.setAttribute('role', 'tooltip');
    pop.innerHTML = `
      <span class="gloss-term">
        <span class="gloss-term-name">${escapeHtml(def.name)}</span>
        <span class="gloss-term-tag">${escapeHtml(def.long)}</span>
      </span>
      <div>${escapeHtml(def.plain)}</div>
      <div class="gloss-cmo">${escapeHtml(def.cmo)}</div>
    `;
    el.append(pop);
    openEl = el;
    openPop = pop;
  };

  for (const el of els) {
    el.addEventListener('mouseenter', () => open(el));
    el.addEventListener('mouseleave', () => close());
    el.addEventListener('focus', () => open(el));
    el.addEventListener('blur', () => close());
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (openEl === el) close();
      else open(el);
    });
  }

  document.addEventListener('mousedown', (e) => {
    if (!openEl) return;
    if (!openEl.contains(e.target as Node)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

// ─── Scroll-spy nav active state ───────────────────────────────────────

export function bootScrollSpy(sectionIds: string[]): void {
  const els = sectionIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
  if (!els.length) return;

  const links = new Map<string, HTMLElement>();
  for (const link of document.querySelectorAll<HTMLElement>('[data-spy-link]')) {
    const targetId = link.dataset.spyLink;
    if (targetId) links.set(targetId, link);
  }
  if (!links.size) return;

  let activeId: string | null = null;
  const setActive = (id: string): void => {
    if (id === activeId) return;
    activeId = id;
    for (const [linkId, link] of links) {
      link.dataset.active = linkId === id ? 'true' : 'false';
    }
  };

  const probe = (): void => {
    const vh = window.innerHeight || 540;
    const focusY = vh * 0.35;
    let bestId: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh) continue;
      const dist = Math.abs(r.top - focusY);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = el.id;
      }
    }
    if (bestId) setActive(bestId);
  };

  if (typeof IntersectionObserver !== 'undefined') {
    const obs = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const e of entries) {
          if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) {
            best = e;
          }
        }
        if (best) setActive(best.target.id);
      },
      { threshold: [0.2, 0.4, 0.6], rootMargin: '-20% 0px -50% 0px' }
    );
    for (const el of els) obs.observe(el);
  }

  window.addEventListener('scroll', probe, { passive: true });
  window.addEventListener('resize', probe);
  probe();
}

// ─── Reading-progress hairline ─────────────────────────────────────────

export function bootReadingProgress(): void {
  const fill = document.querySelector<HTMLElement>('.scroll-progress-fill');
  if (!fill) return;

  let raf: number | null = null;
  const onScroll = (): void => {
    if (raf !== null) return;
    raf = requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      fill.style.transform = `scaleX(${p})`;
      raf = null;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ─── Smooth-scroll TOC anchors ─────────────────────────────────────────

export function bootSmoothAnchors(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-spy-link]')) {
    link.addEventListener('click', (e) => {
      const id = link.dataset.spyLink;
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

// ─── One-shot boot for the whole report ────────────────────────────────

export function bootReport(sectionIds: string[]): void {
  bootRevealObserver();
  bootCounterTweens();
  bootGlossaryPopovers();
  bootScrollSpy(sectionIds);
  bootReadingProgress();
  bootSmoothAnchors();
}
