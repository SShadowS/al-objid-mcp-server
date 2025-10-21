/**
 * Zod validation schemas for STANDARD mode tools
 */

import { z } from 'zod';
import { coercedNumber, coercedBoolean, coercedPositiveInteger } from './coercion';

// ============================================================================
// Pool Tool Schemas
// ============================================================================

export const poolSchema = z.object({
  action: z.enum(['create', 'join', 'leave', 'info', 'remove', 'rename']),
  appPath: z.string().min(1, 'App path is required'),
  poolId: z.string().optional(),
  poolName: z.string().optional(),
  description: z.string().optional(),
  force: coercedBoolean().optional().default(false),
});

export type PoolInput = z.infer<typeof poolSchema>;

// ============================================================================
// Consumption Tool Schemas
// ============================================================================

export const consumptionSchema = z.object({
  appPath: z.string().min(1, 'App path is required'),
  object_type: z.string().optional(),
  detailed: coercedBoolean().optional().default(false),
  include_available: coercedBoolean().optional().default(false),
});

export type ConsumptionInput = z.infer<typeof consumptionSchema>;

// ============================================================================
// Sync Tool Schemas
// ============================================================================

export const syncSchema = z.object({
  action: z.enum(['sync', 'auto-sync', 'check-status']),
  appPath: z.string().min(1, 'App path is required'),
  mode: z.enum(['full', 'incremental']).optional().default('incremental'),
  force: coercedBoolean().optional().default(false),
  dry_run: coercedBoolean().optional().default(false),
});

export type SyncInput = z.infer<typeof syncSchema>;

// ============================================================================
// Log Tool Schemas
// ============================================================================

export const logSchema = z.object({
  appPath: z.string().min(1, 'App path is required'),
  limit: coercedNumber().min(1).max(1000).optional().default(100),
  since: z.string().optional(),
  until: z.string().optional(),
  filter: z.object({
    event_type: z.string().optional(),
    object_type: z.string().optional(),
    user: z.string().optional(),
  }).optional(),
});

export type LogInput = z.infer<typeof logSchema>;

// ============================================================================
// News RSS Tool Schemas
// ============================================================================

export const newsRssSchema = z.object({
  action: z.enum(['fetch', 'mark-read']),
  limit: coercedNumber().min(1).max(100).optional().default(10),
  category: z.string().optional(),
  item_id: z.string().optional(),
});

export type NewsRssInput = z.infer<typeof newsRssSchema>;

// ============================================================================
// Assignment Tool Schemas
// ============================================================================

export const assignmentSchema = z.object({
  action: z.enum(['store', 'remove', 'check']),
  appPath: z.string().min(1, 'App path is required'),
  object_type: z.string().min(1, 'Object type is required'),
  id: coercedPositiveInteger(),
  authKey: z.string().optional(),
});

export type AssignmentInput = z.infer<typeof assignmentSchema>;