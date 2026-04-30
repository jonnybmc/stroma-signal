// Story-block barrel. Each module is the single home for one story
// type's accumulator + ingest + finalize trio. The aggregator
// orchestrates them; the contracts barrel only re-exports the public
// helper (`classifyThirdPartyShareTier`).

export { type ContextStoryInput, finalizeContextStory } from './context.js';

export {
  createInpStoryAccumulator,
  finalizeInpStory,
  type InpStoryAccumulator,
  ingestInpStoryEvent
} from './inp.js';
export {
  createLcpStoryAccumulator,
  finalizeLcpStory,
  ingestLcpStoryEvent,
  type LcpStoryAccumulator
} from './lcp.js';

export {
  createLoafStoryAccumulator,
  finalizeLoafStory,
  ingestLoafStoryEvent,
  type LoafStoryAccumulator
} from './loaf.js';
export {
  classifyThirdPartyShareTier,
  createThirdPartyStoryAccumulator,
  finalizeThirdPartyStory,
  ingestThirdPartyStoryEvent,
  type ThirdPartyStoryAccumulator
} from './third-party.js';
