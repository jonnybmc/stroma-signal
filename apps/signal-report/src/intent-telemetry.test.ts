// buildEventsFromForm — pure unit tests for the closing modal's
// form-state → intent-events mapping.
//
// These cover every radio path in the modal and confirm the resulting
// events match the wire contract that the snapshot-engine UPSERTs by
// `intent_capture_id`. Wire format is unchanged from the prior
// three-card layout — same event_kinds, same fields, same UPSERT
// semantics. Failure here means a regression in the demand-signal
// pipeline.

import { isSignalReportInteractionV1 } from '@stroma-labs/signal-contracts';
import { describe, expect, it } from 'vitest';

import { buildEventsFromForm, type ClosingModalFormState, type ResolvedReportContext } from './intent-telemetry.js';

const ctx: ResolvedReportContext = { domain: 'example.co.za', share_token: 'st_test', rv: 1 };

function state(over: Partial<ClosingModalFormState> = {}): ClosingModalFormState {
  return {
    choice: null,
    email: undefined,
    cadence: undefined,
    freeformText: undefined,
    pills: [],
    ...over
  };
}

describe('buildEventsFromForm', () => {
  it('no choice picked → empty array (submit blocked)', () => {
    expect(buildEventsFromForm(state(), ctx)).toEqual([]);
  });

  it('pi_early_access without email → 1 event, no intent_email', () => {
    const events = buildEventsFromForm(state({ choice: 'pi_early_access' }), ctx);
    expect(events).toHaveLength(1);
    expect(events[0]?.event_kind).toBe('intent_pi_early_access');
    expect(events[0]?.intent_email).toBeUndefined();
    expect(events[0]?.intent_stage).toBe('initial');
  });

  it('pi_early_access with email → 1 event with intent_email', () => {
    const events = buildEventsFromForm(state({ choice: 'pi_early_access', email: 'jane@example.com' }), ctx);
    expect(events).toHaveLength(1);
    expect(events[0]?.intent_email).toBe('jane@example.com');
  });

  it('rapid_fix → 1 event, no email/cadence regardless of form state', () => {
    const events = buildEventsFromForm(
      state({ choice: 'rapid_fix', email: 'should-be-dropped@example.com', cadence: 'monthly' }),
      ctx
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.event_kind).toBe('intent_rapid_fix');
    expect(events[0]?.intent_email).toBeUndefined();
    expect(events[0]?.intent_cadence).toBeUndefined();
  });

  it('monitoring without email, no cadence picked → 1 event with default weekly cadence', () => {
    const events = buildEventsFromForm(state({ choice: 'monitoring' }), ctx);
    expect(events).toHaveLength(1);
    expect(events[0]?.event_kind).toBe('intent_monitoring');
    expect(events[0]?.intent_cadence).toBe('weekly');
    expect(events[0]?.intent_email).toBeUndefined();
  });

  it('monitoring with email + monthly → 1 event with both', () => {
    const events = buildEventsFromForm(state({ choice: 'monitoring', email: 'ops@acme.com', cadence: 'monthly' }), ctx);
    expect(events).toHaveLength(1);
    expect(events[0]?.intent_email).toBe('ops@acme.com');
    expect(events[0]?.intent_cadence).toBe('monthly');
  });

  it('something_else with 0 pills → empty array (submit blocked)', () => {
    expect(buildEventsFromForm(state({ choice: 'something_else' }), ctx)).toEqual([]);
  });

  it('something_else with 2 non-something_else pills → 2 events, distinct capture_ids, each with pill_id', () => {
    const events = buildEventsFromForm(
      state({ choice: 'something_else', pills: ['multi_page', 'competitor_context'] }),
      ctx
    );
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.event_kind === 'intent_freeform')).toBe(true);
    expect(events[0]?.intent_pill_id).toBe('multi_page');
    expect(events[1]?.intent_pill_id).toBe('competitor_context');
    expect(events[0]?.intent_capture_id).not.toBe(events[1]?.intent_capture_id);
    expect(events.every((e) => e.intent_freeform_text === undefined)).toBe(true);
  });

  it('something_else with the something_else pill + textarea text → that event carries intent_freeform_text', () => {
    const longText = 'a'.repeat(500); // exceeds 200 cap on purpose
    const events = buildEventsFromForm(
      state({
        choice: 'something_else',
        pills: ['multi_page', 'something_else'],
        freeformText: longText
      }),
      ctx
    );
    expect(events).toHaveLength(2);
    const multiPage = events.find((e) => e.intent_pill_id === 'multi_page');
    const somethingElse = events.find((e) => e.intent_pill_id === 'something_else');
    expect(multiPage?.intent_freeform_text).toBeUndefined();
    expect(somethingElse?.intent_freeform_text).toBe('a'.repeat(200));
  });

  // Email-required guard lives in the submit handler (not in the pure
  // function) so it can read the chosen path. These cases lock the
  // pure function's behaviour: it does NOT enforce email — it just
  // attaches `intent_email` when present. The submit handler is what
  // blocks PI / Monitoring submits without a valid email.
  it('PI without email still produces a valid event (submit-handler enforces email separately)', () => {
    const events = buildEventsFromForm(state({ choice: 'pi_early_access' }), ctx);
    expect(events).toHaveLength(1);
    expect(events[0]?.intent_email).toBeUndefined();
  });

  it('every produced event passes the wire-contract validator', () => {
    const cases: ClosingModalFormState[] = [
      state({ choice: 'pi_early_access' }),
      state({ choice: 'pi_early_access', email: 'jane@example.com' }),
      state({ choice: 'rapid_fix' }),
      state({ choice: 'monitoring' }),
      state({ choice: 'monitoring', email: 'ops@acme.com', cadence: 'monthly' }),
      state({ choice: 'something_else', pills: ['multi_page'] }),
      state({ choice: 'something_else', pills: ['something_else'], freeformText: 'a' }),
      state({ choice: 'something_else', pills: ['multi_page', 'multi_client_portfolio', 'competitor_context'] })
    ];
    for (const s of cases) {
      const events = buildEventsFromForm(s, ctx);
      for (const evt of events) {
        expect(isSignalReportInteractionV1(evt), `event failed validator: ${JSON.stringify(evt)}`).toBe(true);
      }
    }
  });
});
