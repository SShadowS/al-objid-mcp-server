/**
 * Centralized command-to-handler mapping registry
 * Maps tool names to their handler implementations across all modes
 *
 * @description
 * This registry enables dynamic handler loading based on mode and command name.
 * Handlers are organized by mode (lite, standard, full) to control feature availability.
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
 * Command mappings organized by mode
 */
export const commandMappings = {
  /**
   * Lite mode commands - Available to all users
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
   * Standard mode commands - Includes all lite commands plus these
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
   * Full mode commands - Includes all standard commands plus these
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
 * Helper function to get handler configuration by command name and mode
 *
 * @param command - The command name
 * @param mode - The mode (lite, standard, or full)
 * @returns Handler configuration or undefined if not found
 */
export function getHandlerConfig(
  command: string,
  mode: 'lite' | 'standard' | 'full'
): HandlerConfig | undefined {
  // Check current mode first
  if (commandMappings[mode]?.[command]) {
    return commandMappings[mode][command];
  }

  // Check lower modes for standard and full
  if (mode === 'full' && commandMappings.standard[command]) {
    return commandMappings.standard[command];
  }
  if ((mode === 'full' || mode === 'standard') && commandMappings.lite[command]) {
    return commandMappings.lite[command];
  }

  return undefined;
}

/**
 * Get all available commands for a given mode
 *
 * @param mode - The mode (lite, standard, or full)
 * @returns Array of available command names
 */
export function getAvailableCommands(mode: 'lite' | 'standard' | 'full'): string[] {
  const commands = new Set<string>();

  // Add lite commands for all modes
  Object.keys(commandMappings.lite).forEach(cmd => commands.add(cmd));

  // Add standard commands for standard and full modes
  if (mode === 'standard' || mode === 'full') {
    Object.keys(commandMappings.standard).forEach(cmd => commands.add(cmd));
  }

  // Add full commands for full mode
  if (mode === 'full') {
    Object.keys(commandMappings.full).forEach(cmd => commands.add(cmd));
  }

  return Array.from(commands);
}