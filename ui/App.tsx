import { Box, useApp, useInput, useStdout } from "ink";
import { useCallback, useEffect, useState } from "react";
import { ChatLog } from "./components/ChatLog.tsx";
import { Header } from "./components/Header.tsx";
import { PromptInput } from "./components/PromptInput.tsx";
import { StatusLine } from "./components/StatusLine.tsx";
import { useChatSession } from "./hooks/useChatSession.ts";

const HEADER_ROWS = 5;
const INPUT_ROWS = 3;
const STATUS_ROWS = 3;

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const rows = stdout?.rows ?? 24;

  const {
    ready,
    session,
    messages,
    isBusy,
    statusText,
    error,
    toolMismatchWarning,
    filePath,
    sendMessage,
  } = useChatSession();

  const [scrollOffset, setScrollOffset] = useState(0);
  const [inputKey, setInputKey] = useState(0);

  const maxVisibleMessages = Math.max(3, rows - HEADER_ROWS - INPUT_ROWS - STATUS_ROWS - 2);

  const isAtBottom = scrollOffset === 0;

  useEffect(() => {
    if (isAtBottom) {
      setScrollOffset(0);
    }
  }, [messages, isAtBottom]);

  const scrollUp = useCallback(() => {
    setScrollOffset((o) => Math.min(o + 1, Math.max(0, messages.length - 1)));
  }, [messages.length]);

  const scrollDown = useCallback(() => {
    setScrollOffset((o) => Math.max(0, o - 1));
  }, []);

  const scrollPageUp = useCallback(() => {
    setScrollOffset((o) => Math.min(o + maxVisibleMessages, Math.max(0, messages.length - 1)));
  }, [maxVisibleMessages, messages.length]);

  const scrollPageDown = useCallback(() => {
    setScrollOffset((o) => Math.max(0, o - maxVisibleMessages));
  }, [maxVisibleMessages]);

  useInput(
    (input, key) => {
      if (key.ctrl && input === "c") {
        exit();
        return;
      }

      if (isBusy) {
        return;
      }

      if (key.upArrow) {
        scrollUp();
      } else if (key.downArrow) {
        scrollDown();
      } else if (key.pageUp) {
        scrollPageUp();
      } else if (key.pageDown) {
        scrollPageDown();
      }
    },
    { isActive: ready }
  );

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (trimmed === "q" || trimmed === "quit") {
        exit();
        return;
      }
      setInputKey((k) => k + 1);
      setScrollOffset(0);
      await sendMessage(value);
    },
    [exit, sendMessage]
  );

  return (
    <Box flexDirection="column" height={rows - 1}>
      <Header session={session} filePath={filePath} />
      <ChatLog
        messages={messages}
        scrollOffset={scrollOffset}
        maxVisibleMessages={maxVisibleMessages}
      />
      <StatusLine
        statusText={statusText}
        error={error}
        toolMismatchWarning={toolMismatchWarning}
        isBusy={isBusy}
      />
      {ready && <PromptInput key={inputKey} isDisabled={isBusy} onSubmit={handleSubmit} />}
    </Box>
  );
}
