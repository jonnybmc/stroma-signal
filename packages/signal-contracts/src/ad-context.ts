// Ad-context capture contract for operator-side attribution analysis.
//
// Captures the ad-click identifiers and UTM tags that landed a session,
// alongside provenance flags that describe the capture conditions
// (consent state, browser-side stripping heuristics, missing-vs-present
// per field). Persists to the operator's warehouse alongside Signal's
// performance events so the operator can join their own paid-traffic
// data downstream.
//
// Opt-in only. Feature-flagged in the SDK via `signal.init({ adContextCapture: true })`
// — default `false`. Existing installs pay no capture cost unless they
// explicitly enable it.
//
// Privacy: every field captured is justified by a concrete attribution-
// engineering use case named in `docs/ad-context-capture.md`. Fields
// explicitly NOT on this contract: PII of any kind, full URL with
// query string (only the pathname is captured), email addresses,
// fingerprint hashes, raw user-agent strings, or any field whose
// presence is not justified in the public spec.
//
// Coverage caveats: capture is bounded by what the operator's visitors'
// browsers permit. Safari ITP / iOS ATFP strips known click IDs in
// ~20%+ of sessions; Consent Mode v2 denial leaves only URL params
// surviving. The `provenance` block records what was observed at
// capture time so downstream analysis can account for coverage.

export const SIGNAL_AD_CONTEXT_CAPTURE_VERSION = 1 as const;

/** Consent state for ad-related storage at the moment of capture.
 *  Read from Google Consent Mode v2 `ad_storage` if the operator has
 *  consent-mode wired; falls back to `'unknown'` otherwise. */
export type SignalAdContextConsentState = 'granted' | 'denied' | 'unknown';

/** Heuristic flag — set true when the capture-time URL had no recognised
 *  ad-click identifier AND the referrer was an ad network domain (Google,
 *  Bing, Facebook, LinkedIn, Microsoft). Indicates likely ITP / ATFP
 *  stripping rather than non-paid traffic. False-positive prone by design
 *  — operators read this as a hint, not as ground truth. */
export type SignalAdContextItpHint = 'likely_stripped' | 'no_signal' | 'not_applicable';

/** Per-field presence flag used in the provenance block. Each captured
 *  identifier has one of these states so downstream coverage analysis
 *  can distinguish "absent because never present" from "absent because
 *  stripped". `unknown` covers the case where the SDK could not determine
 *  which it was (e.g. document.referrer empty for cross-origin reasons). */
export type SignalAdContextFieldPresence = 'present' | 'absent' | 'unknown';

/** Captured ad-click identifiers. All optional — a session may have zero,
 *  one, or several of these. The provenance block separately records
 *  which were present and which were absent.
 *
 *  - `gclid`: Google click identifier (most paid Google traffic)
 *  - `gbraid`: Google iOS-context substitute for `gclid` where Apple
 *    privacy constraints preclude `gclid` use
 *  - `wbraid`: Google web-app-context substitute for `gclid`
 *  - `fbclid`: Facebook click identifier
 *  - `msclkid`: Microsoft Advertising click identifier
 *  - `dclid`: DoubleClick / Google Display click identifier
 *  - `srsltid`: Google Merchant Center listing identifier
 */
export interface SignalAdContextClickIds {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  msclkid?: string;
  dclid?: string;
  srsltid?: string;
}

/** UTM tags captured from the landing URL query string. Optional —
 *  many sessions arrive with no UTM tags (organic, direct, manually
 *  tagged campaigns may use different schemes). */
export interface SignalAdContextUtm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

/** Provenance block — describes the capture conditions so coverage
 *  analysis can be honest about what was observable.
 *
 *  - `consent_state`: ad_storage state at capture (or `unknown` if no
 *    consent-mode integration)
 *  - `itp_hint`: heuristic for ITP / ATFP stripping (false-positive prone)
 *  - `gclid_presence` etc: per-identifier presence flags so the absence
 *    of an identifier is interpretable downstream
 *  - `capture_ts`: ms-epoch timestamp at capture
 */
export interface SignalAdContextProvenance {
  consent_state: SignalAdContextConsentState;
  itp_hint: SignalAdContextItpHint;
  gclid_presence: SignalAdContextFieldPresence;
  gbraid_presence: SignalAdContextFieldPresence;
  wbraid_presence: SignalAdContextFieldPresence;
  fbclid_presence: SignalAdContextFieldPresence;
  msclkid_presence: SignalAdContextFieldPresence;
  dclid_presence: SignalAdContextFieldPresence;
  srsltid_presence: SignalAdContextFieldPresence;
  utm_any_presence: SignalAdContextFieldPresence;
  capture_ts: number;
}

