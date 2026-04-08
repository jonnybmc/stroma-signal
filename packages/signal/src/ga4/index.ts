import {
  flattenSignalEventForGa4,
  SIGNAL_GA4_EVENT_NAME,
  type SignalEventV1,
  type SignalSink
} from '@stroma-labs/signal-contracts';

export interface DataLayerSinkOptions {
  dataLayerName?: string;
  eventName?: string;
  target?: Window & typeof globalThis;
}

/**
 * Creates a sink that pushes a GA4-compatible flat object into
 * `window.dataLayer` (or a custom data layer), ready for GTM to
 * forward as a GA4 event.
 *
 * @param options - Optional overrides for data layer name, event name, and target window.
 */
export function createDataLayerSink(options: DataLayerSinkOptions = {}): SignalSink {
  return {
    id: 'data-layer',
    handle(event: SignalEventV1) {
      const target = options.target ?? globalThis.window;
      const dataLayerName = options.dataLayerName ?? 'dataLayer';
      const payload = {
        ...flattenSignalEventForGa4(event),
        event: options.eventName ?? SIGNAL_GA4_EVENT_NAME
      };
      const recordTarget = target as unknown as Record<string, unknown>;

      const container = recordTarget[dataLayerName];
      if (Array.isArray(container)) {
        container.push(payload);
        return;
      }

      recordTarget[dataLayerName] = [payload];
    }
  };
}
