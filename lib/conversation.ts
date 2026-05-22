import type Anthropic from "@anthropic-ai/sdk";

function contentBlockToParam(block: Anthropic.ContentBlock): Anthropic.ContentBlockParam | null {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "tool_use":
      return { type: "tool_use", id: block.id, name: block.name, input: block.input };
    case "thinking":
      return { type: "thinking", thinking: block.thinking, signature: block.signature };
    case "redacted_thinking":
      return { type: "redacted_thinking", data: block.data };
    default:
      return null;
  }
}

/** 将 assistant 回复完整映射为 MessageParam（含 thinking / tool_use / text）。 */
export function toAssistantMessageParam(msg: Anthropic.Message): Anthropic.MessageParam | null {
  const blocks = msg.content
    .map(contentBlockToParam)
    .filter((b): b is Anthropic.ContentBlockParam => b !== null);

  if (blocks.length === 0) {
    return null;
  }

  if (blocks.length === 1) {
    const first = blocks[0];
    if (first?.type === "text") {
      return { role: "assistant", content: first.text };
    }
  }

  return { role: "assistant", content: blocks };
}
