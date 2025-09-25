import { Logger } from '../utils/Logger';
import { BackendService } from '../backend/BackendService';
import { ALObjectType } from '../types/ALObjectType';
import { ALRanges } from '../types/ALRange';
import { DEFAULT_EXTENSION_RANGES, DEFAULT_BASE_OBJECT_RANGES, DEFAULT_BASE_ENUM_VALUE_RANGES } from '../constants/ranges';

export interface FieldInfo {
  tableId: number;
  fieldId: number;
  fieldName?: string;
  dataType?: string;
}

export interface EnumValueInfo {
  enumId: number;
  valueId: number;
  valueName?: string;
}

export class FieldManager {
  private static instance: FieldManager;
  private logger: Logger;
  private backendService: BackendService;

  private constructor() {
    this.logger = Logger.getInstance();
    this.backendService = new BackendService();
  }

  static getInstance(): FieldManager {
    if (!this.instance) {
      this.instance = new FieldManager();
    }
    return this.instance;
  }

  /**
   * Get next available field ID for a table without reserving it.
   * This method queries the backend for the next available field ID but does not commit/reserve it.
   *
   * @param appId - The application ID
   * @param authKey - Authorization key for the app
   * @param tableId - The ID of the table for which to get a field ID
   * @param ranges - Optional ID ranges to search within (defaults to extension ranges 1..4999)
   * @returns The next available field ID, or 0 if none available
   *
   * @example
   * ```typescript
   * const fieldId = await fieldManager.getNextFieldId(
   *   'myApp',
   *   'authKey123',
   *   50100,
   *   [{ from: 1, to: 100 }]
   * );
   * console.log(`Next available field ID: ${fieldId}`);
   * ```
   */
  async getNextFieldId(
    appId: string,
    authKey: string,
    tableId: number,
    ranges: ALRanges = DEFAULT_EXTENSION_RANGES
  ): Promise<number> {
    this.logger.verbose('Getting next field ID', { appId, tableId, ranges });

    try {
      // Field IDs are handled as special object types
      const objectType = `table_${tableId}` as ALObjectType;

      const request = {
        appId,
        type: objectType,
        ranges,
        authKey,
        perRange: false
      };

      const result = await this.backendService.getNext(request);

      if (result && result.available) {
        // Handle both single ID and array of IDs
        const fieldId = Array.isArray(result.id) ? result.id[0] : result.id;
        
        this.logger.info('Next field ID obtained', {
          tableId,
          fieldId,
          ranges
        });
        return fieldId;
      }

      // No available ID in range
      this.logger.error('No available field ID', { tableId, ranges });
      return 0;
    } catch (error) {
      this.logger.error('Failed to get next field ID', error);
      return 0;
    }
  }

  /**
   * Get next available enum value ID without reserving it.
   * This method queries the backend for the next available enum value ID but does not commit/reserve it.
   *
   * @param appId - The application ID
   * @param authKey - Authorization key for the app
   * @param enumId - The ID of the enum for which to get a value ID
   * @param ranges - Optional ID ranges to search within (defaults to extension ranges)
   * @returns The next available enum value ID, or -1 if none available
   *
   * @example
   * ```typescript
   * const valueId = await fieldManager.getNextEnumValueId(
   *   'myApp',
   *   'authKey123',
   *   50200,
   *   [{ from: 0, to: 100 }]
   * );
   * console.log(`Next available enum value ID: ${valueId}`);
   * ```
   */
  async getNextEnumValueId(
    appId: string,
    authKey: string,
    enumId: number,
    ranges: ALRanges = DEFAULT_EXTENSION_RANGES
  ): Promise<number> {
    this.logger.verbose('Getting next enum value ID', { appId, enumId, ranges });

    try {
      // Enum values are handled as special object types
      const objectType = `enum_${enumId}` as ALObjectType;

      const request = {
        appId,
        type: objectType,
        ranges,
        authKey,
        perRange: false
      };

      const result = await this.backendService.getNext(request);

      if (result && result.available) {
        // Handle both single ID and array of IDs
        const valueId = Array.isArray(result.id) ? result.id[0] : result.id;
        
        this.logger.info('Next enum value ID obtained', {
          enumId,
          valueId,
          ranges
        });
        return valueId;
      }

      // No available ID in range
      this.logger.error('No available enum value ID', { enumId, ranges });
      return -1;
    } catch (error) {
      this.logger.error('Failed to get next enum value ID', error);
      return -1;
    }
  }

