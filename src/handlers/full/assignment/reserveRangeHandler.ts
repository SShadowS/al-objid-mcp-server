import { ALObjectIdServer } from '../../../server';
import { ReserveRangeArgs } from '../../../lib/types/ToolHandlerArgs';
import { ALObjectType } from '../../../lib/types/ALObjectType';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Reserves a range of object IDs for future use
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for range reservation
 * @param args.appPath - Optional path to the AL app
 * @param args.objectType - Type of AL object to reserve range for
 * @param args.from - Starting ID of the range (inclusive)
 * @param args.to - Ending ID of the range (inclusive)
 * @param args.description - Optional description of the reservation
 * @returns Promise resolving to reservation result
 * @throws {Error} When app is not found or range is invalid
 *
 * @description
 * This handler reserves a contiguous range of IDs for a specific object type,
 * preventing them from being automatically assigned to other objects.
 *
 * Use cases:
 * - Reserve IDs for future features
 * - Maintain ID patterns (e.g., tables 50100-50199, pages 50200-50299)
 * - Reserve ranges for specific modules or components
 * - Coordinate ID allocation across teams
 *
 * The reservation process:
 * 1. Validates app authorization
 * 2. Checks range validity and availability
 * 3. Marks entire range as reserved
 * 4. Records reservation in backend
 * 5. Updates local assignment tracking
 *
 * @example
 * ```typescript
 * // Reserve range for customer management tables
 * const result = await handleReserveRange(server, {
 *   appPath: '/workspace/app',
 *   objectType: 'table',
 *   from: 50100,
 *   to: 50149,
 *   description: 'Customer management tables'
 * });
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: "✅ Reserved 50 IDs (50100-50149) for table"
 * //   }]
 * // }
 *
 * // Reserve page range for reporting module
 * const result = await handleReserveRange(server, {
 *   objectType: 'page',
 *   from: 50500,
 *   to: 50599,
 *   description: 'Reporting module pages'
 * });
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: "✅ Reserved 100 IDs (50500-50599) for page"
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleAssignIds} for individual ID assignment
 * @see {@link handleBatchAssign} for multi-type assignment
 */
export async function handleReserveRange(
  server: ALObjectIdServer,
  args: ReserveRangeArgs
): Promise<ToolCallResponse> {
  const app = await server.getAppFromPath(args.appPath);
  if (!app) {
    return {
      content: [{ type: "text", text: "No AL app found" }],
      isError: true
    };
  }

  const success = await server.assignmentManager.reserveRange(
    app,
    args.objectType as ALObjectType,
    args.from,
    args.to,
    args.description
  );

  if (success) {
    const count = args.to - args.from + 1;
    return {
      content: [{
        type: "text",
        text: `✅ Reserved ${count} IDs (${args.from}-${args.to}) for ${args.objectType}`
      }]
    };
  }

  return {
    content: [{ type: "text", text: "Failed to reserve range" }],
    isError: true
  };
}