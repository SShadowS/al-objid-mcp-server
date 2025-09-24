/**
 * Type definitions for Logger data types
 */

/**
 * Represents any data that can be safely logged
 * Using 'unknown' as the base type to accept any input,
 * but the Logger will sanitize it properly
 */
export type LoggableData = unknown;

/**
 * Represents an object that can be logged
 */
export interface LoggableObject {
  [key: string]: LoggableData;
}

/**
 * Represents an array that can be logged
 */
export type LoggableArray = LoggableData[];

/**
 * Type guard to check if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard to check if a value is a LoggableObject
 */
export function isLoggableObject(value: unknown): value is LoggableObject {
  return typeof value === 'object' &&
         value !== null &&
         !Array.isArray(value) &&
         !(value instanceof Error);
}