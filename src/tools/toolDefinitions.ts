/**
 * JSON Schema type definition for tool inputs
 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: unknown;
  enum?: string[];
  description?: string;
  [key: string]: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  category: 'core' | 'workspace' | 'authorization' | 'field' | 'collision' | 'polling' | 'assignment' | 'config';
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // Core ID Management
  {
    name: "get-next-id",
    description: "Get the next available ID for objects or fields without reserving it",
    category: 'core',
    inputSchema: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          enum: ["table", "page", "report", "codeunit", "query", "xmlport", "enum", "field"],
          description: "Type of AL object or 'field' for field IDs"
        },
        parentObjectId: {
          type: "number",
          description: "For field IDs: the table ID. For enum values: the enum ID"
        },
        isExtension: {
          type: "boolean",
          description: "Whether this is for a table/enum extension"
        },
        ranges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: { type: "number" },
              to: { type: "number" }
            }
          },
          description: "Optional custom ranges to search within"
        },
        appPath: {
          type: "string",
          description: "Path to the AL app (optional, uses active app if not provided)"
        }
      },
      required: ["objectType"]
    }
  },
  {
    name: "reserve-id",
    description: "Reserve a specific ID for use",
    category: 'core',
    inputSchema: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          enum: ["table", "page", "report", "codeunit", "query", "xmlport", "enum", "field"],
          description: "Type of AL object or 'field' for field IDs"
        },
        id: {
          type: "number",
          description: "The specific ID to reserve"
        },
        parentObjectId: {
          type: "number",
          description: "For field IDs: the table ID. For enum values: the enum ID"
        },
        isExtension: {
          type: "boolean",
          description: "Whether this is for a table/enum extension"
        },
        appPath: {
          type: "string",
          description: "Path to the AL app (optional, uses active app if not provided)"
        }
      },
      required: ["objectType", "id"]
    }
  },
  {
    name: "sync-object-ids",
    description: "Sync consumed object IDs with the backend",
    category: 'core',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Path to the AL app"
        },
        ids: {
          type: "object",
          description: "Object IDs by type to sync"
        }
      },
      required: ["ids"]
    }
  },

  // Authorization & Backend
  {
    name: "check-authorization",
    description: "Check if an AL app is authorized",
    category: 'authorization',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Path to the AL app"
        }
      },
      required: ["appPath"]
    }
  },
  {
    name: "authorize-app",
    description: "Authorize an AL app with the backend",
    category: 'authorization',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Path to the AL app"
        }
      },
      required: ["appPath"]
    }
  },
  {
    name: "get-consumption-report",
    description: "Get a consumption report for an app",
    category: 'authorization',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Path to the AL app"
        },
        objectTypes: {
          type: "array",
          items: { type: "string" },
          description: "Object types to include in report"
        }
      },
      required: ["appPath"]
    }
  },

  // Workspace Management
  {
    name: "scan-workspace",
    description: "Scan a workspace for AL apps",
    category: 'workspace',
    inputSchema: {
      type: "object",
      properties: {
        workspacePath: {
          type: "string",
          description: "Path to the workspace root"
        }
      },
      required: ["workspacePath"]
    }
  },
  {
    name: "get-workspace-info",
    description: "Get information about the current workspace",
    category: 'workspace',
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "set-active-app",
    description: "Set the active AL app in the workspace",
    category: 'workspace',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Path to the AL app to activate"
        }
      },
      required: ["appPath"]
    }
  },

  // Field Management
  {
    name: "get-next-field-id",
    description: "Get the next available field ID for a table",
    category: 'field',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Path to the AL app"
        },
        tableId: {
          type: "number",
          description: "ID of the table"
        },
        isExtension: {
          type: "boolean",
          description: "Whether this is for a table extension"
        }
      },
      required: ["tableId"]
    }
  },
  {
    name: "get-next-enum-value-id",
    description: "Get the next available enum value ID",
    category: 'field',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Path to the AL app"
        },
        enumId: {
          type: "number",
          description: "ID of the enum"
        },
        isExtension: {
          type: "boolean",
          description: "Whether this is for an enum extension"
        }
      },
      required: ["enumId"]
    }
  },

  // Collision Detection
  {
    name: "check-collision",
    description: "Check if an object ID would cause a collision",
    category: 'collision',
    inputSchema: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          description: "Type of AL object"
        },
        id: {
          type: "number",
          description: "ID to check"
        },
        appPath: {
          type: "string",
          description: "Path to the AL app"
        }
      },
      required: ["objectType", "id"]
    }
  },
  {
    name: "check-range-overlaps",
    description: "Check for range overlaps between apps",
    category: 'collision',
    inputSchema: {
      type: "object",
      properties: {}
    }
  },

  // Polling Management
  {
    name: "start-polling",
    description: "Start the polling service for real-time updates",
    category: 'polling',
    inputSchema: {
      type: "object",
      properties: {
        interval: {
          type: "number",
          description: "Polling interval in milliseconds"
        },
        features: {
          type: "object",
          properties: {
            consumption: { type: "boolean" },
            collisions: { type: "boolean" },
            pools: { type: "boolean" }
          }
        }
      }
    }
  },
  {
    name: "stop-polling",
    description: "Stop the polling service",
    category: 'polling',
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get-polling-status",
    description: "Get the current polling status",
    category: 'polling',
    inputSchema: {
      type: "object",
      properties: {}
    }
  },

  // Interactive Assignment
  {
    name: "assign-ids",
    description: "Interactively assign object IDs with collision checking",
    category: 'assignment',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Path to the AL app"
        },
        objectType: {
          type: "string",
          description: "Type of AL object"
        },
        count: {
          type: "number",
          description: "Number of IDs to assign"
        },
        ranges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: { type: "number" },
              to: { type: "number" }
            }
          }
        },
        description: {
          type: "string",
          description: "Description of the assignment"
        },
        checkCollisions: {
          type: "boolean",
          description: "Check for collisions"
        },
        suggestAlternatives: {
          type: "boolean",
          description: "Suggest alternatives if collisions found"
        }
      },
      required: ["objectType"]
    }
  },
  {
    name: "batch-assign",
    description: "Batch assign IDs for multiple object types",
    category: 'assignment',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Path to the AL app"
        },
        assignments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              objectType: { type: "string" },
              count: { type: "number" },
              description: { type: "string" }
            }
          }
        }
      },
      required: ["assignments"]
    }
  },
  {
    name: "reserve-range",
    description: "Reserve a range of IDs for future use",
    category: 'assignment',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Path to the AL app"
        },
        objectType: {
          type: "string",
          description: "Type of AL object"
        },
        from: {
          type: "number",
          description: "Start of range"
        },
        to: {
          type: "number",
          description: "End of range"
        },
        description: {
          type: "string",
          description: "Description of the reservation"
        }
      },
      required: ["objectType", "from", "to"]
    }
  },
  {
    name: "get-suggestions",
    description: "Get ID assignment suggestions based on patterns",
    category: 'assignment',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Path to the AL app"
        },
        objectType: {
          type: "string",
          description: "Type of AL object"
        },
        pattern: {
          type: "string",
          description: "Pattern to match (e.g., '5xxx' for IDs starting with 5)"
        }
      },
      required: ["objectType"]
    }
  },
  {
    name: "get-assignment-history",
    description: "Get assignment history",
    category: 'assignment',
    inputSchema: {
      type: "object",
      properties: {
        appPath: {
          type: "string",
          description: "Filter by app"
        },
        objectType: {
          type: "string",
          description: "Filter by object type"
        },
        limit: {
          type: "number",
          description: "Maximum number of entries"
        }
      }
    }
  },

  // Configuration Management
  {
    name: "save-preferences",
    description: "Save user preferences",
    category: 'config',
    inputSchema: {
      type: "object",
      properties: {
        preferences: {
          type: "object",
          properties: {
            defaultRanges: { type: "array" },
            autoSync: { type: "boolean" },
            collisionChecking: { type: "boolean" },
            suggestAlternatives: { type: "boolean" },
            logLevel: { type: "string" }
          }
        }
      },
      required: ["preferences"]
    }
  },
  {
    name: "get-preferences",
    description: "Get current preferences",
    category: 'config',
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "export-config",
    description: "Export configuration to JSON",
    category: 'config',
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "import-config",
    description: "Import configuration from JSON",
    category: 'config',
    inputSchema: {
      type: "object",
      properties: {
        config: {
          type: "string",
          description: "JSON configuration to import"
        }
      },
      required: ["config"]
    }
  },
  {
    name: "get-statistics",
    description: "Get usage statistics",
    category: 'config',
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];