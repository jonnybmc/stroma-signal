import { describe, expect, it } from 'vitest';

import {
  explainReportInteractionIssues,
  isSignalReportInteractionV1,
  SIGNAL_REPORT_INTERACTION_INGEST_PATH,
  SIGNAL_REPORT_INTERACTION_INGEST_URL_DEFAULT,
  SIGNAL_REPORT_INTERACTION_VERSION,
  type SignalReportInteractionIntentKind,
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
    it('exposes the dedicated ingest path (legacy)', () => {
      expect(SIGNAL_REPORT_INTERACTION_INGEST_PATH).toBe('/ingest/report-interaction');
    });

    it('exposes the canonical full ingest URL for cross-origin sendBeacon delivery', () => {
      expect(SIGNAL_REPORT_INTERACTION_INGEST_URL_DEFAULT).toBe('https://api.stroma.design/api/v1/intent');
    });
  });

  describe('intent kinds', () => {
    function makeValidIntent(
      kind: SignalReportInteractionIntentKind,
      overrides: Partial<SignalReportInteractionV1> = {}
    ): SignalReportInteractionV1 {
      return {
        ...makeValidInteraction(),
        event_kind: kind,
        intent_capture_id: '01HBQX5N8C2A6WTYZ3KMG7VPQR',
        intent_stage: 'initial',
        ...overrides
      };
    }

    it('accepts a well-formed intent_pi_early_access initial event', () => {
      expect(explainReportInteractionIssues(makeValidIntent('intent_pi_early_access'))).toEqual([]);
    });

    it('accepts a well-formed intent_rapid_fix initial event', () => {
      expect(explainReportInteractionIssues(makeValidIntent('intent_rapid_fix'))).toEqual([]);
    });

    it('accepts a well-formed intent_monitoring initial event', () => {
      expect(explainReportInteractionIssues(makeValidIntent('intent_monitoring'))).toEqual([]);
    });

    it('accepts an intent_freeform initial event with a pill_id', () => {
      const ev = makeValidIntent('intent_freeform', { intent_pill_id: 'weekly_inbox' });
      expect(explainReportInteractionIssues(ev)).toEqual([]);
    });

    it('accepts an intent_freeform something_else event with freeform_text', () => {
      const ev = makeValidIntent('intent_freeform', {
        intent_pill_id: 'something_else',
        intent_stage: 'followup',
        intent_freeform_text: 'PDF export with our brand on it would be ideal'
      });
      expect(explainReportInteractionIssues(ev)).toEqual([]);
    });

    it('accepts a followup with email + cadence carrying the same capture id', () => {
      const initial = makeValidIntent('intent_monitoring');
      const followup: SignalReportInteractionV1 = {
        ...initial,
        intent_stage: 'followup',
        intent_email: 'cmo@example.co.za',
        intent_cadence: 'weekly'
      };
      expect(explainReportInteractionIssues(followup)).toEqual([]);
    });

    it('rejects an intent_pi_early_access event missing intent_capture_id', () => {
      const { intent_capture_id: _drop, ...rest } = makeValidIntent('intent_pi_early_access');
      const issues = explainReportInteractionIssues(rest);
      expect(issues.some((i) => i.includes('intent_capture_id'))).toBe(true);
    });

    it('rejects an intent_freeform event missing intent_pill_id', () => {
      const { intent_pill_id: _drop, ...rest } = makeValidIntent('intent_freeform');
      const issues = explainReportInteractionIssues(rest);
      expect(issues.some((i) => i.includes('intent_pill_id'))).toBe(true);
    });

    it('rejects an unknown intent_pill_id value', () => {
      const ev = makeValidIntent('intent_freeform', {
        intent_pill_id: 'pdf_export' as unknown as 'weekly_inbox'
      });
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('intent_pill_id'))).toBe(true);
    });

    it('rejects a followup event with no email / cadence / freeform_text payload', () => {
      const ev = makeValidIntent('intent_pi_early_access', { intent_stage: 'followup' });
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('followup'))).toBe(true);
    });

    it('rejects an intent_email longer than 254 chars', () => {
      const ev = makeValidIntent('intent_pi_early_access', {
        intent_stage: 'followup',
        intent_email: `${'a'.repeat(245)}@example.com`
      });
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('intent_email'))).toBe(true);
    });

    it('rejects an intent_email missing the @ symbol', () => {
      const ev = makeValidIntent('intent_pi_early_access', {
        intent_stage: 'followup',
        intent_email: 'not-an-email'
      });
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('intent_email'))).toBe(true);
    });

    it('rejects an intent_freeform_text longer than 200 chars', () => {
      const ev = makeValidIntent('intent_freeform', {
        intent_pill_id: 'something_else',
        intent_stage: 'followup',
        intent_freeform_text: 'x'.repeat(201)
      });
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('intent_freeform_text'))).toBe(true);
    });

    it('rejects an unknown intent_cadence value', () => {
      const ev = makeValidIntent('intent_monitoring', {
        intent_stage: 'followup',
        intent_cadence: 'monthly' as unknown as 'weekly'
      });
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('intent_cadence'))).toBe(true);
    });

    it('rejects an unknown intent_stage value', () => {
      const ev = makeValidIntent('intent_monitoring', {
        intent_stage: 'pending' as unknown as 'initial'
      });
      const issues = explainReportInteractionIssues(ev);
      expect(issues.some((i) => i.includes('intent_stage'))).toBe(true);
    });
  });
});
