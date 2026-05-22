import type { z } from "zod";

/** 单个 Agent 工具的定义 */
export type AgentTool<T extends z.ZodType = z.ZodType> = {
  readonly name: string;
  readonly description: string;
  readonly args: T;
  readonly execute: (args: z.infer<T>) => Promise<string> | string;
};

export type AgentToolDefinition<T extends z.ZodType> = {
  name: string;
  description: string;
  args: T;
  execute: (args: z.infer<T>) => Promise<string> | string;
};

/** 用 Zod schema 约束参数类型，生成 AgentTool */
export function defineTool<T extends z.ZodType>(def: AgentToolDefinition<T>): AgentTool<T> {
  return def;
}
