/**
 * Type definitions for MCP tool handler arguments
 */

import { ALRanges } from './ALRange';

// Base interfaces for common patterns
export interface AppPathArg {
  appPath?: string;
}

export interface RangesArg {
  ranges?: ALRanges;
}

// Core ID Management
export interface GetNextObjectIdArgs extends AppPathArg, RangesArg {
  objectType: string;
  parentObjectId?: number;
  isExtension?: boolean;
}

export interface ReserveIdArgs extends AppPathArg, RangesArg {
  objectType: string;
  id: number;
  parentObjectId?: number;
  isExtension?: boolean;
}

export interface SyncObjectIdsArgs extends AppPathArg {
  ids: Record<string, number[]>;
  merge?: boolean;
  mode?: string;
}

// Authorization & Backend
export interface AuthorizeAppArgs extends AppPathArg {
  authKey?: string;
}
export type CheckAuthorizationArgs = AppPathArg;

export interface GetConsumptionReportArgs extends AppPathArg {
  objectTypes?: string[];
}

// Workspace Management
export interface ScanWorkspaceArgs {
  workspacePath: string;
}
export type GetWorkspaceInfoArgs = Record<string, never>;
export type SetActiveAppArgs = AppPathArg;

// Field & Enum Management
export interface GetNextFieldIdArgs extends AppPathArg {
  tableId: number;
  isExtension?: boolean;
}

export interface GetNextEnumValueIdArgs extends AppPathArg {
  enumId: number;
  isExtension?: boolean;
}

// Collision Detection
export interface CheckCollisionArgs extends AppPathArg {
  objectType: string;
  id: number;
}

export type CheckRangeOverlapsArgs = Record<string, never>;

// Polling
export interface StartPollingArgs {
  interval?: number;
  features?: {
    consumption?: boolean;
    collisions?: boolean;
    pools?: boolean;
  };
}

export type StopPollingArgs = Record<string, never>;
export type GetPollingStatusArgs = Record<string, never>;

// Assignment
export interface AssignIdsArgs extends AppPathArg, RangesArg {
  objectType: string;
  count?: number;
  description?: string;
  checkCollisions?: boolean;
  suggestAlternatives?: boolean;
}

export interface BatchAssignArgs extends AppPathArg {
  assignments: Array<{
    objectType: string;
    count: number;
    description?: string;
  }>;
}

export interface ReserveRangeArgs extends AppPathArg, RangesArg {
  objectType: string;
  from: number;
  to: number;
  description?: string;
}

export interface GetSuggestionsArgs extends AppPathArg {
  objectType: string;
  pattern?: string;
}

export interface GetAssignmentHistoryArgs extends AppPathArg {
  objectType?: string;
  limit?: number;
}

// Configuration
export interface SavePreferencesArgs {
  preferences: {
    logLevel?: string;
    includeUserName?: boolean;
    autoSync?: boolean;
    pollingInterval?: number;
    defaultRanges?: Array<{ from: number; to: number }>;
    collisionChecking?: boolean;
    suggestAlternatives?: boolean;
  };
}

export type GetPreferencesArgs = Record<string, never>;
export type ExportConfigArgs = Record<string, never>;

export interface ImportConfigArgs {
  config: string;
}

export type GetStatisticsArgs = Record<string, never>;