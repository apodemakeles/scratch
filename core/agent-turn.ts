import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient } from "../lib/client.ts";
import { toAssistantMessageParam } from "../lib/conversation.ts";
import { appendSessionMessage } from "../lib/session-store.ts";
import { runTool } from "../tools/index.ts";
import type { AgentTurnCallbacks, AgentTurnResult, SessionRuntime } from "./types.ts";

async function persistMessage(filePath: string, message: Anthropic.MessageParam): Promise<void> {
  await appendSessionMessage(filePath, message);
}

async function runSingleApiTurn(
  session: SessionRuntime,
  conversations: Anthropic.MessageParam[],
  callbacks: AgentTurnCallbacks
): Promise<{ stopReason: Anthropic.Message["stop_reason"] | null }> {
  callbacks.onTurnStart();

  const stream = anthropicClient.messages.stream({
    model: session.model,
    system: session.systemText,
    messages: conversations,
    max_tokens: session.maxTokens,
    tools: session.tools,
    thinking: { type: "enabled", budget_tokens: 1024, display: "summarized" } as any,
  });

  stream.on("text", (delta) => {
    callbacks.onTextDelta(delta);
  });

  stream.on("thinking", (delta) => {
    callbacks.onThinkingDelta(delta);
  });

  stream.on("contentBlock", (block) => {
    if (block.type === "redacted_thinking") {
      const redacted = typeof block.data === "string" ? block.data : "[redacted_thinking]";
      callbacks.onRedactedThinking(redacted);
    }
  });

  stream.on("error", (err) => {
    callbacks.onError(err.message);
  });

  try {
    const msg = await stream.finalMessage();
    callbacks.onAssistantComplete();

    const assistantMessage = toAssistantMessageParam(msg);
    if (assistantMessage) {
      conversations.push(assistantMessage);
      await persistMessage(session.filePath, assistantMessage);
    }

    if (msg.stop_reason === "tool_use") {
      const toolUses = msg.content.filter((b) => b.type === "tool_use");
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        callbacks.onToolStart(tu.name, tu.input, tu.id);
        const toolExecutionResult = await runTool(tu.name, tu.input);
        callbacks.onToolEnd(tu.name, tu.id, toolExecutionResult);
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: toolExecutionResult,
        });
      }
      const toolResultMessage: Anthropic.MessageParam = {
        role: "user",
        content: toolResultBlocks,
      };
      conversations.push(toolResultMessage);
      await persistMessage(session.filePath, toolResultMessage);
    }

    return { stopReason: msg.stop_reason };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks.onError(message);
    return { stopReason: null };
  }
}

/**
 * 执行一轮或多轮 API 调用（含工具自动连跑），直到需要用户输入或出错。
 * 调用方应在调用前已将 user 消息写入 conversations 并持久化。
 */
export async function runAgentTurn(
  session: SessionRuntime,
  conversations: Anthropic.MessageParam[],
  callbacks: AgentTurnCallbacks
): Promise<AgentTurnResult> {
  let needsUserInput = true;

  while (true) {
    const { stopReason } = await runSingleApiTurn(session, conversations, callbacks);
    if (stopReason === "tool_use") {
      needsUserInput = false;
      continue;
    }
    break;
  }

  return { needsUserInput };
}
