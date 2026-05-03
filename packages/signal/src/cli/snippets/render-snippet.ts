// Snippet rendering. applyTemplate substitutes {{SAMPLE_RATE}} and
// {{BEACON_ENDPOINT}} placeholders from a SnippetSpec body. Errors
// loudly if any unrecognised {{TOKEN}} survives in output — protects
// against silent placeholder leaks (P1-21 fix on the matrix-as-source-
// of-truth direction).

import {
  BEACON_ENDPOINT_PLACEHOLDER,
  SAMPLE_RATE_PLACEHOLDER,
  type SnippetFile,
  type SnippetSpec,
  type SnippetTemplateInputs
} from './types.js';

const KNOWN_PLACEHOLDERS = new Set([SAMPLE_RATE_PLACEHOLDER, BEACON_ENDPOINT_PLACEHOLDER]);

export interface RenderedSnippetFile extends Omit<SnippetFile, 'body'> {
  body: string;
}

export interface RenderedSnippet {
  framework: SnippetSpec['framework'];
  sink: SnippetSpec['sink'];
  files: RenderedSnippetFile[];
  notes: string[];
  verified: SnippetSpec['verified'];
}

export class TemplatePlaceholderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplatePlaceholderError';
  }
}

function applyTemplate(body: string, inputs: SnippetTemplateInputs): string {
  let out = body;
  // Substitute sample rate (always present in template inputs; default 1.0).
  out = out.split(SAMPLE_RATE_PLACEHOLDER).join(String(inputs.sampleRate));
  // Substitute beacon endpoint if present in the body.
  if (out.includes(BEACON_ENDPOINT_PLACEHOLDER)) {
    if (!inputs.beaconEndpoint) {
      throw new TemplatePlaceholderError(`Template requires beaconEndpoint but none was provided in template inputs.`);
    }
    out = out.split(BEACON_ENDPOINT_PLACEHOLDER).join(inputs.beaconEndpoint);
  }
  // Surface any UNRECOGNISED placeholders (typos in matrix.ts that
  // would otherwise silently render as literal {{FOO}} in the user's
  // generated file).
  const remaining = out.match(/\{\{[A-Z_]+\}\}/g);
  if (remaining) {
    const unknown = remaining.filter((p) => !KNOWN_PLACEHOLDERS.has(p));
    if (unknown.length > 0) {
      throw new TemplatePlaceholderError(`Unrecognised placeholder(s) in template: ${unknown.join(', ')}`);
    }
  }
  return out;
}

export function renderSnippet(spec: SnippetSpec, inputs: SnippetTemplateInputs): RenderedSnippet {
  return {
    framework: spec.framework,
    sink: spec.sink,
    files: spec.files.map((f) => ({
      ...f,
      body: applyTemplate(f.body, inputs)
    })),
    notes: spec.notes,
    verified: spec.verified
  };
}
