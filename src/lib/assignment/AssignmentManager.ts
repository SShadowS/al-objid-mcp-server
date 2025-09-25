import { Logger } from '../utils/Logger';
import { BackendService } from '../backend/BackendService';
import { WorkspaceManager, WorkspaceApp } from '../workspace/WorkspaceManager';
import { CollisionDetector } from '../collision/CollisionDetector';
import { ALObjectType } from '../types/ALObjectType';
import { DEFAULT_EXTENSION_RANGES } from '../constants/ranges';
import { EventEmitter } from 'events';

export interface AssignmentOptions {
  objectType: ALObjectType;
  count?: number;
  ranges?: Array<{ from: number; to: number }>;
  prefix?: string;
  suffix?: string;
  description?: string;
  checkCollisions?: boolean;
  suggestAlternatives?: boolean;
}

export interface AssignmentResult {
  success: boolean;
  ids: number[];
  objectType: ALObjectType;
  app: WorkspaceApp;
  collisions?: Array<{
    id: number;
    conflictingApps: string[];
  }>;
  alternatives?: number[];
  message?: string;
}

export interface AssignmentHistory {
  timestamp: number;
  app: WorkspaceApp;
  objectType: ALObjectType;
  ids: number[];
  description?: string;
  user?: string;
}

export class AssignmentManager extends EventEmitter {
  private static instance: AssignmentManager;
  private logger: Logger;
  private backendService: BackendService;
  private workspaceManager: WorkspaceManager;
  private collisionDetector: CollisionDetector;
  private assignmentHistory: AssignmentHistory[] = [];
  private pendingAssignments: Map<string, number[]> = new Map();

  private constructor() {
    super();
    this.logger = Logger.getInstance();
    this.backendService = new BackendService();
    this.workspaceManager = WorkspaceManager.getInstance();
    this.collisionDetector = CollisionDetector.getInstance();
  }

  static getInstance(): AssignmentManager {
    if (!this.instance) {
      this.instance = new AssignmentManager();
    }
    return this.instance;
  }

