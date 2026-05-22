import type Anthropic from "@anthropic-ai/sdk";

/** 与原先一致：不把 thinking 写入后续对话，只保留 text / tool_use。 */
export function toAssistantConversationContent(
  msg: Anthropic.Message
): Anthropic.ContentBlockParam[] | string {
  const blocks = msg.content
    .filter((b) => b.type === "text" || b.type === "tool_use")
    .map((b) =>
      b.type === "text"
        ? { type: "text" as const, text: b.text }
        : { type: "tool_use" as const, id: b.id, name: b.name, input: b.input }
    );
  if (blocks.length === 0) {
    return "";
  }
  if (blocks.length === 1) {
    const first = blocks[0];
    if (first?.type === "text") {
      return first.text;
    }
  }
  return blocks;
}
