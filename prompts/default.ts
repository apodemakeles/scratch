import type { BuiltSystemPrompt, SystemPromptBuilder, SystemPromptContext } from "./types.ts";

export const defaultSystemPromptBuilder: SystemPromptBuilder = {
  build(context: SystemPromptContext): BuiltSystemPrompt {
    const text = [
      "你是一个个人工作助手，会回答问题，并使用我提供的工具完成任务。",
      `当前工作目录：${context.cwd}`,
    ].join("\n");

    return { text };
  },
};
