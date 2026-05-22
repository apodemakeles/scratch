import { bashTool } from "./bash.ts";
import { createFileTool } from "./create-file.ts";
import { editFileTool } from "./edit-file.ts";
import { listFileTool } from "./list-file.ts";
import { readFileTool } from "./read-file.ts";
import { executeTool, toApiTools } from "./registry.ts";
import type { AgentTool } from "./types.ts";

export { executeTool, toApiTools } from "./registry.ts";
export type { AgentTool, AgentToolDefinition } from "./types.ts";
export { defineTool } from "./types.ts";

/** 默认注册的全部工具 */
export const agentTools: readonly AgentTool[] = [
  readFileTool,
  listFileTool,
  createFileTool,
  editFileTool,
  bashTool,
] as const;

export const apiTools = toApiTools(agentTools);

export const runTool = (name: string, args: unknown) => executeTool(agentTools, name, args);
