// Snippet matrix types. The matrix is the single source of truth for
// every (framework × sink) snippet the wizard generates. docs/framework-
// recipes.md is a generated artifact (Phase C.6); the matrix here is
// canonical.

import type { FrameworkId } from '../detect/framework.js';

export type SinkChoice = 'dataLayer' | 'beacon' | 'callback';

export type FileAction = 'create' | 'modify';
export type FilePosition = 'top' | 'bottom' | 'inside-body';

export interface SnippetFile {
  /** Relative path the user creates/modifies (e.g. 'app/SignalClient.tsx'). */
  path: string;
  action: FileAction;
  /** Body text. May contain {{SAMPLE_RATE}} / {{BEACON_ENDPOINT}}
   *  placeholders that are substituted by render-snippet.ts. */
  body: string;
  /** Where in the existing file to paste — only meaningful when
   *  action === 'modify'. */
  position?: FilePosition;
}

export interface RecipeVerification {
  against_version: string;
  last_verified_at: string;
  upstream_doc_url: string;
}

export interface SnippetSpec {
  framework: FrameworkId;
  sink: SinkChoice;
  files: SnippetFile[];
  /** Per-recipe operator notes (rendered under the snippet in the wizard
   *  + in the generated framework-recipes.md). */
  notes: string[];
  verified: RecipeVerification;
}

export interface SnippetTemplateInputs {
  /** 0 < n ≤ 1. Default 1.0. */
  sampleRate: number;
  /** Required when sink === 'beacon'. */
  beaconEndpoint?: string;
}

export const SAMPLE_RATE_PLACEHOLDER = '{{SAMPLE_RATE}}';
export const BEACON_ENDPOINT_PLACEHOLDER = '{{BEACON_ENDPOINT}}';