  /**
   * Interactively assign object IDs
   */
  async assignIds(
    app: WorkspaceApp,
    options: AssignmentOptions
  ): Promise<AssignmentResult> {
    this.logger.info('Starting interactive ID assignment', {
      app: app.name,
      objectType: options.objectType,
      count: options.count
    });

    if (!app.isAuthorized || !app.authKey) {
      return {
        success: false,
        ids: [],
        objectType: options.objectType,
        app,
        message: 'App is not authorized. Please authorize first.'
      };
    }

    const ranges = options.ranges || app.ranges || DEFAULT_EXTENSION_RANGES;
    const count = options.count || 1;
    const assignedIds: number[] = [];
    const collisions: Array<{ id: number; conflictingApps: string[] }> = [];

    try {
      for (let i = 0; i < count; i++) {
        const request = {
          appId: app.appId,
          type: options.objectType,
          ranges,
          authKey: app.authKey,
          perRange: false
        };

        const result = await this.backendService.getNext(request);

        if (!result || !result.available) {
          this.logger.info('No available IDs in specified ranges');
          break;
        }

        // Handle both single ID and array of IDs
        const id = Array.isArray(result.id) ? result.id[0] : result.id;

        // Check for collisions if requested
        if (options.checkCollisions) {
          const collision = await this.collisionDetector.checkCollision(
            options.objectType,
            id,
            app
          );

          if (collision) {
            collisions.push({
              id,
              conflictingApps: collision.apps.map(a => a.appName)
            });

            // Skip this ID if collision detected
            if (!options.suggestAlternatives) {
              continue;
            }
          }
        }

        assignedIds.push(id);
      }

      // If we have assigned IDs, sync them
      if (assignedIds.length > 0) {
        const syncResult = await this.backendService.syncIds({
          appId: app.appId,
          authKey: app.authKey,
          ids: {
            [options.objectType]: assignedIds
          }
        });

        if (syncResult) {
          // Record in history
          this.recordAssignment({
            timestamp: Date.now(),
            app,
            objectType: options.objectType,
            ids: assignedIds,
            description: options.description
          });

          // Track pending assignments for the session
          const key = `${app.appId}-${options.objectType}`;
          const pending = this.pendingAssignments.get(key) || [];
          this.pendingAssignments.set(key, [...pending, ...assignedIds]);

          this.emit('assignment', {
            app,
            objectType: options.objectType,
            ids: assignedIds
          });
        }
      }

      // Suggest alternatives if collisions found
      let alternatives: number[] = [];
      if (collisions.length > 0 && options.suggestAlternatives) {
        alternatives = await this.suggestAlternatives(
          app,
          options.objectType,
          ranges,
          collisions.map(c => c.id),
          5 // Suggest up to 5 alternatives
        );
      }

      return {
        success: assignedIds.length > 0,
        ids: assignedIds,
        objectType: options.objectType,
        app,
        collisions: collisions.length > 0 ? collisions : undefined,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
        message: this.generateAssignmentMessage(assignedIds, collisions, alternatives)
      };

    } catch (error) {
      this.logger.error('Assignment failed', error);
      return {
        success: false,
        ids: [],
        objectType: options.objectType,
        app,
        message: `Assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Suggest alternative IDs that don't collide
   */
  private async suggestAlternatives(
    app: WorkspaceApp,
    objectType: ALObjectType,
    ranges: Array<{ from: number; to: number }>,
    excludeIds: number[],
    maxSuggestions: number
  ): Promise<number[]> {
    const suggestions: number[] = [];
    const maxAttempts = maxSuggestions * 3; // Try more to account for collisions

    for (let i = 0; i < maxAttempts && suggestions.length < maxSuggestions; i++) {
      const request = {
        appId: app.appId,
        type: objectType,
        ranges,
        authKey: app.authKey || '',
        perRange: false
      };

      const result = await this.backendService.getNext(request);

      if (!result || !result.available) {
        continue;
      }

      // Handle both single ID and array of IDs
      const id = Array.isArray(result.id) ? result.id[0] : result.id;

      if (excludeIds.includes(id)) {
        continue;
      }

      // Check for collision
      const collision = await this.collisionDetector.checkCollision(
        objectType,
        id,
        app
      );

      if (!collision) {
        suggestions.push(id);
      }
    }

    return suggestions;
  }

  /**
   * Batch assign IDs for multiple object types
   */
  async batchAssign(
    app: WorkspaceApp,
    assignments: Array<{
      objectType: ALObjectType;
      count: number;
      description?: string;
    }>
  ): Promise<AssignmentResult[]> {
    this.logger.info('Starting batch assignment', {
      app: app.name,
      types: assignments.length
    });

    const results: AssignmentResult[] = [];

    for (const assignment of assignments) {
      const result = await this.assignIds(app, {
        objectType: assignment.objectType,
        count: assignment.count,
        description: assignment.description,
        checkCollisions: true,
        suggestAlternatives: true
      });

      results.push(result);

      // Add a small delay between assignments to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Reserve a range of IDs for future use
   */
  async reserveRange(
    app: WorkspaceApp,
    objectType: ALObjectType,
    from: number,
    to: number,
    description?: string
  ): Promise<boolean> {
    this.logger.info('Reserving ID range', {
      app: app.name,
      objectType,
      from,
      to
    });

    if (!app.isAuthorized || !app.authKey) {
      this.logger.error('App not authorized for range reservation');
      return false;
    }

    try {
      // Generate all IDs in the range
      const ids: number[] = [];
      for (let id = from; id <= to; id++) {
        ids.push(id);
      }

      // Sync the entire range
      const result = await this.backendService.syncIds({
        appId: app.appId,
        authKey: app.authKey,
        ids: {
          [objectType]: ids
        }
      });

      if (result) {
        this.recordAssignment({
          timestamp: Date.now(),
          app,
          objectType,
          ids,
          description: description || `Reserved range ${from}-${to}`
        });

        this.emit('rangeReserved', {
          app,
          objectType,
          from,
          to,
          count: ids.length
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to reserve range', error);
      return false;
    }
  }

  /**
   * Get assignment suggestions based on patterns
   */
  async getSuggestions(
    app: WorkspaceApp,
    objectType: ALObjectType,
    pattern?: string
  ): Promise<{
    nextAvailable: number;
    suggestedRanges: Array<{ from: number; to: number; available: number }>;
    recentlyUsed: number[];
    patterns: Array<{ pattern: string; example: number }>;
  }> {
    this.logger.verbose('Getting assignment suggestions', {
      app: app.name,
      objectType
    });

    const ranges = app.ranges || DEFAULT_EXTENSION_RANGES;

    // Get next available
    const nextRequest = {
      appId: app.appId,
      type: objectType,
      ranges,
      authKey: app.authKey || '',
      perRange: false
    };
    const nextResult = await this.backendService.getNext(nextRequest);

    // Get consumption for pattern analysis
    const consumptionRequest = {
      appId: app.appId,
      authKey: app.authKey || ''
    };
    const consumptionInfo = await this.backendService.getConsumption(consumptionRequest);
    const consumption = consumptionInfo ? (consumptionInfo[objectType] || []) : [];

    // Analyze ranges for availability
    const suggestedRanges = await this.analyzeRangeAvailability(
      app,
      objectType,
      ranges,
      consumption
    );

    // Get recently used from history
    const recentlyUsed = this.getRecentlyUsedIds(app, objectType, 10);

    // Suggest patterns based on existing usage
    const patterns = this.analyzePatterns(consumption, pattern);

    // Handle both single ID and array of IDs
    const nextId = nextResult ? (Array.isArray(nextResult.id) ? nextResult.id[0] : nextResult.id) : 0;

    return {
      nextAvailable: nextId,
      suggestedRanges,
      recentlyUsed,
      patterns
    };
  }

  /**
   * Analyze range availability
   */
  private async analyzeRangeAvailability(
    app: WorkspaceApp,
    objectType: ALObjectType,
    ranges: Array<{ from: number; to: number }>,
    consumption: number[]
  ): Promise<Array<{ from: number; to: number; available: number }>> {
    const result: Array<{ from: number; to: number; available: number }> = [];

    for (const range of ranges) {
      const usedInRange = consumption.filter(id => id >= range.from && id <= range.to);
      const totalInRange = range.to - range.from + 1;
      const available = totalInRange - usedInRange.length;

      if (available > 0) {
        // Find contiguous available sub-ranges
        const subRanges = this.findContiguousRanges(range, usedInRange);
        result.push(...subRanges);
      }
    }

    // Sort by available count descending
    return result.sort((a, b) => b.available - a.available).slice(0, 5);
  }

  /**
   * Find contiguous available ranges
   */
  private findContiguousRanges(
    range: { from: number; to: number },
    used: number[]
  ): Array<{ from: number; to: number; available: number }> {
    const sorted = [...used].sort((a, b) => a - b);
    const ranges: Array<{ from: number; to: number; available: number }> = [];

    let start = range.from;
    for (const id of sorted) {
      if (id > start) {
        const available = id - start;
        if (available >= 10) { // Only suggest ranges with at least 10 IDs
          ranges.push({ from: start, to: id - 1, available });
        }
      }
      start = id + 1;
    }

    // Check end of range
    if (start <= range.to) {
      const available = range.to - start + 1;
      if (available >= 10) {
        ranges.push({ from: start, to: range.to, available });
      }
    }

    return ranges;
  }

  /**
   * Analyze patterns in ID usage
   */
  private analyzePatterns(
    consumption: number[],
    pattern?: string
  ): Array<{ pattern: string; example: number }> {
    const patterns: Array<{ pattern: string; example: number }> = [];

    if (consumption.length === 0) {
      return patterns;
    }

    // Check for sequential patterns
    const sequential = this.findSequentialPattern(consumption);
    if (sequential) {
      patterns.push({
        pattern: 'Sequential',
        example: sequential
      });
    }

    // Check for round number patterns (multiples of 10, 100, 1000)
    const roundPatterns = [
      { multiple: 1000, name: 'Thousands' },
      { multiple: 100, name: 'Hundreds' },
      { multiple: 10, name: 'Tens' }
    ];

    for (const { multiple, name } of roundPatterns) {
      const roundIds = consumption.filter(id => id % multiple === 0);
      if (roundIds.length > consumption.length * 0.3) { // At least 30% match
        const nextRound = Math.ceil((Math.max(...consumption) + 1) / multiple) * multiple;
        patterns.push({
          pattern: name,
          example: nextRound
        });
        break;
      }
    }

    // Custom pattern matching if provided
    if (pattern) {
      // Simple pattern like "5xxx" means IDs starting with 5
      if (pattern.includes('x')) {
        const prefix = pattern.replace(/x+$/, '');
        const prefixNum = parseInt(prefix);
        if (!isNaN(prefixNum)) {
          const multiplier = Math.pow(10, pattern.match(/x+$/)?.[0].length || 0);
          const nextInPattern = prefixNum * multiplier + (consumption.filter(id =>
            Math.floor(id / multiplier) === prefixNum
          ).length + 1);
          patterns.push({
            pattern: `Custom (${pattern})`,
            example: nextInPattern
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Find sequential pattern in consumption
   */
  private findSequentialPattern(consumption: number[]): number | null {
    if (consumption.length < 2) {
      return null;
    }

    const sorted = [...consumption].sort((a, b) => a - b);
    const gaps: number[] = [];

    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i] - sorted[i - 1]);
    }

    // Check if gaps are consistent (allowing some variation)
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const consistent = gaps.filter(g => Math.abs(g - avgGap) <= 1).length > gaps.length * 0.7;

    if (consistent) {
      return sorted[sorted.length - 1] + Math.round(avgGap);
    }

    return null;
  }

  /**
   * Record assignment in history
   */
  private recordAssignment(assignment: AssignmentHistory): void {
    this.assignmentHistory.push(assignment);

    // Keep only last 100 assignments
    if (this.assignmentHistory.length > 100) {
      this.assignmentHistory = this.assignmentHistory.slice(-100);
    }
  }

  /**
   * Get recently used IDs
   */
  private getRecentlyUsedIds(
    app: WorkspaceApp,
    objectType: ALObjectType,
    limit: number
  ): number[] {
    const recent = this.assignmentHistory
      .filter(h => h.app.appId === app.appId && h.objectType === objectType)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .flatMap(h => h.ids);

    return [...new Set(recent)]; // Remove duplicates
  }

  /**
   * Generate user-friendly assignment message
   */
  private generateAssignmentMessage(
    assignedIds: number[],
    collisions: Array<{ id: number; conflictingApps: string[] }>,
    alternatives: number[]
  ): string {
    const parts: string[] = [];

    if (assignedIds.length > 0) {
      parts.push(`Assigned IDs: ${assignedIds.join(', ')}`);
    }

    if (collisions.length > 0) {
      const collisionMsg = collisions.map(c =>
        `ID ${c.id} conflicts with ${c.conflictingApps.join(', ')}`
      ).join('; ');
      parts.push(`Collisions detected: ${collisionMsg}`);
    }

    if (alternatives.length > 0) {
      parts.push(`Alternative IDs available: ${alternatives.join(', ')}`);
    }

    if (assignedIds.length === 0 && collisions.length === 0) {
      parts.push('No IDs available in the specified ranges');
    }

    return parts.join('. ');
  }

  /**
   * Get assignment history
   */
  getHistory(
    app?: WorkspaceApp,
    objectType?: ALObjectType,
    limit?: number
  ): AssignmentHistory[] {
    let history = [...this.assignmentHistory];

    if (app) {
      history = history.filter(h => h.app.appId === app.appId);
    }

    if (objectType) {
      history = history.filter(h => h.objectType === objectType);
    }

    history.sort((a, b) => b.timestamp - a.timestamp);

    if (limit) {
      history = history.slice(0, limit);
    }

    return history;
  }

  /**
   * Get pending assignments for current session
   */
  getPendingAssignments(app?: WorkspaceApp): Map<string, number[]> {
    if (!app) {
      return new Map(this.pendingAssignments);
    }

    const filtered = new Map<string, number[]>();
    for (const [key, ids] of this.pendingAssignments) {
      if (key.startsWith(app.appId)) {
        filtered.set(key, ids);
      }
    }
    return filtered;
  }

  /**
   * Clear pending assignments
   */
  clearPendingAssignments(app?: WorkspaceApp): void {
    if (!app) {
      this.pendingAssignments.clear();
    } else {
      for (const key of this.pendingAssignments.keys()) {
        if (key.startsWith(app.appId)) {
          this.pendingAssignments.delete(key);
        }
      }
    }
  }

  /**
   * Export assignment history
   */
  exportHistory(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.assignmentHistory, null, 2);
    }

    // CSV format
    const headers = ['Timestamp', 'App', 'Object Type', 'IDs', 'Description'];
    const rows = this.assignmentHistory.map(h => [
      new Date(h.timestamp).toISOString(),
      h.app.name,
      h.objectType,
      h.ids.join(';'),
      h.description || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(','))
    ].join('\n');
  }
}