import type { ManusContext, ToolExecutionResult } from "@/lib/manus/types/manus.types";

export abstract class BaseTool<TInput, TOutput extends Record<string, unknown>> {
  abstract readonly name: string;

  abstract validate(input: TInput, context: ManusContext): Promise<void> | void;

  abstract permissions(context: ManusContext): Promise<void> | void;

  abstract execute(input: TInput, context: ManusContext): Promise<ToolExecutionResult<TOutput>>;

  async rollback(_rollbackToken: string, _context: ManusContext): Promise<void> {
    return;
  }

  async audit(result: ToolExecutionResult<TOutput>, _context: ManusContext): Promise<Record<string, unknown>> {
    return result.audit;
  }
}
