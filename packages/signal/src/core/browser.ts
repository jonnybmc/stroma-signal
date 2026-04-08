export function detectBrowser(userAgent = globalThis.navigator?.userAgent ?? ''): string {
  const ua = userAgent.toLowerCase();

  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('firefox/')) return 'firefox';
  if (ua.includes('safari/') && !ua.includes('chrome/') && !ua.includes('chromium/')) return 'safari';
  if (ua.includes('chrome/') || ua.includes('chromium/')) return 'chrome';
  return 'unknown';
}
