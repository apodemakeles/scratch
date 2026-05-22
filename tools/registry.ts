import type Anthropic from "@anthropic-ai/sdk";
import { toJSONSchema } from "zod";
import type { AgentTool } from "./types.ts";

/** 将工具定义转为 Anthropic API 所需的 tools 格式 */
export function toApiTools(tools: readonly AgentTool[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      ...toJSONSchema(tool.args),
      type: "object" as const,
    },
  }));
}

/** 按名称执行工具，并用 Zod 校验参数 */
export async function executeTool(
  tools: readonly AgentTool[],
  toolName: string,
  rawArgs: unknown
): Promise<string> {
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    return "Tool not found";
  }
  const parsed = tool.args.parse(rawArgs);
  const result = await tool.execute(parsed);
  return result ?? "";
}
