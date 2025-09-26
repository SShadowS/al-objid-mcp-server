/**
 * Workspace utilities for AL file handling
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { ALObjectType } from '../types/common/base';

/**
 * AL Object information
 */
export interface ALObject {
  type: ALObjectType;
  id: number;
  name: string;
  file: string;
  line?: number;
}

/**
 * Workspace utilities
 */
export class WorkspaceUtils {
  /**
   * Find all AL files in workspace
   */
  static async findALFiles(
    appPath: string,
    include: string[] = ['**/*.al'],
    exclude: string[] = ['**/.alpackages/**', '**/.snapshots/**']
  ): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of include) {
      const matches = await glob(pattern, {
        cwd: appPath,
        ignore: exclude,
        absolute: false
      });
      files.push(...matches);
    }

    return files;
  }

  /**
   * Parse AL file for objects
   */
  static async parseALFile(filePath: string): Promise<ALObject[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parseALContent(content, filePath);
  }

  /**
   * Parse AL content for objects
   */
  static parseALContent(content: string, filePath: string): ALObject[] {
    const objects: ALObject[] = [];
    const lines = content.split('\n');

    // Regex for AL object declarations
    const objectRegex = /^\s*(table|tableextension|page|pageextension|report|reportextension|codeunit|xmlport|enum|enumextension|query|permissionset|permissionsetextension|profile|controladdin)\s+(\d+)\s+"?([^"{\n]+)"?/i;

    lines.forEach((line, index) => {
      const match = line.match(objectRegex);
      if (match) {
        const type = match[1].toLowerCase() as ALObjectType;
        const id = parseInt(match[2]);
        const name = match[3].trim().replace(/^"|"$/g, '');

        objects.push({
          type,
          id,
          name,
          file: filePath,
          line: index + 1
        });
      }
    });

    return objects;
  }

  /**
   * Scan workspace for AL objects
   */
  static async scanWorkspace(
    appPath: string,
    options?: {
      include?: string[];
      exclude?: string[];
      objectTypes?: ALObjectType[];
    }
  ): Promise<ALObject[]> {
    const files = await this.findALFiles(
      appPath,
      options?.include,
      options?.exclude
    );

    const allObjects: ALObject[] = [];

    for (const file of files) {
      const filePath = path.join(appPath, file);
      const objects = await this.parseALFile(filePath);

      // Filter by object types if specified
      const filtered = options?.objectTypes
        ? objects.filter(obj => options.objectTypes!.includes(obj.type))
        : objects;

      allObjects.push(...filtered);
    }

    return allObjects;
  }

  /**
   * Group objects by type
   */
  static groupObjectsByType(objects: ALObject[]): Record<string, ALObject[]> {
    const grouped: Record<string, ALObject[]> = {};

    for (const obj of objects) {
      if (!grouped[obj.type]) {
        grouped[obj.type] = [];
      }
      grouped[obj.type].push(obj);
    }

    return grouped;
  }

  /**
   * Find ID collisions
   */
  static findCollisions(objects: ALObject[]): Array<{
    type: string;
    id: number;
    objects: ALObject[];
  }> {
    const collisions: Array<{
      type: string;
      id: number;
      objects: ALObject[];
    }> = [];

    const grouped = this.groupObjectsByType(objects);

    for (const [type, typeObjects] of Object.entries(grouped)) {
      const idMap = new Map<number, ALObject[]>();

      for (const obj of typeObjects) {
        if (!idMap.has(obj.id)) {
          idMap.set(obj.id, []);
        }
        idMap.get(obj.id)!.push(obj);
      }

      // Find collisions (multiple objects with same ID)
      for (const [id, objs] of idMap.entries()) {
        if (objs.length > 1) {
          collisions.push({ type, id, objects: objs });
        }
      }
    }

    return collisions;
  }

  /**
   * Get consumed ID ranges
   */
  static getConsumedRanges(objects: ALObject[]): Record<string, Array<{ from: number; to: number }>> {
    const ranges: Record<string, Array<{ from: number; to: number }>> = {};
    const grouped = this.groupObjectsByType(objects);

    for (const [type, typeObjects] of Object.entries(grouped)) {
      const ids = typeObjects.map(obj => obj.id).sort((a, b) => a - b);
      if (ids.length === 0) continue;

      const typeRanges: Array<{ from: number; to: number }> = [];
      let rangeStart = ids[0];
      let rangeEnd = ids[0];

      for (let i = 1; i < ids.length; i++) {
        if (ids[i] === rangeEnd + 1) {
          // Continuous range
          rangeEnd = ids[i];
        } else {
          // Break in range
          typeRanges.push({ from: rangeStart, to: rangeEnd });
          rangeStart = ids[i];
          rangeEnd = ids[i];
        }
      }

      // Add last range
      typeRanges.push({ from: rangeStart, to: rangeEnd });
      ranges[type] = typeRanges;
    }

    return ranges;
  }

  /**
   * Normalize app path to workspace directory
   * Accepts either a directory path or path to app.json file
   */
  static normalizeAppPath(appPath: string): string {
    if (path.basename(appPath) === 'app.json') {
      return path.dirname(appPath);
    }
    return appPath;
  }

  /**
   * Check if app path exists and is valid
   */
  static async validateAppPath(appPath: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      const stats = await fs.stat(appPath);
      let workspacePath = appPath;

      // If path points to app.json file, use its directory
      if (!stats.isDirectory()) {
        if (path.basename(appPath) === 'app.json') {
          workspacePath = path.dirname(appPath);
        } else {
          return { valid: false, reason: 'Path is not a directory or app.json file' };
        }
      }

      // Check for app.json in the workspace directory
      const appJsonPath = path.join(workspacePath, 'app.json');
      try {
        await fs.stat(appJsonPath);
      } catch {
        return { valid: false, reason: 'app.json not found' };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: `Path does not exist: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Scan for AL objects (alias for scanWorkspace)
   */
  static async scanALObjects(appPath: string): Promise<ALObject[]> {
    return this.scanWorkspace(appPath);
  }
}