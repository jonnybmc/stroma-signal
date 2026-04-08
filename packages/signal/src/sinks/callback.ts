import type { SignalEventV1, SignalSink } from '@stroma-labs/signal-contracts';

export interface CallbackSinkOptions {
  onReport: (event: SignalEventV1) => void | Promise<void>;
}

/**
 * Creates a sink that forwards each {@link SignalEventV1} to a user-provided
 * callback, giving full control over how events are processed.
 *
 * @param options - Object containing the `onReport` callback.
 */
export function createCallbackSink(options: CallbackSinkOptions): SignalSink {
  return {
    id: 'callback',
    handle(event) {
      return options.onReport(event);
    }
  };
}
