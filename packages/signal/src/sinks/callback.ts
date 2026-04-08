import type { SignalEventV1, SignalSink } from '@stroma-labs/signal-contracts';

export interface CallbackSinkOptions {
  onReport: (event: SignalEventV1) => void | Promise<void>;
}

export function createCallbackSink(options: CallbackSinkOptions): SignalSink {
  return {
    id: 'callback',
    handle(event) {
      return options.onReport(event);
    }
  };
}
