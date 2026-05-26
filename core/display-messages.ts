import type Anthropic from "@anthropic-ai/sdk";

export type UiBlock =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "redacted_thinking"; data: string }
  | { kind: "tool"; name: string; input: unknown; toolUseId?: string; resultPreview?: string };

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  blocks: UiBlock[];
  streaming?: boolean;
};

let idCounter = 0;

export function newMessageId(): string {
  idCounter += 1;
  return `msg-${idCounter}`;
}

export function resetMessageIdCounter(): void {
  idCounter = 0;
}

function isToolResultOnlyUserMessage(message: Anthropic.MessageParam & { role: "user" }): boolean {
  const { content } = message;
  if (typeof content === "string") {
    return false;
  }
  return content.length > 0 && content.every((block) => block.type === "tool_result");
}

function contentBlockToUi(block: Anthropic.ContentBlockParam): UiBlock | null {
  switch (block.type) {
    case "text":
      return { kind: "text", text: block.text };
    case "thinking":
      return { kind: "thinking", text: block.thinking };
    case "redacted_thinking":
      return { kind: "redacted_thinking", data: block.data };
    case "tool_use":
      return { kind: "tool", name: block.name, input: block.input, toolUseId: block.id };
    case "tool_result":
      return null;
    default:
      return null;
  }
}

function messageToUiBlocks(message: Anthropic.MessageParam): UiBlock[] {
  const { content } = message;
  if (typeof content === "string") {
    return [{ kind: "text", text: content }];
  }
  const blocks: UiBlock[] = [];
  for (const block of content) {
    const ui = contentBlockToUi(block);
    if (ui) {
      blocks.push(ui);
    }
  }
  return blocks;
}

export function messageParamToUiMessage(
  message: Anthropic.MessageParam,
  id?: string
): UiMessage | null {
  if (message.role === "user" && isToolResultOnlyUserMessage(message)) {
    return null;
  }

  const blocks = messageToUiBlocks(message);
  if (blocks.length === 0) {
    return null;
  }

  return {
    id: id ?? newMessageId(),
    role: message.role,
    blocks,
  };
}

export function messagesToUiMessages(messages: readonly Anthropic.MessageParam[]): UiMessage[] {
  const result: UiMessage[] = [];
  for (const message of messages) {
    const ui = messageParamToUiMessage(message);
    if (ui) {
      result.push(ui);
    }
  }
  return result;
}

export function createUserUiMessage(text: string): UiMessage {
  return {
    id: newMessageId(),
    role: "user",
    blocks: [{ kind: "text", text }],
  };
}

export function createStreamingAssistantMessage(): UiMessage {
  return {
    id: newMessageId(),
    role: "assistant",
    blocks: [],
    streaming: true,
  };
}

export function appendTextDelta(
  message: UiMessage,
  delta: string,
  kind: "text" | "thinking"
): UiMessage {
  const blocks = [...message.blocks];
  const last = blocks[blocks.length - 1];
  if (last && last.kind === kind) {
    blocks[blocks.length - 1] = { kind, text: last.text + delta };
  } else {
    blocks.push({ kind, text: delta });
  }
  return { ...message, blocks };
}

export function appendRedactedThinking(message: UiMessage, data: string): UiMessage {
  return {
    ...message,
    blocks: [...message.blocks, { kind: "redacted_thinking", data }],
  };
}

export function appendToolBlock(
  message: UiMessage,
  name: string,
  input: unknown,
  toolUseId: string
): UiMessage {
  return {
    ...message,
    blocks: [...message.blocks, { kind: "tool", name, input, toolUseId }],
  };
}

export function setToolResult(
  message: UiMessage,
  toolUseId: string,
  resultPreview: string
): UiMessage {
  const blocks = message.blocks.map((b) =>
    b.kind === "tool" && b.toolUseId === toolUseId ? { ...b, resultPreview } : b
  );
  return { ...message, blocks };
}

export function finalizeStreamingMessage(message: UiMessage): UiMessage {
  return { ...message, streaming: false };
}

export function truncatePreview(text: string, maxLen = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) {
    return oneLine;
  }
  return `${oneLine.slice(0, maxLen)}…`;
}
