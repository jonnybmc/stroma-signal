export function createEventId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `signal_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
