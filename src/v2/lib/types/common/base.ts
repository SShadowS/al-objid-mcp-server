/**
 * Base types for AL Object ID Ninja MCP Server V2
 */

/**
 * AL Object Types as string literals (matching VS Code extension)
 */
export type ALObjectType =
  | 'table'
  | 'tableextension'
  | 'page'
  | 'pageextension'
  | 'report'
  | 'reportextension'
  | 'codeunit'
  | 'xmlport'
  | 'enum'
  | 'enumextension'
  | 'query'
  | 'permissionset'
  | 'permissionsetextension'
  | 'profile'
  | 'controladdin'
  | 'dotnetassembly'
  | 'dotnetinterop'
  | 'dotnetpackage';

/**
 * AL Object Types enum for backward compatibility
 */
export enum ALObjectTypeEnum {
  Table = 'table',
  TableExtension = 'tableextension',
  Page = 'page',
  PageExtension = 'pageextension',
  Report = 'report',
  ReportExtension = 'reportextension',
  Codeunit = 'codeunit',
  XmlPort = 'xmlport',
  Enum = 'enum',
  EnumExtension = 'enumextension',
  Query = 'query',
  PermissionSet = 'permissionset',
  PermissionSetExtension = 'permissionsetextension',
  Profile = 'profile',
  ControlAddIn = 'controladdin',
  DotNetAssembly = 'dotnetassembly',
  DotNetInterop = 'dotnetinterop',
  DotNetPackage = 'dotnetpackage'
}

/**
 * Range definition
 */
export interface Range {
  from: number;
  to: number;
}

/**
 * Object ID configuration structure
 */
export interface ObjIdConfig {
  idRanges?: Range[];
  objectRanges?: {
    [objectType: string]: Range[];
  };
  objectNamePrefix?: string;
  objectNameSuffix?: string;
  bcLicense?: string;
  appPoolId?: string;
  additionalSettings?: {
    [key: string]: unknown;
  };
}

/**
 * App information
 */
export interface AppInfo {
  id: string;
  name: string;
  publisher: string;
  version: string;
}