  /**
   * Synchronizes field IDs with the backend service for a specific table.
   * 
   * @param appId - The application identifier
   * @param authKey - Authentication key for the request
   * @param tableId - The ID of the table containing the fields
   * @param fieldIds - Array of field IDs to synchronize
   * @param merge - Whether to merge with existing data or overwrite (defaults to true)
   * @returns Promise that resolves to true if synchronization was successful, false otherwise
   * 
   * @example
   * ```typescript
   * const success = await fieldManager.syncFieldIds(
   *   'myApp',
   *   'authKey123',
   *   42,
   *   [1, 2, 3, 4],
   *   true
   * );
   * ```
   */
  async syncFieldIds(
    appId: string,
    authKey: string,
    tableId: number,
    fieldIds: number[],
    mode: 'merge' | 'replace' = 'merge'  // Default to merge mode to avoid overwriting
  ): Promise<boolean> {
    this.logger.verbose('Syncing field IDs', { appId, tableId, count: fieldIds.length, mode });

    try {
      const objectType = `table_${tableId}` as ALObjectType;

      // Create consumption info for fields
      const consumptionInfo = {
        [objectType]: fieldIds
      };

      const result = await this.backendService.syncIds({
        appId,
        authKey,
        ids: consumptionInfo,
        mode  // Use new mode parameter
      });

      if (result) {
        this.logger.info('Field IDs synced successfully', {
          tableId,
          count: fieldIds.length,
          mode
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to sync field IDs', error);
      return false;
    }
  }

  /**
   * Synchronizes enum value IDs with the backend service for a specific enum.
   *
   * @param appId - The application identifier
   * @param authKey - Authentication key for the request
   * @param enumId - The ID of the enum containing the values
   * @param valueIds - Array of enum value IDs to synchronize
   * @param merge - Whether to merge with existing data or overwrite (defaults to true)
   * @returns Promise that resolves to true if synchronization was successful, false otherwise
   *
   * @example
   * ```typescript
   * const success = await fieldManager.syncEnumValueIds(
   *   'myApp',
   *   'authKey123',
   *   100,
   *   [0, 1, 2, 10],
   *   true
   * );
   * ```
   */
  async syncEnumValueIds(
    appId: string,
    authKey: string,
    enumId: number,
    valueIds: number[],
    mode: 'merge' | 'replace' = 'merge'  // Default to merge mode to avoid overwriting
  ): Promise<boolean> {
    this.logger.verbose('Syncing enum value IDs', { appId, enumId, count: valueIds.length, mode });

    try {
      const objectType = `enum_${enumId}` as ALObjectType;

      // Create consumption info for enum values
      const consumptionInfo = {
        [objectType]: valueIds
      };

      const result = await this.backendService.syncIds({
        appId,
        authKey,
        ids: consumptionInfo,
        mode  // Use new mode parameter
      });

      if (result) {
        this.logger.info('Enum value IDs synced successfully', {
          enumId,
          count: valueIds.length,
          mode
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to sync enum value IDs', error);
      return false;
    }
  }

  /**
   * Get all consumed field IDs for a table.
   *
   * @param appId - The application ID
   * @param authKey - Authorization key for the app
   * @param tableId - The ID of the table
   * @returns Array of consumed field IDs, empty array if none or on error
   *
   * @example
   * ```typescript
   * const consumedIds = await fieldManager.getConsumedFieldIds(
   *   'myApp',
   *   'authKey123',
   *   50100
   * );
   * console.log('Consumed field IDs:', consumedIds);
   * ```
   */
  async getConsumedFieldIds(
    appId: string,
    authKey: string,
    tableId: number
  ): Promise<number[]> {
    this.logger.verbose('Getting consumed field IDs', { appId, tableId });

    try {
      const objectType = `table_${tableId}` as ALObjectType;
      const request = {
        appId,
        authKey
      };
      const consumptionInfo = await this.backendService.getConsumption(request);

      if (consumptionInfo) {
        const consumption = consumptionInfo[objectType] || [];
        this.logger.info('Retrieved consumed field IDs', {
          tableId,
          count: consumption.length
        });
        return consumption;
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to get consumed field IDs', error);
      return [];
    }
  }

  /**
   * Get all consumed enum value IDs for an enum.
   *
   * @param appId - The application ID
   * @param authKey - Authorization key for the app
   * @param enumId - The ID of the enum
   * @returns Array of consumed enum value IDs, empty array if none or on error
   *
   * @example
   * ```typescript
   * const consumedIds = await fieldManager.getConsumedEnumValueIds(
   *   'myApp',
   *   'authKey123',
   *   50200
   * );
   * console.log('Consumed enum value IDs:', consumedIds);
   * ```
   */
  async getConsumedEnumValueIds(
    appId: string,
    authKey: string,
    enumId: number
  ): Promise<number[]> {
    this.logger.verbose('Getting consumed enum value IDs', { appId, enumId });

    try {
      const objectType = `enum_${enumId}` as ALObjectType;
      const request = {
        appId,
        authKey
      };
      const consumptionInfo = await this.backendService.getConsumption(request);

      if (consumptionInfo) {
        const consumption = consumptionInfo[objectType] || [];
        this.logger.info('Retrieved consumed enum value IDs', {
          enumId,
          count: consumption.length
        });
        return consumption;
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to get consumed enum value IDs', error);
      return [];
    }
  }

  /**
   * Check if a field ID is available for use.
   *
   * @param appId - The application ID
   * @param authKey - Authorization key for the app
   * @param tableId - The ID of the table
   * @param fieldId - The field ID to check
   * @returns True if the field ID is available, false if already consumed
   *
   * @example
   * ```typescript
   * const isAvailable = await fieldManager.isFieldIdAvailable(
   *   'myApp',
   *   'authKey123',
   *   50100,
   *   10
   * );
   * ```
   */
  async isFieldIdAvailable(
    appId: string,
    authKey: string,
    tableId: number,
    fieldId: number
  ): Promise<boolean> {
    const consumed = await this.getConsumedFieldIds(appId, authKey, tableId);
    return !consumed.includes(fieldId);
  }

  /**
   * Check if an enum value ID is available for use.
   *
   * @param appId - The application ID
   * @param authKey - Authorization key for the app
   * @param enumId - The ID of the enum
   * @param valueId - The value ID to check
   * @returns True if the enum value ID is available, false if already consumed
   *
   * @example
   * ```typescript
   * const isAvailable = await fieldManager.isEnumValueIdAvailable(
   *   'myApp',
   *   'authKey123',
   *   50200,
   *   1
   * );
   * ```
   */
  async isEnumValueIdAvailable(
    appId: string,
    authKey: string,
    enumId: number,
    valueId: number
  ): Promise<boolean> {
    const consumed = await this.getConsumedEnumValueIds(appId, authKey, enumId);
    return !consumed.includes(valueId);
  }

  /**
   * Reserve a specific field ID for a table.
   * This method attempts to reserve/commit a specific field ID for permanent use.
   *
   * @param appId - The application ID
   * @param authKey - Authorization key for the app
   * @param tableId - The ID of the table for which to reserve the field ID
   * @param fieldId - The specific field ID to reserve
   * @param ranges - Optional ID ranges to validate against (defaults to extension ranges)
   * @returns True if the field ID was successfully reserved, false otherwise
   *
   * @remarks
   * This method uses the backend's getNext API with the 'require' parameter to request
   * a specific ID. If the ID is already taken, the reservation will fail.
   *
   * @example
   * ```typescript
   * const success = await fieldManager.reserveFieldId(
   *   'myApp',
   *   'authKey123',
   *   50100,
   *   10
   * );
   * if (success) {
   *   console.log('Field ID 10 reserved successfully');
   * }
   * ```
   */
  async reserveFieldId(
    appId: string,
    authKey: string,
    tableId: number,
    fieldId: number,
    ranges: ALRanges = DEFAULT_EXTENSION_RANGES
  ): Promise<boolean> {
    try {
      // Field IDs are handled as special object types
      const objectType = `table_${tableId}` as ALObjectType;

      const response = await this.backendService.getNext({
        appId,
        type: objectType,
        ranges,
        authKey,
        perRange: false,
        require: fieldId
      }, true);  // Commit = true to reserve

      if (response && response.available) {
        const reservedId = Array.isArray(response.id) ? response.id[0] : response.id;
        return reservedId === fieldId;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to reserve field ID ${fieldId} for table ${tableId}`, error);
      return false;
    }
  }

  /**
   * Reserve a specific enum value ID for an enum.
   * This method attempts to reserve/commit a specific enum value ID for permanent use.
   *
   * @param appId - The application ID
   * @param authKey - Authorization key for the app
   * @param enumId - The ID of the enum for which to reserve the value ID
   * @param valueId - The specific value ID to reserve
   * @param ranges - Optional ID ranges to validate against (defaults to extension ranges)
   * @returns True if the enum value ID was successfully reserved, false otherwise
   *
   * @remarks
   * This method uses the backend's getNext API with the 'require' parameter to request
   * a specific ID. If the ID is already taken, the reservation will fail.
   *
   * @example
   * ```typescript
   * const success = await fieldManager.reserveEnumValueId(
   *   'myApp',
   *   'authKey123',
   *   50200,
   *   1
   * );
   * if (success) {
   *   console.log('Enum value ID 1 reserved successfully');
   * }
   * ```
   */
  async reserveEnumValueId(
    appId: string,
    authKey: string,
    enumId: number,
    valueId: number,
    ranges: ALRanges = DEFAULT_EXTENSION_RANGES
  ): Promise<boolean> {
    try {
      // Enum value IDs are handled as special object types
      const objectType = `enum_${enumId}` as ALObjectType;

      const response = await this.backendService.getNext({
        appId,
        type: objectType,
        ranges,
        authKey,
        perRange: false,
        require: valueId
      }, true);  // Commit = true to reserve

      if (response && response.available) {
        const reservedId = Array.isArray(response.id) ? response.id[0] : response.id;
        return reservedId === valueId;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to reserve enum value ${valueId} for enum ${enumId}`, error);
      return false;
    }
  }

  /**
   * Suggest field ID range based on context
   * Note: These are just suggestions - actual ranges should come from app configuration
   */
  suggestFieldIdRange(isExtension: boolean, isSystemTable: boolean): { from: number; to: number } {
    if (isExtension) {
      // Extension fields typically use 50000+ range
      return DEFAULT_EXTENSION_RANGES[0];
    } else if (isSystemTable) {
      // System table fields typically use low range (subset of base range)
      return { from: 1, to: 9999 };
    } else {
      // Custom table fields can use broader range
      return DEFAULT_BASE_OBJECT_RANGES[0];
    }
  }

  /**
   * Suggest enum value ID range based on context
   * Note: These are just suggestions - actual ranges should come from app configuration
   */
  suggestEnumValueIdRange(isExtension: boolean): { from: number; to: number } {
    if (isExtension) {
      // Extension enum values typically use 50000+ range
      return DEFAULT_EXTENSION_RANGES[0];
    } else {
      // Base enum values typically start from 0
      return DEFAULT_BASE_ENUM_VALUE_RANGES[0];
    }
  }
}