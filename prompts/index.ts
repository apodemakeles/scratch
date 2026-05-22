import { defaultSystemPromptBuilder } from "./default.ts";
import type { BuiltSystemPrompt, SystemPromptBuilder, SystemPromptContext } from "./types.ts";

export { defaultSystemPromptBuilder } from "./default.ts";
export type { BuiltSystemPrompt, SystemPromptBuilder, SystemPromptContext } from "./types.ts";

/** 从进程环境收集启动上下文 */
export function createStartupContext(
  overrides: Partial<SystemPromptContext> = {}
): SystemPromptContext {
  return {
    cwd: overrides.cwd ?? process.cwd(),
  };
}

/**
 * 在系统启动时构建系统提示词；返回对象在运行期应保持只读使用。
 */
export function buildSystemPrompt(
  builder: SystemPromptBuilder = defaultSystemPromptBuilder,
  context: SystemPromptContext = createStartupContext()
): BuiltSystemPrompt {
  return builder.build(context);
}
