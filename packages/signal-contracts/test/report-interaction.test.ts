import { describe, expect, it } from 'vitest';

import {
  explainReportInteractionIssues,
  isSignalReportInteractionV1,
  SIGNAL_REPORT_INTERACTION_INGEST_PATH,
  SIGNAL_REPORT_INTERACTION_VERSION,
  type SignalReportInteractionV1
} from '../src/index.js';

function makeValidInteraction(): SignalReportInteractionV1 {
  return {
    v: SIGNAL_REPORT_INTERACTION_VERSION,
    event_kind: 'report_opened',
    event_id: 'evt_abc123',
    ts: Date.UTC(2026, 3, 20, 12, 0, 0),
    st: 'a7k3m2p8',
    route: 'r',
    rv: 1,
    ua_browser: 'chrome',
    ua_tier: 'desktop'
  };
}

describe('explainReportInteractionIssues', () => {
  describe('happy path', () => {
    it('accepts a well-formed report_opened event', () => {
      expect(explainReportInteractionIssues(makeValidInteraction())).toEqual([]);
      expect(isSignalReportInteractionV1(makeValidInteraction())).toBe(true);
    });

    it('accepts a report_slide_advanced event with section_id', () => {
      const ev: SignalReportInteractionV1 = {
        ...makeValidInteraction(),
        event_kind: 'report_slide_advanced',
        section_id: 'act-3'
      };
      expect(explainReportInteractionIssues(ev)).toEqual([]);
    });

    it('accepts a report_slide_advanced event with section_id + dwell_ms', () => {
      const ev: SignalReportInteractionV1 = {
        ...makeValidInteraction(),
        event_kind: 'report_slide_advanced',
        section_id: 'act-2',
        dwell_ms: 12_400
      };
      expect(explainReportInteractionIssues(ev)).toEqual([]);
    });
  });

  describe('per-kind required fields', () => {
    it('rejects report_opened missing rv', () => {
      const ev = { ...makeValidInteraction() } as Record<string, unknown>;
      delete ev.rv;
      const issues = explainReportInteractionIssues(ev);
      expect(issues).toContain('Expected "rv" to be present for event_kind "report_opened".');
    });

    it('rejects report_slide_advanced missing section_id', () => {
      const ev = { ...makeValidInteraction(), event_kind: 'report_slide_advanced' as const };
      const issues = explainReportInteractionIssues(ev);
      expect(issues).toContain('Expected "section_id" to be present for event_kind "report_slide_advanced".');
    });

    it('rejects report_slide_advanced missing rv', () => {
      const ev = {
        v: SIGNAL_REPORT_INTERACTION_VERSION,
        event_kind: 'report_slide_advanced' as const,
        event_id: 'evt_r2',
        ts: Date.UTC(2026, 3, 20, 12, 0, 0),
        st: 'token123',
        route: 'r' as const,
        section_id: 'act-3'
      };
      const issues = explainReportInteractionIssues(ev);
      expect(issues).toContain('Expected "rv" to be present for event_kind "report_slide_advanced".');
    });
  });

  describe('validation', () => {
    it('rejects non-object input', () => {
      expect(explainReportInteractionIssues(null)).toEqual([
        'Expected a JSON object matching SignalReportInteractionV1.'
      ]);
    });

    it('rejects wrong schema version', () => {
      const ev = { ...makeValidInteraction(), v: 2 as unknown as 1 };
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('"v"'))).toBe(true);
    });

    it('rejects unknown event_kind', () => {
      const ev = { ...makeValidInteraction(), event_kind: 'unknown_kind' as SignalReportInteractionV1['event_kind'] };
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('event_kind'))).toBe(true);
    });

    it('rejects empty event_id', () => {
      const ev = { ...makeValidInteraction(), event_id: '' };
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('event_id'))).toBe(true);
    });

    it('rejects missing share token', () => {
      const ev = { ...makeValidInteraction(), st: '' };
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('share token'))).toBe(true);
    });

    it('rejects unknown route', () => {
      const ev = { ...makeValidInteraction(), route: 'xyz' as SignalReportInteractionV1['route'] };
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('route'))).toBe(true);
    });

    it('rejects rv !== 1 when route === "r"', () => {
      const ev = { ...makeValidInteraction(), rv: 99 };
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('rv'))).toBe(true);
    });

    it('rejects unknown ua_tier', () => {
      const ev = {
        ...makeValidInteraction(),
        ua_tier: 'smartwatch' as unknown as SignalReportInteractionV1['ua_tier']
      };
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('ua_tier'))).toBe(true);
    });

    it('rejects negative dwell_ms', () => {
      const ev = { ...makeValidInteraction(), dwell_ms: -5 };
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('dwell_ms'))).toBe(true);
    });
  });

  describe('constants', () => {
    it('exposes the dedicated ingest path', () => {
      expect(SIGNAL_REPORT_INTERACTION_INGEST_PATH).toBe('/ingest/report-interaction');
    });
  });
});
