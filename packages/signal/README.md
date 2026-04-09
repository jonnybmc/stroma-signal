# Signal by Stroma

Native-first browser instrumentation for measuring real-user network, device, and performance tiers without forcing teams into a single analytics stack.

## Install

```bash
pnpm add @stroma-labs/signal
```

`@stroma-labs/signal` is ESM-only.

## What Ships In This Package

This npm package ships the browser instrumentation library and its public helper subpaths:

- `@stroma-labs/signal`
- `@stroma-labs/signal/ga4`
- `@stroma-labs/signal/report`

The minimum adoption path is usually:

- `@stroma-labs/signal` for core runtime and sinks
- `@stroma-labs/signal/ga4` if you already use GTM / GA4

`@stroma-labs/signal/report` is optional. It is a preview helper, not part of the minimum instrumentation setup.

This package does not ship the repo's local spike lab, hosted report shell, or builder UI as required consumer setup.

## Quick Start

### Send canonical events to your own endpoint

```ts
import { createBeaconSink, init } from '@stroma-labs/signal';

init({
  sinks: [createBeaconSink({ endpoint: '/rum/signal' })]
});
```

### Push a compact GA4-safe subset into `window.dataLayer`

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

### Handle the canonical event in app code

```ts
import { createCallbackSink, init } from '@stroma-labs/signal';

init({
  sinks: [
    createCallbackSink({
      onReport(event) {
        console.log(event.event_id);
      }
    })
  ]
});
```

## What Is Optional Companion Tooling

The monorepo also contains companion tooling that supports QA, demos, and contributor workflows:

- a local spike lab for proof-of-life testing
- a hosted report shell at `/r`
- a zero-code builder at `/build`

Those are companion repo assets, not required package setup.

## Docs

- Repo README: https://github.com/jonathanbooysen/stroma-signal#readme
- Why Signal exists: https://github.com/jonathanbooysen/stroma-signal/blob/main/docs/why-signal.md
- Setup guide: https://github.com/jonathanbooysen/stroma-signal/blob/main/docs/client-integrations.md
- GTM / GA4 launch path: https://github.com/jonathanbooysen/stroma-signal/blob/main/docs/marketer-quickstart.md
- Public API contract: https://github.com/jonathanbooysen/stroma-signal/blob/main/docs/public-api-v0.1.md
