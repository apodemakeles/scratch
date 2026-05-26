import { Box, Text } from "ink";
import { ASSISTANT_LABEL } from "../../core/constants.ts";
import type { UiBlock, UiMessage } from "../../core/display-messages.ts";

function BlockView({ block, role }: { block: UiBlock; role: UiMessage["role"] }) {
  switch (block.kind) {
    case "text":
      if (role === "user") {
        return <Text color="green">User: {block.text}</Text>;
      }
      return (
        <Text color="blue">
          {ASSISTANT_LABEL}: {block.text}
        </Text>
      );
    case "thinking":
      return <Text dimColor>Thinking: {block.text}</Text>;
    case "redacted_thinking":
      return <Text dimColor>Thinking (redacted): {block.data}</Text>;
    case "tool": {
      const inputStr = JSON.stringify(block.input);
      const preview = block.resultPreview ? ` → ${block.resultPreview}` : "";
      return (
        <Text color="yellow">
          tool: {block.name}({inputStr}){preview}
        </Text>
      );
    }
    default:
      return null;
  }
}

export type MessageRowProps = {
  message: UiMessage;
};

export function MessageRow({ message }: MessageRowProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {message.blocks.map((block, i) => (
        <BlockView key={`${message.id}-${i}`} block={block} role={message.role} />
      ))}
      {message.streaming && message.blocks.length === 0 && (
        <Text color="blue" dimColor>
          {ASSISTANT_LABEL}: …
        </Text>
      )}
    </Box>
  );
}