/** Top-level capture record. One row per session-start when ad-context
 *  capture is enabled. UPSERT-keyed by `capture_id` so a session that
 *  navigates within the SPA does not generate duplicate rows.
 *
 *  Captured fields not on this contract are silently dropped — the SDK
 *  does not capture full URLs, document titles, viewport dimensions,
 *  user-agent strings, or any other ambient browser data via this
 *  module. Other Signal modules may capture those independently under
 *  their own opt-in flags. */
export interface SignalAdContextCaptureV1 {
  /** Schema version. Bumps require a new versioned type
   *  (`SignalAdContextCaptureV2` etc.) — never an in-place change. */
  v: typeof SIGNAL_AD_CONTEXT_CAPTURE_VERSION;
  /** UPSERT key — one row per session capture event. Generated by the
   *  SDK as a UUID at session start. */
  capture_id: string;
  /** ms-epoch timestamp of session start. */
  ts: number;
  /** Pathname only (no query string, no fragment, no origin). Capped
   *  at 256 chars by the validator — paths longer than that are
   *  truncated to head + ellipsis. */
  landing_path: string;
  /** Document referrer — origin only (the SDK normalises to the
   *  origin string, not the full URL). Empty string when the referrer
   *  is empty / opaque / same-origin. */
  referrer_origin: string;
  /** Captured click identifiers. Missing fields are absent from this
   *  object (not present as `null`). */
  click_ids: SignalAdContextClickIds;
  /** Captured UTM tags. Missing fields are absent. */
  utm: SignalAdContextUtm;
  /** Provenance block. Always present (every field has a value). */
  provenance: SignalAdContextProvenance;
}

export const SIGNAL_AD_CONTEXT_VALID_CONSENT_STATES: ReadonlySet<SignalAdContextConsentState> = new Set([
  'granted',
  'denied',
  'unknown'
]);

export const SIGNAL_AD_CONTEXT_VALID_ITP_HINTS: ReadonlySet<SignalAdContextItpHint> = new Set([
  'likely_stripped',
  'no_signal',
  'not_applicable'
]);

export const SIGNAL_AD_CONTEXT_VALID_FIELD_PRESENCES: ReadonlySet<SignalAdContextFieldPresence> = new Set([
  'present',
  'absent',
  'unknown'
]);

/** Max length for `landing_path` before truncation. 256 chars covers
 *  every realistic URL path; longer paths are typically auto-generated
 *  and don't carry useful signal. */
export const SIGNAL_AD_CONTEXT_LANDING_PATH_MAX_LEN = 256;

/** Type guard — true when the value structurally matches
 *  SignalAdContextCaptureV1. Use this on the warehouse-ingest side
 *  before persistence. */
export function isSignalAdContextCaptureV1(value: unknown): value is SignalAdContextCaptureV1 {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (r.v !== SIGNAL_AD_CONTEXT_CAPTURE_VERSION) return false;
  if (typeof r.capture_id !== 'string' || r.capture_id.length === 0) return false;
  if (typeof r.ts !== 'number' || !Number.isFinite(r.ts)) return false;
  if (typeof r.landing_path !== 'string') return false;
  if (r.landing_path.length > SIGNAL_AD_CONTEXT_LANDING_PATH_MAX_LEN) return false;
  if (typeof r.referrer_origin !== 'string') return false;
  if (typeof r.click_ids !== 'object' || r.click_ids === null) return false;
  if (typeof r.utm !== 'object' || r.utm === null) return false;
  if (typeof r.provenance !== 'object' || r.provenance === null) return false;
  return isValidProvenance(r.provenance);
}

function isValidProvenance(value: unknown): value is SignalAdContextProvenance {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (!SIGNAL_AD_CONTEXT_VALID_CONSENT_STATES.has(r.consent_state as SignalAdContextConsentState)) return false;
  if (!SIGNAL_AD_CONTEXT_VALID_ITP_HINTS.has(r.itp_hint as SignalAdContextItpHint)) return false;
  for (const k of [
    'gclid_presence',
    'gbraid_presence',
    'wbraid_presence',
    'fbclid_presence',
    'msclkid_presence',
    'dclid_presence',
    'srsltid_presence',
    'utm_any_presence'
  ] as const) {
    if (!SIGNAL_AD_CONTEXT_VALID_FIELD_PRESENCES.has(r[k] as SignalAdContextFieldPresence)) return false;
  }
  if (typeof r.capture_ts !== 'number' || !Number.isFinite(r.capture_ts)) return false;
  return true;
}
