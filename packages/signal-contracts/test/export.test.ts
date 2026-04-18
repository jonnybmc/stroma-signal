import { describe, expect, it } from 'vitest';

import {
  chromeColdNavFixture,
  exportSignalAggregateToJSON,
  exportSignalEventsToCSV,
  exportSignalEventsToJSON,
  safariFallbackFixture,
  strongLcpCoverageAggregateFixture
} from '../src/index.js';

describe('exportSignalEventsToJSON', () => {
  it('round-trips through JSON.parse', () => {
    const events = [chromeColdNavFixture, safariFallbackFixture];
    const json = exportSignalEventsToJSON(events);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].event_id).toBe('evt_chrome_cold_nav');
    expect(parsed[1].event_id).toBe('evt_safari');
  });

  it('returns empty array for no events', () => {
    const json = exportSignalEventsToJSON([]);
    expect(JSON.parse(json)).toEqual([]);
  });
});

describe('exportSignalEventsToCSV', () => {
  it('produces header row matching warehouse schema', () => {
    const csv = exportSignalEventsToCSV([chromeColdNavFixture]);
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    expect(headers).toContain('event_id');
    expect(headers).toContain('host');
    expect(headers).toContain('net_tier');
    expect(headers).toContain('lcp_ms');
    expect(headers).toContain('fcp_ms');
    expect(headers).toContain('browser');
    expect(headers).toContain('presentation_delay_ms');
    expect(headers).toContain('lcp_breakdown_resource_load_delay_ms');
    expect(headers).toContain('lcp_breakdown_resource_load_time_ms');
    expect(headers).toContain('lcp_breakdown_element_render_delay_ms');
    expect(headers).toContain('lcp_attribution_culprit_kind');
    expect(headers).toContain('inp_attribution_dominant_phase');
    expect(headers).toContain('third_party_pre_lcp_script_share_pct');
    expect(headers).toContain('third_party_origin_count');
    expect(headers).not.toContain('nav_type');
  });

  it('produces correct row count', () => {
    const events = [chromeColdNavFixture, safariFallbackFixture];
    const csv = exportSignalEventsToCSV(events);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it('renders null fields as empty cells', () => {
    const csv = exportSignalEventsToCSV([safariFallbackFixture]);
    const lines = csv.split('\n');
    const row = lines[1];
    // Safari fixture has null lcp_ms — should be empty cell
    const headers = lines[0].split(',');
    const lcpIndex = headers.indexOf('lcp_ms');
    const cells = row.split(',');
    expect(cells[lcpIndex]).toBe('');
  });

  it('returns headers only for empty events', () => {
    const csv = exportSignalEventsToCSV([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('event_id');
  });

  it('verifies known cell value', () => {
    const csv = exportSignalEventsToCSV([chromeColdNavFixture]);
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    const hostIndex = headers.indexOf('host');
    const cells = lines[1].split(',');
    expect(cells[hostIndex]).toBe('example.co.za');
  });

  it('quotes values starting with formula characters to prevent CSV injection', () => {
    const malicious = {
      ...chromeColdNavFixture,
      host: '=HYPERLINK("http://evil.com")',
      url: '+cmd|"/C calc"',
      ref: '-1+1'
    };
    const csv = exportSignalEventsToCSV([malicious]);
    const lines = csv.split('\n');
    // Values starting with =, +, - must be quoted
    expect(lines[1]).toContain('"=HYPERLINK(""http://evil.com"")"');
    expect(lines[1]).toContain('"+cmd|""/C calc"""');
    expect(lines[1]).toContain('"-1+1"');
  });
});

describe('exportSignalAggregateToJSON', () => {
  it('round-trips through JSON.parse', () => {
    const json = exportSignalAggregateToJSON(strongLcpCoverageAggregateFixture);
    const parsed = JSON.parse(json);
    expect(parsed.domain).toBe('example.co.za');
    expect(parsed.sample_size).toBeGreaterThan(0);
  });
});
