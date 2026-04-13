import { describe, expect, it } from 'vitest';

import { escapeHtml } from './render-utils';

describe('escapeHtml', () => {
  it('escapes all five HTML-sensitive characters', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('neutralizes a script injection vector', () => {
    const xss = '<script>alert("xss")</script>';
    const escaped = escapeHtml(xss);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('neutralizes an img onerror injection vector', () => {
    const xss = '<img src=x onerror="alert(\'pwned\')">';
    const escaped = escapeHtml(xss);
    // The tag opener is escaped — browser will not parse as HTML element
    expect(escaped).not.toContain('<img');
    expect(escaped).toContain('&lt;img');
    expect(escaped).toContain('&quot;');
  });

  it('passes clean strings through unchanged', () => {
    expect(escapeHtml('example.co.za')).toBe('example.co.za');
    expect(escapeHtml('urban')).toBe('urban');
    expect(escapeHtml('100% classified')).toBe('100% classified');
  });

  it('handles empty and null values safely', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces non-string values to strings', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(true)).toBe('true');
  });

  it('escapes multiple occurrences in the same string', () => {
    const input = '<a href="test">link & more</a>';
    const escaped = escapeHtml(input);
    expect(escaped).toBe('&lt;a href=&quot;test&quot;&gt;link &amp; more&lt;/a&gt;');
  });
});
