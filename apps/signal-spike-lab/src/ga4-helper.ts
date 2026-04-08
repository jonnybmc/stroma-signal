import {
  flattenSignalEventForGa4,
  SIGNAL_GA4_EVENT_NAME,
  type SignalEventV1,
  type SignalSink
} from '@stroma-labs/signal-contracts';

export type Ga4BootstrapState = 'disabled' | 'skipped' | 'loading' | 'ready' | 'error';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown> | unknown[] | IArguments>;
    gtag?: (...args: unknown[]) => void;
  }
}

function waitForGa4Script(script: HTMLScriptElement, onStateChange: (state: Ga4BootstrapState) => void): void {
  if (script.dataset.loaded === 'true') {
    onStateChange('ready');
    return;
  }

  onStateChange('loading');
  script.addEventListener(
    'load',
    () => {
      script.dataset.loaded = 'true';
      onStateChange('ready');
    },
    { once: true }
  );
  script.addEventListener(
    'error',
    () => {
      onStateChange('error');
    },
    { once: true }
  );
}

export function bootstrapSpikeLabGa4(
  measurementId: string,
  isAutomation: boolean,
  onStateChange: (state: Ga4BootstrapState) => void
): void {
  if (!measurementId) {
    onStateChange('disabled');
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(...args);
    };

  if (isAutomation) {
    onStateChange('skipped');
    return;
  }

  const scriptId = `stroma-signal-ga4-${measurementId}`;
  const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (existingScript) waitForGa4Script(existingScript, onStateChange);

  if (!existingScript) {
    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.loaded = 'false';
    waitForGa4Script(script, onStateChange);
    document.head.append(script);
  }

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false,
    debug_mode: true
  });
}

export function createSpikeLabGa4Sink(): SignalSink {
  return {
    id: 'spike-lab-ga4-gtag',
    handle(event: SignalEventV1) {
      if (typeof window.gtag !== 'function') return;
      const payload = flattenSignalEventForGa4(event);
      const { event: _ignoredEventName, ...params } = payload;
      window.gtag('event', SIGNAL_GA4_EVENT_NAME, {
        ...params,
        debug_mode: true
      });
    }
  };
}
