import { Range } from './BackendTypes';

// ALRange is an alias for Range to maintain compatibility
export type ALRange = Range;

export interface ALRanges extends Array<ALRange> {
  mandatory?: boolean;
}