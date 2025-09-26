/**
 * Zod validation schemas for tool parameters
 */

import { z } from 'zod';
import { AuthorizationAction, ConfigAction, AllocateMode } from '../types/tools/lite';

// ============================================================================
// Common schemas
// ============================================================================

const rangeSchema = z.object({
  from: z.number().int().positive(),
  to: z.number().int().positive(),
}).refine(data => data.from <= data.to, {
  message: 'Range "from" must be less than or equal to "to"',
});

const alObjectTypeSchema = z.enum([
  'table',
  'tableextension',
  'page',
  'pageextension',
  'report',
  'reportextension',
  'codeunit',
  'xmlport',
  'enum',
  'enumextension',
  'query',
  'permissionset',
  'permissionsetextension',
  'profile',
  'controladdin',
  'dotnetassembly',
  'dotnetinterop',
  'dotnetpackage',
] as const);

// ============================================================================
// Authorization tool schemas
// ============================================================================

export const authorizationSchema = z.object({
  action: z.union([
    z.literal('status'),
    z.literal('start'),
    z.literal('deauthorize'),
    z.nativeEnum(AuthorizationAction),
  ]),
  appPath: z.string().min(1, 'App path is required'),
  interactive: z.boolean().optional().default(true),
});

// ============================================================================
// Config tool schemas
// ============================================================================

const objIdConfigPatchSchema = z.object({
  idRanges: z.record(z.string(), z.array(rangeSchema)).optional(),
  objectNamePrefix: z.string().optional(),
  objectNameSuffix: z.string().optional(),
  bcLicense: z.string().optional(),
  appPoolId: z.string().optional(),
  additionalSettings: z.record(z.string(), z.any()).optional(),
}).partial();

export const configSchema = z.object({
  action: z.union([
    z.literal('read'),
    z.literal('write'),
    z.literal('validate'),
    z.nativeEnum(ConfigAction),
  ]),
  appPath: z.string().min(1, 'App path is required'),
  keys: z.array(z.string()).optional(),
  patch: objIdConfigPatchSchema.optional(),
  merge: z.boolean().optional().default(true),
  schema_version: z.string().optional(),
});

// ============================================================================
// Allocate ID tool schemas
// ============================================================================

const objectMetadataSchema = z.object({
  name: z.string().optional(),
  file: z.string().optional(),
  tag: z.string().optional(),
});

export const allocateIdSchema = z.object({
  mode: z.union([
    z.literal('preview'),
    z.literal('reserve'),
    z.literal('reclaim'),
    z.nativeEnum(AllocateMode),
  ]),
  appPath: z.string().min(1, 'App path is required'),
  object_type: z.union([alObjectTypeSchema, z.string()]),
  count: z.number().int().positive().optional().default(1),
  pool_id: z.string().optional(),
  preferred_range: rangeSchema.optional(),
  object_metadata: objectMetadataSchema.optional(),
  ids: z.array(z.number().int().positive()).optional(),
  dry_run: z.boolean().optional().default(false),
});

// ============================================================================
// Analyze Workspace tool schemas
// ============================================================================

export const analyzeWorkspaceSchema = z.object({
  appPath: z.string().min(1, 'App path is required'),
  include: z.array(z.string()).optional().default(['**/*.al']),
  exclude: z.array(z.string()).optional().default(['**/.alpackages/**', '**/.snapshots/**']),
  object_types: z.array(z.union([alObjectTypeSchema, z.string()])).optional(),
  return_level: z.enum(['summary', 'detailed']).optional().default('summary'),
  detect_collisions: z.boolean().optional().default(true),
  map_to_pools: z.boolean().optional().default(false),
});

