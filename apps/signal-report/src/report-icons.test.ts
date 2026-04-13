import { describe, expect, it } from 'vitest';

import { renderIcon } from './report-icons';

describe('renderIcon', () => {
  it('renders a known icon as an SVG string with the provided class', () => {
    const svg = renderIcon('zap', 'sr-icon sr-icon-sm');
    expect(svg).toContain('<svg');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('sr-icon sr-icon-sm');
    expect(svg).toContain('lucide');
  });

  it('renders with default class when no class provided', () => {
    const svg = renderIcon('users');
    expect(svg).toContain('sr-icon');
  });

  it('returns empty string for an unknown icon name', () => {
    const svg = renderIcon('nonExistentIcon' as never);
    expect(svg).toBe('');
  });

  it('preserves the original lucide class for devtools identification', () => {
    const svg = renderIcon('arrowRight', 'sr-icon');
    expect(svg).toContain('class="sr-icon lucide');
  });

  it('renders all 10 registered icons without error', () => {
    const icons = [
      'alertCircle',
      'alertTriangle',
      'arrowRight',
      'checkCircle',
      'eye',
      'mousePointerClick',
      'smartphone',
      'trendingUp',
      'users',
      'zap'
    ] as const;

    for (const name of icons) {
      const svg = renderIcon(name, 'sr-icon');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    }
  });
});
