import {
  aggregateSignalEvents,
  encodeSignalReportUrl,
  exportSignalEventsToCSV,
  exportSignalEventsToJSON,
  formatSignalSummary,
  SIGNAL_PREVIEW_MINIMUM_SAMPLE,
  SIGNAL_REPORT_BASE_URL,
  type SignalAggregateV1,
  type SignalEventV1,
  type SignalReportUrlResult,
  type SignalSink
} from '@stroma-labs/signal-contracts';

export interface PreviewCollectorOptions {
  maxEvents?: number;
  reportBaseUrl?: string;
  consoleLog?: boolean;
}

export interface PreviewCollector extends SignalSink {
  getAggregate: () => SignalAggregateV1 | null;
  getReportUrl: () => SignalReportUrlResult;
  getEvents: () => readonly SignalEventV1[];
  getSummary: () => string | null;
  exportEvents: (format: 'json' | 'csv') => string;
  reset: () => void;
}

function cloneSignalEvent(event: SignalEventV1): SignalEventV1 {
  return {
    ...event,
    vitals: {
      ...event.vitals,
      lcp_attribution: event.vitals.lcp_attribution ? { ...event.vitals.lcp_attribution } : undefined,
      inp_attribution: event.vitals.inp_attribution ? { ...event.vitals.inp_attribution } : undefined
    },
    context: { ...event.context },
    meta: { ...event.meta }
  };
}

/**
 * Creates a local preview collector that buffers {@link SignalEventV1}
 * events in memory and produces an aggregate + hosted report URL on demand.
 *
 * Intended for development and QA — not for production data collection.
 *
 * @param options - Buffer size, report base URL, and console logging toggle.
 */
export function createPreviewCollector(options: PreviewCollectorOptions = {}): PreviewCollector {
  const events: SignalEventV1[] = [];
  const maxEvents = options.maxEvents ?? 200;

  const collector: PreviewCollector = {
    id: 'preview-collector',
    handle(event) {
      events.push(cloneSignalEvent(event));
      if (events.length > maxEvents) events.shift();

      if (options.consoleLog) {
        const report = collector.getReportUrl();
        const summary = collector.getSummary();
        if (summary) console.info(`[signal] summary\n${summary}`);
        console.info('[signal] report', report.url);
      }
    },
    getAggregate() {
      if (events.length === 0) return null;
      return aggregateSignalEvents(events, 'preview');
    },
    getReportUrl() {
      const aggregate = collector.getAggregate() ?? aggregateSignalEvents([], 'preview');
      const result = encodeSignalReportUrl(aggregate, options.reportBaseUrl ?? SIGNAL_REPORT_BASE_URL);
      return {
        ...result,
        warnings: [
          ...result.warnings,
          ...(aggregate.sample_size < SIGNAL_PREVIEW_MINIMUM_SAMPLE
            ? ['Preview data is below the recommended sample threshold.']
            : [])
        ]
      };
    },
    getEvents() {
      return [...events];
    },
    getSummary() {
      const aggregate = collector.getAggregate();
      if (!aggregate) return null;
      return formatSignalSummary(aggregate);
    },
    exportEvents(format: 'json' | 'csv') {
      return format === 'csv' ? exportSignalEventsToCSV(events) : exportSignalEventsToJSON(events);
    },
    reset() {
      events.splice(0, events.length);
    }
  };

  return collector;
}
