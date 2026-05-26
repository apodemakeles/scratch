import { Box, Text } from "ink";
import type { UiMessage } from "../../core/display-messages.ts";
import { MessageRow } from "./MessageRow.tsx";

export type ChatLogProps = {
  messages: UiMessage[];
  scrollOffset: number;
  maxVisibleMessages: number;
};

export function ChatLog({ messages, scrollOffset, maxVisibleMessages }: ChatLogProps) {
  const total = messages.length;
  const end = Math.max(0, total - scrollOffset);
  const start = Math.max(0, end - maxVisibleMessages);
  const visible = messages.slice(start, end);

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      {total === 0 && <Text dimColor>暂无消息，在下方输入开始聊天</Text>}
      {scrollOffset > 0 && total > maxVisibleMessages && (
        <Text dimColor>↑ 还有 {scrollOffset} 条更早消息</Text>
      )}
      {visible.map((message) => (
        <MessageRow key={message.id} message={message} />
      ))}
    </Box>
  );
}
