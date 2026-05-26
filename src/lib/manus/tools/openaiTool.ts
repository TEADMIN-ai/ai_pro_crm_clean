import OpenAI from "openai";
import { manusConfig } from "@/lib/manus/config/manus.config";
import type { ManusContext, ToolExecutionResult } from "@/lib/manus/types/manus.types";
import { BaseTool } from "@/lib/manus/tools/baseTool";
import { assertToolAccess } from "@/lib/manus/utils/permissionGuard";
import { withRetry } from "@/lib/manus/utils/safeExecution";

type OpenAIInput = {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
};

export class OpenAITool extends BaseTool<OpenAIInput, { outputText: string }> {
  readonly name = "openaiTool";

  validate(input: OpenAIInput, _context: ManusContext) {
    if (!input.prompt.trim()) {
      throw new Error("Prompt is required");
    }
  }

  permissions(context: ManusContext) {
    assertToolAccess(context, this.name);
  }

  private getClient() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    return apiKey ? new OpenAI({ apiKey }) : null;
  }

  async execute(input: OpenAIInput, context: ManusContext): Promise<ToolExecutionResult<{ outputText: string }>> {
    this.validate(input, context);
    this.permissions(context);

    const client = this.getClient();
    if (!client || context.dryRun) {
      return {
        ok: true,
        toolName: this.name,
        data: { outputText: "" },
        warnings: [client ? "Dry run enabled: OpenAI call skipped" : "OPENAI_API_KEY not configured"],
        audit: { model: input.model ?? manusConfig.models.orchestration, dryRun: Boolean(context.dryRun) },
      };
    }

    const response = await withRetry(
      () =>
        client.responses.create({
          model: input.model ?? manusConfig.models.orchestration,
          temperature: input.temperature ?? 0,
          max_output_tokens: manusConfig.openai.maxOutputTokens,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: input.systemPrompt ?? "Return grounded, concise workflow output." }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: input.prompt.slice(0, 20_000) }],
            },
          ],
        }),
      manusConfig.workflows.maxRetries
    );

    return {
      ok: true,
      toolName: this.name,
      data: { outputText: response.output_text ?? "" },
      warnings: [],
      audit: { model: input.model ?? manusConfig.models.orchestration },
    };
  }
}
