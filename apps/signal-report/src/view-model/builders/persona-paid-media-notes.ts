// Persona-card row qualifiers framed for the /r target persona
// (Paid-Media / PPC operator, CMO under conversion-rate pressure).
// Each function takes the same canonical bucket key / numeric value the
// persona builder already has access to and returns a 2-5 word note
// expressing what the technical value implies for paid-media flows
// (LP load, ad-script overhead, video pre-roll, first paint).
//
// Returns null when the value is unknown / unmeasured — the renderer
// then omits the qualifier rather than fabricating one.

export function effectiveTypeNote(key: string): string | null {
  switch (key) {
    case '4g':
      return 'fast cellular';
    case '3g':
      return 'slow cellular · video buffers';
    case '2g':
      return 'text-only LPs viable';
    case 'slow_2g':
      return 'most assets fail to load';
    default:
      return null;
  }
}

export function bandwidthNote(mbps: number | null | undefined): string | null {
  if (mbps == null || mbps <= 0) return null;
  if (mbps >= 10) return 'fast LP load';
  if (mbps >= 3) return 'moderate LP load';
  if (mbps >= 1) return 'slow LP load · video drops';
  return 'LP assets time out';
}

export function rttNote(ms: number | null | undefined): string | null {
  if (ms == null || ms <= 0) return null;
  if (ms < 100) return 'snappy first byte';
  if (ms < 300) return 'noticeable click-to-paint lag';
  if (ms < 600) return 'multi-second first paint';
  return 'unviable for typical paid flows';
}

export function coresNote(key: string): string | null {
  switch (key) {
    case '1':
      return 'drops frames during paint';
    case '2':
      return 'ad scripts stall paint';
    case '4':
      return 'typical mid-range';
    case '6':
    case '8':
    case '12_plus':
      return 'handles heavy LPs';
    default:
      return null;
  }
}

export function memoryNote(key: string): string | null {
  switch (key) {
    case '0_5':
      return 'OOM risk during LP load';
    case '1':
      return 'tight headroom';
    case '2':
      return 'tight headroom';
    case '4':
      return 'typical mobile';
    case '8_plus':
      return 'comfortable headroom';
    default:
      return null;
  }
}
