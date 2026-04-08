export type SignalLifecycleState =
  | 'booting'
  | 'observing'
  | 'finalizing'
  | 'flushed'
  | 'sealed';

export type SignalLifecycleAction =
  | 'start'
  | 'activate_prerender'
  | 'page_hidden'
  | 'pagehide'
  | 'flush_success'
  | 'flush_error'
  | 'bfcache_restore'
  | 'destroy';

export function transitionSignalLifecycle(
  current: SignalLifecycleState,
  action: SignalLifecycleAction
): SignalLifecycleState {
  switch (current) {
    case 'booting':
      if (action === 'start' || action === 'activate_prerender' || action === 'bfcache_restore') return 'observing';
      if (action === 'destroy') return 'sealed';
      return current;
    case 'observing':
      if (action === 'page_hidden' || action === 'pagehide') return 'finalizing';
      if (action === 'destroy') return 'sealed';
      return current;
    case 'finalizing':
      if (action === 'flush_success') return 'flushed';
      if (action === 'flush_error' || action === 'destroy') return 'sealed';
      return current;
    case 'flushed':
      if (action === 'bfcache_restore') return 'observing';
      if (action === 'destroy') return 'sealed';
      return current;
    case 'sealed':
      if (action === 'bfcache_restore') return 'observing';
      return current;
    default:
      return current;
  }
}
