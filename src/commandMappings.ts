/**
 * Centralized command-to-handler mapping registry
 * Maps tool names to their handler implementations across all license tiers
 *
 * @description
 * This registry enables dynamic handler loading based on license tier and command name.
 * Handlers are organized by tier (lite, standard, full) to enforce license restrictions.
 *
 * Structure:
 * - Lite: Basic functionality (3 commands)
 * - Standard: Authorization and workspace features (11 commands including lite)
 * - Full: Advanced features including polling and configuration (25 commands total)
 *
 * @since 1.0.0
 */

/**
 * Handler configuration interface
 * @interface
 */
interface HandlerConfig {
  /**
   * The exported handler function name
   */
  handler: string;

  /**
   * The path to the handler module (relative to src)
   */
  path: string;
}

/**
 * Command mappings organized by license tier
 */
export const commandMappings = {
  /**
   * Lite tier commands - Available to all users
   */
  lite: {
    'scan-workspace': {
      handler: 'handleScanWorkspace',
      path: './handlers/lite/scanWorkspaceHandler'
    },
    'set-active-app': {
      handler: 'handleSetActiveApp',
      path: './handlers/lite/setActiveAppHandler'
    },
    'get-next-id': {
      handler: 'handleGetNextId',
      path: './handlers/lite/getNextIdHandler'
    }
  } as Record<string, HandlerConfig>,

  /**
   * Standard tier commands - Includes all lite commands plus these
   */
  standard: {
    // Authorization handlers
    'check-authorization': {
      handler: 'handleCheckAuthorization',
      path: './handlers/standard/authorization/checkAuthorizationHandler'
    },
    'authorize-app': {
      handler: 'handleAuthorizeApp',
      path: './handlers/standard/authorization/authorizeAppHandler'
    },
    'get-consumption-report': {
      handler: 'handleGetConsumptionReport',
      path: './handlers/standard/authorization/getConsumptionReportHandler'
    },

    // Workspace handlers (override lite versions)
    'scan-workspace': {
      handler: 'handleScanWorkspace',
      path: './handlers/standard/workspace/scanWorkspaceHandler'
    },
    'get-workspace-info': {
      handler: 'handleGetWorkspaceInfo',
      path: './handlers/standard/workspace/getWorkspaceInfoHandler'
    },
    'set-active-app': {
      handler: 'handleSetActiveApp',
      path: './handlers/standard/workspace/setActiveAppHandler'
    },

    // Field handlers
    'get-next-field-id': {
      handler: 'handleGetNextFieldId',
      path: './handlers/standard/field/getNextFieldIdHandler'
    },
    'get-next-enum-value-id': {
      handler: 'handleGetNextEnumValueId',
      path: './handlers/standard/field/getNextEnumValueIdHandler'
    },

    // Core commands (override lite version)
    'get-next-id': {
      handler: 'handleGetNextId',
      path: './handlers/standard/core/getNextIdHandler'
    },
    'reserve-id': {
      handler: 'handleReserveId',
      path: './handlers/standard/core/reserveIdHandler'
    },
    'sync-object-ids': {
      handler: 'handleSyncObjectIds',
      path: './handlers/standard/core/syncObjectIdsHandler'
    }
  } as Record<string, HandlerConfig>,

  /**
   * Full tier commands - Includes all standard commands plus these
   */
  full: {
    // Assignment handlers
    'assign-ids': {
      handler: 'handleAssignIds',
      path: './handlers/full/assignment/assignIdsHandler'
    },
    'batch-assign': {
      handler: 'handleBatchAssign',
      path: './handlers/full/assignment/batchAssignHandler'
    },
    'reserve-range': {
      handler: 'handleReserveRange',
      path: './handlers/full/assignment/reserveRangeHandler'
    },
    'get-suggestions': {
      handler: 'handleGetSuggestions',
      path: './handlers/full/assignment/getSuggestionsHandler'
    },
    'get-assignment-history': {
      handler: 'handleGetAssignmentHistory',
      path: './handlers/full/assignment/getAssignmentHistoryHandler'
    },

    // Collision handlers
    'check-collision': {
      handler: 'handleCheckCollision',
      path: './handlers/full/collision/checkCollisionHandler'
    },
    'check-range-overlaps': {
      handler: 'handleCheckRangeOverlaps',
      path: './handlers/full/collision/checkRangeOverlapsHandler'
    },

    // Polling handlers
    'start-polling': {
      handler: 'handleStartPolling',
      path: './handlers/full/polling/startPollingHandler'
    },
    'stop-polling': {
      handler: 'handleStopPolling',
      path: './handlers/full/polling/stopPollingHandler'
    },
    'get-polling-status': {
      handler: 'handleGetPollingStatus',
      path: './handlers/full/polling/getPollingStatusHandler'
    },

    // Configuration handlers
    'save-preferences': {
      handler: 'handleSavePreferences',
      path: './handlers/full/config/savePreferencesHandler'
    },
    'get-preferences': {
      handler: 'handleGetPreferences',
      path: './handlers/full/config/getPreferencesHandler'
    },
    'export-config': {
      handler: 'handleExportConfig',
      path: './handlers/full/config/exportConfigHandler'
    },
    'import-config': {
      handler: 'handleImportConfig',
      path: './handlers/full/config/importConfigHandler'
    },
    'get-statistics': {
      handler: 'handleGetStatistics',
      path: './handlers/full/config/getStatisticsHandler'
    }
  } as Record<string, HandlerConfig>
};

/**
 * Helper function to get handler configuration by command name and tier
 *
 * @param command - The command name
 * @param tier - The license tier
 * @returns Handler configuration or undefined if not found
 */
export function getHandlerConfig(
  command: string,
  tier: 'lite' | 'standard' | 'full'
): HandlerConfig | undefined {
  // Check current tier first
  if (commandMappings[tier]?.[command]) {
    return commandMappings[tier][command];
  }

  // Check lower tiers for standard and full
  if (tier === 'full' && commandMappings.standard[command]) {
    return commandMappings.standard[command];
  }
  if ((tier === 'full' || tier === 'standard') && commandMappings.lite[command]) {
    return commandMappings.lite[command];
  }

  return undefined;
}

/**
 * Get all available commands for a given tier
 *
 * @param tier - The license tier
 * @returns Array of available command names
 */
export function getAvailableCommands(tier: 'lite' | 'standard' | 'full'): string[] {
  const commands = new Set<string>();

  // Add lite commands for all tiers
  Object.keys(commandMappings.lite).forEach(cmd => commands.add(cmd));

  // Add standard commands for standard and full
  if (tier === 'standard' || tier === 'full') {
    Object.keys(commandMappings.standard).forEach(cmd => commands.add(cmd));
  }

  // Add full commands for full tier
  if (tier === 'full') {
    Object.keys(commandMappings.full).forEach(cmd => commands.add(cmd));
  }

  return Array.from(commands);
}