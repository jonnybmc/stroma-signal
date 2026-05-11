import { describe, expect, it } from 'vitest';

import {
  isSignalAdContextCaptureV1,
  SIGNAL_AD_CONTEXT_CAPTURE_VERSION,
  SIGNAL_AD_CONTEXT_LANDING_PATH_MAX_LEN,
  SIGNAL_AD_CONTEXT_VALID_CONSENT_STATES,
  SIGNAL_AD_CONTEXT_VALID_FIELD_PRESENCES,
  SIGNAL_AD_CONTEXT_VALID_ITP_HINTS,
  type SignalAdContextCaptureV1,
  type SignalAdContextFieldPresence
} from '../src/index.js';

function makeBase(): SignalAdContextCaptureV1 {
  return {
    v: SIGNAL_AD_CONTEXT_CAPTURE_VERSION,
    capture_id: '0123abcd-ef45-6789-abcd-ef0123456789',
    ts: Date.UTC(2026, 4, 11, 12, 0, 0),
    landing_path: '/products/widget',
    referrer_origin: 'https://www.google.com',
    click_ids: {},
    utm: {},
    provenance: {
      consent_state: 'unknown',
      itp_hint: 'no_signal',
      gclid_presence: 'absent',
      gbraid_presence: 'absent',
      wbraid_presence: 'absent',
      fbclid_presence: 'absent',
      msclkid_presence: 'absent',
      dclid_presence: 'absent',
      srsltid_presence: 'absent',
      utm_any_presence: 'absent',
      capture_ts: Date.UTC(2026, 4, 11, 12, 0, 0)
    }
  };
}

function makeWithGclid(): SignalAdContextCaptureV1 {
  return {
    ...makeBase(),
    click_ids: { gclid: 'EAIaIQobChMI_test_gclid' },
    provenance: {
      ...makeBase().provenance,
      consent_state: 'granted',
      gclid_presence: 'present'
    }
  };
}

function makeWithMultipleIdsAndUtm(): SignalAdContextCaptureV1 {
  return {
    ...makeBase(),
    click_ids: {
      gclid: 'EAIaIQobChMI_test_gclid',
      fbclid: 'IwAR0_test_fbclid',
      msclkid: 'msclkid_test_value'
    },
    utm: {
      source: 'newsletter',
      medium: 'email',
      campaign: 'spring-2026'
    },
    provenance: {
      ...makeBase().provenance,
      consent_state: 'granted',
      gclid_presence: 'present',
      fbclid_presence: 'present',
      msclkid_presence: 'present',
      utm_any_presence: 'present'
    }
  };
}

function makeSafariStripped(): SignalAdContextCaptureV1 {
  return {
    ...makeBase(),
    referrer_origin: 'https://www.google.com',
    click_ids: {},
    provenance: {
      ...makeBase().provenance,
      consent_state: 'granted',
      itp_hint: 'likely_stripped'
    }
  };
}

