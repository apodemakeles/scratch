import type Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import {
  formatAssistantLine,
  formatThinkingLine,
  formatThinkingRedactedLine,
  formatUserLine,
} from "./chat-display.ts";
import type { LoadedSession } from "./session-store.ts";

function isToolResultOnlyUserMessage(message: Anthropic.MessageParam & { role: "user" }): boolean {
  const { content } = message;
  if (typeof content === "string") {
    return false;
  }
  return content.length > 0 && content.every((block) => block.type === "tool_result");
}

function printContentBlock(block: Anthropic.ContentBlockParam, role: "user" | "assistant"): void {
  switch (block.type) {
    case "text":
      if (role === "user") {
        console.log(formatUserLine(block.text));
      } else {
        console.log(formatAssistantLine(block.text));
      }
      break;
    case "thinking":
      console.log(formatThinkingLine(block.thinking));
      break;
    case "redacted_thinking":
      console.log(formatThinkingRedactedLine(block.data));
      break;
    case "tool_use":
      console.log(chalk.yellow(`tool: ${block.name}(${JSON.stringify(block.input)})`));
      break;
    case "tool_result":
      break;
    default:
      console.log(chalk.dim(`[${block.type}]`));
  }
}

function printUserMessage(message: Anthropic.MessageParam & { role: "user" }): boolean {
  if (isToolResultOnlyUserMessage(message)) {
    return false;
  }

  const { content } = message;
  if (typeof content === "string") {
    console.log(formatUserLine(content));
    return true;
  }

  let printed = false;
  for (const block of content) {
    if (block.type === "tool_result") {
      continue;
    }
    printContentBlock(block, "user");
    printed = true;
  }
  return printed;
}

function printAssistantMessage(message: Anthropic.MessageParam & { role: "assistant" }): boolean {
  const { content } = message;
  if (typeof content === "string") {
    console.log(formatAssistantLine(content));
    return true;
  }

  let printed = false;
  for (const block of content) {
    printContentBlock(block, "assistant");
    printed = true;
  }
  return printed;
}

function printMessage(message: Anthropic.MessageParam): boolean {
  if (message.role === "user") {
    return printUserMessage(message);
  }
  return printAssistantMessage(message);
}

/** 逐条打印对话历史。 */
export function printMessageHistory(messages: readonly Anthropic.MessageParam[]): void {
  let first = true;
  for (const message of messages) {
    if (!printMessage(message)) {
      continue;
    }
    if (!first) {
      console.log();
    }
    first = false;
  }
}

function printMetaSummary(loaded: LoadedSession): void {
  const { meta, messages } = loaded;
  console.log(
    chalk.dim(
      `会话开始于 ${meta.createdAt} · 模型 ${meta.model} · ${messages.length} 条消息 · ${meta.tools.length} 个工具`
    )
  );
}

/** 打印完整恢复上下文（meta 摘要 + 全部 message）。 */
export function printSessionHistory(loaded: LoadedSession): void {
  console.log(chalk.dim("\n--- 历史记录 ---"));
  printMetaSummary(loaded);
  if (loaded.messages.length > 0) {
    console.log();
    printMessageHistory(loaded.messages);
  }
  console.log(chalk.dim("--- 历史记录结束 ---\n"));
}
