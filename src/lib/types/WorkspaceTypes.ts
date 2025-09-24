/**
 * Type definitions for Workspace-related types
 */

/**
 * AL app.json manifest structure
 */
export interface AppJsonManifest {
  id: string;
  name: string;
  version: string;
  publisher: string;
  idRanges?: Array<{ from: number; to: number }>;
  idRange?: { from: number; to: number };
  [key: string]: unknown; // Allow additional properties
}

/**
 * .objidconfig file structure
 */
export interface ObjIdConfigFile {
  authKey?: string;
  appPoolId?: string;
  ranges?: RangeInput[];
  idRanges?: Record<string, RangeInput[]>;
  objectRanges?: {
    [key: string]: Array<{
      from: number;
      to: number;
      description?: string;
    }>;
  };
}

/**
 * Input type for range parsing
 * Can be either a string like "50000..50099" or an object
 */
export type RangeInput = string | { from: number; to: number };

/**
 * Parsed range structure
 */
export interface ParsedRange {
  from: number;
  to: number;
}

/**
 * Type guard to check if input is a string range
 */
export function isStringRange(value: RangeInput): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if input is an object range
 */
export function isObjectRange(value: RangeInput): value is { from: number; to: number } {
  return typeof value === 'object' &&
         value !== null &&
         'from' in value &&
         'to' in value &&
         typeof value.from === 'number' &&
         typeof value.to === 'number';
}