describe('SignalAdContextCaptureV1 — type guards', () => {
  describe('valid shapes accepted', () => {
    it('accepts a minimum base with no click IDs', () => {
      expect(isSignalAdContextCaptureV1(makeBase())).toBe(true);
    });

    it('accepts a capture with gclid only', () => {
      expect(isSignalAdContextCaptureV1(makeWithGclid())).toBe(true);
    });

    it('accepts a capture with multiple click IDs and UTM tags', () => {
      expect(isSignalAdContextCaptureV1(makeWithMultipleIdsAndUtm())).toBe(true);
    });

    it('accepts a Safari-stripped capture (no IDs, itp_hint=likely_stripped)', () => {
      expect(isSignalAdContextCaptureV1(makeSafariStripped())).toBe(true);
    });

    it('accepts every valid consent_state in the set', () => {
      for (const state of SIGNAL_AD_CONTEXT_VALID_CONSENT_STATES) {
        const capture = makeBase();
        capture.provenance.consent_state = state;
        expect(isSignalAdContextCaptureV1(capture)).toBe(true);
      }
    });

    it('accepts every valid itp_hint in the set', () => {
      for (const hint of SIGNAL_AD_CONTEXT_VALID_ITP_HINTS) {
        const capture = makeBase();
        capture.provenance.itp_hint = hint;
        expect(isSignalAdContextCaptureV1(capture)).toBe(true);
      }
    });

    it('accepts every valid field-presence value', () => {
      for (const presence of SIGNAL_AD_CONTEXT_VALID_FIELD_PRESENCES) {
        const capture = makeBase();
        capture.provenance.gclid_presence = presence;
        expect(isSignalAdContextCaptureV1(capture)).toBe(true);
      }
    });
  });

  describe('invalid shapes rejected', () => {
    it('rejects null', () => {
      expect(isSignalAdContextCaptureV1(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isSignalAdContextCaptureV1(undefined)).toBe(false);
    });

    it('rejects a primitive', () => {
      expect(isSignalAdContextCaptureV1(42)).toBe(false);
      expect(isSignalAdContextCaptureV1('not-a-capture')).toBe(false);
    });

    it('rejects a wrong version', () => {
      const bad = { ...makeBase(), v: 2 };
      expect(isSignalAdContextCaptureV1(bad)).toBe(false);
    });

    it('rejects an empty capture_id', () => {
      const bad = { ...makeBase(), capture_id: '' };
      expect(isSignalAdContextCaptureV1(bad)).toBe(false);
    });

    it('rejects a non-numeric ts', () => {
      const bad = { ...makeBase(), ts: 'not-a-number' };
      expect(isSignalAdContextCaptureV1(bad)).toBe(false);
    });

    it('rejects a non-finite ts', () => {
      const bad = { ...makeBase(), ts: Number.POSITIVE_INFINITY };
      expect(isSignalAdContextCaptureV1(bad)).toBe(false);
    });

    it('rejects a landing_path over the max length', () => {
      const bad = { ...makeBase(), landing_path: 'a'.repeat(SIGNAL_AD_CONTEXT_LANDING_PATH_MAX_LEN + 1) };
      expect(isSignalAdContextCaptureV1(bad)).toBe(false);
    });

    it('rejects a missing provenance block', () => {
      const bad = { ...makeBase(), provenance: undefined };
      expect(isSignalAdContextCaptureV1(bad)).toBe(false);
    });

    it('rejects an invalid consent_state', () => {
      const bad = makeBase();
      (bad.provenance as { consent_state: string }).consent_state = 'definitely_yes';
      expect(isSignalAdContextCaptureV1(bad)).toBe(false);
    });

    it('rejects an invalid itp_hint', () => {
      const bad = makeBase();
      (bad.provenance as { itp_hint: string }).itp_hint = 'maybe';
      expect(isSignalAdContextCaptureV1(bad)).toBe(false);
    });

    it('rejects an invalid field-presence value', () => {
      const bad = makeBase();
      (bad.provenance as { gclid_presence: SignalAdContextFieldPresence | string }).gclid_presence = 'sort-of';
      expect(isSignalAdContextCaptureV1(bad)).toBe(false);
    });

    it('rejects when click_ids is not an object', () => {
      const bad = { ...makeBase(), click_ids: 'gclid=abc' };
      expect(isSignalAdContextCaptureV1(bad)).toBe(false);
    });

    it('rejects when utm is null', () => {
      const bad = { ...makeBase(), utm: null };
      expect(isSignalAdContextCaptureV1(bad)).toBe(false);
    });
  });

  describe('version is locked to 1', () => {
    it('SIGNAL_AD_CONTEXT_CAPTURE_VERSION is 1', () => {
      expect(SIGNAL_AD_CONTEXT_CAPTURE_VERSION).toBe(1);
    });
  });

  describe('landing_path max-length boundary', () => {
    it('accepts exactly the max length', () => {
      const ok = { ...makeBase(), landing_path: '/' + 'a'.repeat(SIGNAL_AD_CONTEXT_LANDING_PATH_MAX_LEN - 1) };
      expect(ok.landing_path.length).toBe(SIGNAL_AD_CONTEXT_LANDING_PATH_MAX_LEN);
      expect(isSignalAdContextCaptureV1(ok)).toBe(true);
    });
  });
});
