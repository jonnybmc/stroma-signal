import type { SignalEventV1, SignalSink } from '@stroma-labs/signal-contracts';

export interface BeaconSinkOptions {
  endpoint: string;
  onError?: (error: unknown, event: SignalEventV1) => void;
}

/**
 * Creates a sink that sends the canonical {@link SignalEventV1} to a
 * remote endpoint using `navigator.sendBeacon`, falling back to `fetch`
 * with `keepalive: true` when `sendBeacon` is unavailable or fails.
 *
 * @param options - Endpoint URL and optional error handler.
 */
export function createBeaconSink(options: BeaconSinkOptions): SignalSink {
  return {
    id: 'beacon',
    handle(event: SignalEventV1) {
      try {
        const payload = JSON.stringify(event);
        const blob = new Blob([payload], { type: 'application/json' });
        const sent = globalThis.navigator?.sendBeacon?.(options.endpoint, blob);

        if (sent) return;

        if (typeof globalThis.fetch !== 'function') {
          options.onError?.(new Error('sendBeacon was unavailable and fetch fallback is missing.'), event);
          return;
        }

        void globalThis
          .fetch(options.endpoint, {
            method: 'POST',
            headers: {
              'content-type': 'application/json'
            },
            body: payload,
            keepalive: true
          })
          .catch((error) => {
            options.onError?.(error, event);
          });
      } catch (error) {
        options.onError?.(error, event);
      }
    }
  };
}
