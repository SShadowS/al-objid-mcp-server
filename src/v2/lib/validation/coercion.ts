/**
 * Type coercion utilities for Zod schemas
 *
 * These helpers enable MCP servers to accept parameters as strings
 * (as they may be serialized by MCP clients) and automatically convert
 * them to the proper types for validation.
 */

import { z } from 'zod';

/**
 * Creates a Zod schema that coerces string values to numbers.
 * Accepts both number and string inputs, converting strings to numbers.
 *
 * @example
 * coercedNumber() // accepts 123 or "123"
 * coercedNumber().int().positive() // chainable with Zod methods
 */
export function coercedNumber() {
  // z.coerce.number() handles string-to-number conversion properly
  // and maintains full chainability
  return z.coerce.number();
}

/**
 * Creates a Zod schema that coerces string values to booleans.
 * Properly handles "true" -> true and "false" -> false conversions.
 *
 * Unlike z.coerce.boolean() which converts ANY non-empty string to true,
 * this only accepts "true", "false", or actual booleans.
 *
 * @example
 * coercedBoolean() // accepts true, false, "true", "false"
 * coercedBoolean().optional() // chainable with Zod methods
 */
export function coercedBoolean() {
  return z.union([
    z.boolean(),
    z.string().transform((val) => {
      const lower = val.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
      throw new Error(`Invalid boolean string: ${val}. Expected "true" or "false".`);
    })
  ]);
}

/**
 * Creates a Zod schema that coerces string arrays or JSON-stringified arrays
 * to proper arrays with element type coercion.
 *
 * @param elementSchema - The schema for array elements
 * @example
 * coercedArray(z.number()) // accepts [1, 2] or ["1", "2"]
 * coercedArray(coercedNumber()) // with coerced elements
 */
export function coercedArray<T extends z.ZodTypeAny>(elementSchema: T) {
  return z.union([
    z.array(elementSchema),
    z.string().transform((val) => {
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed)) {
          throw new Error('Not an array');
        }
        return parsed;
      } catch {
        throw new Error(`Invalid array string: ${val}`);
      }
    }).pipe(z.array(elementSchema))
  ]);
}

/**
 * Creates a Zod schema that coerces integer values from strings.
 * Convenience method that combines coercedNumber() with .int()
 *
 * @example
 * coercedInteger() // accepts 123 or "123", validates integer
 */
export function coercedInteger() {
  return z.coerce.number().int();
}

/**
 * Creates a Zod schema that coerces positive integer values from strings.
 * Convenience method that combines coercedNumber() with .int().positive()
 *
 * @example
 * coercedPositiveInteger() // accepts 123 or "123", validates positive integer
 */
export function coercedPositiveInteger() {
  return z.coerce.number().int().positive();
}
