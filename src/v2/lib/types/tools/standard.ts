/**
 * Type definitions for STANDARD mode MCP tools
 */

// ============================================================================
// Pool Tool Types
// ============================================================================

export interface PoolParams {
  action: 'create' | 'join' | 'leave' | 'info' | 'remove' | 'rename';
  appPath: string;
  poolId?: string;
  poolName?: string;
  description?: string;
  force?: boolean;
}

export interface PoolResult {
  action: string;
  success: boolean;
  poolId?: string;
  poolName?: string;
  poolInfo?: {
    id: string;
    name: string;
    description?: string;
    apps: string[];
    created: string;
    updated: string;
  };
  message?: string;
}

// ============================================================================
// Consumption Tool Types
// ============================================================================

export interface ConsumptionParams {
  appPath: string;
  object_type?: string;
  detailed?: boolean;
  include_available?: boolean;
}

export interface ConsumptionResult {
  summary: {
    total_consumed: number;
    by_type: Record<string, number>;
    last_updated?: string;
  };
  details?: Array<{
    type: string;
    id: number;
    consumed_at?: string;
  }>;
  available?: Record<string, number[]>;
}

// ============================================================================
// Sync Tool Types
// ============================================================================

export interface SyncParams {
  action: 'sync' | 'auto-sync' | 'check-status';
  appPath: string;
  mode?: 'full' | 'incremental';
  force?: boolean;
  dry_run?: boolean;
}

export interface SyncResult {
  action: string;
  synced: boolean;
  mode?: string;
  stats?: {
    objects_synced: number;
    objects_added: number;
    objects_removed: number;
    conflicts_resolved: number;
  };
  conflicts?: Array<{
    type: string;
    id: number;
    local_state: string;
    remote_state: string;
    resolution?: string;
  }>;
  message?: string;
}

// ============================================================================
// Log Tool Types
// ============================================================================

export interface LogParams {
  appPath: string;
  limit?: number;
  since?: string;
  until?: string;
  filter?: {
    event_type?: string;
    object_type?: string;
    user?: string;
  };
}

export interface LogResult {
  entries: Array<{
    timestamp: string;
    event_type: string;
    object_type?: string;
    object_id?: number;
    user?: string;
    details?: Record<string, any>;
  }>;
  total: number;
  filtered: number;
}

// ============================================================================
// News RSS Tool Types
// ============================================================================

export interface NewsRssParams {
  action: 'fetch' | 'mark-read';
  limit?: number;
  category?: string;
  item_id?: string;
}

export interface NewsRssResult {
  action: string;
  items?: Array<{
    id: string;
    title: string;
    description: string;
    link: string;
    pubDate: string;
    category?: string;
    read?: boolean;
  }>;
  success?: boolean;
  message?: string;
}