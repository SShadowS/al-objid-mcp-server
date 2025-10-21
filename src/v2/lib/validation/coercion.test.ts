/**
 * Tests for type coercion utilities
 */

import { z } from 'zod';
import {
  coercedNumber,
  coercedBoolean,
  coercedArray,
  coercedInteger,
  coercedPositiveInteger
} from './coercion';

describe('Coercion Utilities', () => {
  describe('coercedNumber', () => {
    const schema = coercedNumber();

    it('should accept number values', () => {
      expect(schema.parse(123)).toBe(123);
      expect(schema.parse(0)).toBe(0);
      expect(schema.parse(-45.67)).toBe(-45.67);
    });

    it('should coerce string numbers to numbers', () => {
      expect(schema.parse('123')).toBe(123);
      expect(schema.parse('0')).toBe(0);
      expect(schema.parse('-45.67')).toBe(-45.67);
    });

    it('should reject non-numeric strings', () => {
      expect(() => schema.parse('abc')).toThrow();
      expect(() => schema.parse('12.34.56')).toThrow();
    });

    it('should work with optional', () => {
      const optionalSchema = coercedNumber().optional();
      expect(optionalSchema.parse(undefined)).toBeUndefined();
      expect(optionalSchema.parse('123')).toBe(123);
    });

    it('should work with default values', () => {
      const defaultSchema = coercedNumber().optional().default(100);
      expect(defaultSchema.parse(undefined)).toBe(100);
      expect(defaultSchema.parse('50')).toBe(50);
    });

    it('should chain with Zod validators', () => {
      const positiveSchema = coercedNumber().positive();
      expect(positiveSchema.parse('123')).toBe(123);
      expect(() => positiveSchema.parse('-5')).toThrow();

      const minMaxSchema = coercedNumber().min(0).max(100);
      expect(minMaxSchema.parse('50')).toBe(50);
      expect(() => minMaxSchema.parse('150')).toThrow();
    });
  });

  describe('coercedBoolean', () => {
    const schema = coercedBoolean();

    it('should accept boolean values', () => {
      expect(schema.parse(true)).toBe(true);
      expect(schema.parse(false)).toBe(false);
    });

    it('should coerce string "true" to true', () => {
      expect(schema.parse('true')).toBe(true);
      expect(schema.parse('TRUE')).toBe(true);
      expect(schema.parse('True')).toBe(true);
    });

    it('should coerce string "false" to false', () => {
      expect(schema.parse('false')).toBe(false);
      expect(schema.parse('FALSE')).toBe(false);
      expect(schema.parse('False')).toBe(false);
    });

    it('should reject other strings', () => {
      expect(() => schema.parse('yes')).toThrow();
      expect(() => schema.parse('no')).toThrow();
      expect(() => schema.parse('1')).toThrow();
      expect(() => schema.parse('0')).toThrow();
      expect(() => schema.parse('')).toThrow();
    });

    it('should work with optional', () => {
      const optionalSchema = coercedBoolean().optional();
      expect(optionalSchema.parse(undefined)).toBeUndefined();
      expect(optionalSchema.parse('true')).toBe(true);
      expect(optionalSchema.parse('false')).toBe(false);
    });

    it('should work with default values', () => {
      const defaultTrueSchema = coercedBoolean().optional().default(true);
      expect(defaultTrueSchema.parse(undefined)).toBe(true);
      expect(defaultTrueSchema.parse('false')).toBe(false);

      const defaultFalseSchema = coercedBoolean().optional().default(false);
      expect(defaultFalseSchema.parse(undefined)).toBe(false);
      expect(defaultFalseSchema.parse('true')).toBe(true);
    });
  });

  describe('coercedArray', () => {
    it('should accept array values', () => {
      const schema = coercedArray(z.number());
      expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('should coerce JSON string arrays', () => {
      const schema = coercedArray(z.number());
      expect(schema.parse('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('should work with coerced element types', () => {
      const schema = coercedArray(coercedNumber());
      expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3]);
      // Note: string elements in actual array need element-level coercion
    });

    it('should reject non-array values', () => {
      const schema = coercedArray(z.number());
      expect(() => schema.parse('not an array')).toThrow();
      expect(() => schema.parse(123)).toThrow();
    });

    it('should work with empty arrays', () => {
      const schema = coercedArray(z.string());
      expect(schema.parse([])).toEqual([]);
      expect(schema.parse('[]')).toEqual([]);
    });

    it('should work with optional', () => {
      const schema = coercedArray(z.string()).optional();
      expect(schema.parse(undefined)).toBeUndefined();
      expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
    });
  });

  describe('coercedInteger', () => {
    const schema = coercedInteger();

    it('should accept integer values', () => {
      expect(schema.parse(123)).toBe(123);
      expect(schema.parse(0)).toBe(0);
      expect(schema.parse(-45)).toBe(-45);
    });

    it('should coerce string integers', () => {
      expect(schema.parse('123')).toBe(123);
      expect(schema.parse('0')).toBe(0);
      expect(schema.parse('-45')).toBe(-45);
    });

    it('should reject decimal values', () => {
      expect(() => schema.parse(12.34)).toThrow();
      expect(() => schema.parse('12.34')).toThrow();
    });
  });

  describe('coercedPositiveInteger', () => {
    const schema = coercedPositiveInteger();

    it('should accept positive integer values', () => {
      expect(schema.parse(123)).toBe(123);
      expect(schema.parse(1)).toBe(1);
    });

    it('should coerce string positive integers', () => {
      expect(schema.parse('123')).toBe(123);
      expect(schema.parse('1')).toBe(1);
    });

    it('should reject zero and negative values', () => {
      expect(() => schema.parse(0)).toThrow();
      expect(() => schema.parse(-5)).toThrow();
      expect(() => schema.parse('0')).toThrow();
      expect(() => schema.parse('-5')).toThrow();
    });

    it('should reject decimal values', () => {
      expect(() => schema.parse(12.34)).toThrow();
      expect(() => schema.parse('12.34')).toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should work in complex schemas', () => {
      const complexSchema = z.object({
        count: coercedNumber().int().positive().optional().default(1),
        enabled: coercedBoolean().optional().default(false),
        ids: coercedArray(coercedNumber()).optional(),
        name: z.string(),
      });

      // All string parameters
      const result1 = complexSchema.parse({
        count: '5',
        enabled: 'true',
        ids: [1, 2, 3],
        name: 'test',
      });
      expect(result1).toEqual({
        count: 5,
        enabled: true,
        ids: [1, 2, 3],
        name: 'test',
      });

      // Mixed types
      const result2 = complexSchema.parse({
        count: 10,
        enabled: false,
        name: 'test2',
      });
      expect(result2).toEqual({
        count: 10,
        enabled: false,
        name: 'test2',
      });

      // Using defaults
      const result3 = complexSchema.parse({
        name: 'test3',
      });
      expect(result3).toEqual({
        count: 1,
        enabled: false,
        name: 'test3',
      });
    });
  });
});
