import type Anthropic from "@anthropic-ai/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { runAgentTurn } from "../../core/agent-turn.ts";
import { ASSISTANT_LABEL } from "../../core/constants.ts";
import {
  appendRedactedThinking,
  appendTextDelta,
  appendToolBlock,
  createStreamingAssistantMessage,
  createUserUiMessage,
  finalizeStreamingMessage,
  messagesToUiMessages,
  resetMessageIdCounter,
  setToolResult,
  truncatePreview,
  type UiMessage,
} from "../../core/display-messages.ts";
import { initSession } from "../../core/session-init.ts";
import type { SessionRuntime } from "../../core/types.ts";
import { appendSessionMessage } from "../../lib/session-store.ts";

export type ChatSessionState = {
  ready: boolean;
  session: SessionRuntime | null;
  messages: UiMessage[];
  isBusy: boolean;
  statusText: string;
  error: string | null;
  toolMismatchWarning: string | null;
  filePath: string | null;
};

export type UseChatSessionResult = ChatSessionState & {
  sendMessage: (text: string) => Promise<void>;
};

export function useChatSession(): UseChatSessionResult {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<SessionRuntime | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [statusText, setStatusText] = useState("正在初始化…");
  const [error, setError] = useState<string | null>(null);
  const [toolMismatchWarning, setToolMismatchWarning] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);

  const conversationsRef = useRef<Anthropic.MessageParam[]>([]);
  const streamingRef = useRef<UiMessage | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        resetMessageIdCounter();
        const result = await initSession();
        if (cancelled) {
          return;
        }

        conversationsRef.current = result.conversations;
        setSession(result.session);
        setFilePath(result.session.filePath);

        if (result.toolMismatch) {
          const { missingInCurrent, newInCurrent } = result.toolMismatch;
          setToolMismatchWarning(
            `工具集不一致 — 已移除: ${missingInCurrent.join(", ") || "无"}；新增: ${newInCurrent.join(", ") || "无"}`
          );
        }

        const uiMessages = messagesToUiMessages(result.conversations);
        setMessages(uiMessages);
        setStatusText(result.session.resumed ? "已恢复会话，输入消息继续" : "输入消息开始聊天");
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setStatusText("初始化失败");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateStreaming = useCallback((updater: (msg: UiMessage) => UiMessage) => {
    const current = streamingRef.current;
    if (!current) {
      return;
    }
    const updated = updater(current);
    streamingRef.current = updated;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === updated.id);
      if (idx === -1) {
        return [...prev, updated];
      }
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!session || isBusy) {
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      setError(null);
      setIsBusy(true);
      setStatusText(`${ASSISTANT_LABEL} 正在思考…`);

      const userUi = createUserUiMessage(trimmed);
      const userMessage: Anthropic.MessageParam = { role: "user", content: trimmed };
      conversationsRef.current.push(userMessage);
      await appendSessionMessage(session.filePath, userMessage);

      setMessages((prev) => [...prev, userUi]);

      const startStreamingTurn = () => {
        const streaming = createStreamingAssistantMessage();
        streamingRef.current = streaming;
        setMessages((prev) => [...prev, streaming]);
      };

      await runAgentTurn(session, conversationsRef.current, {
        onTurnStart: () => {
          startStreamingTurn();
        },
        onTextDelta: (delta) => {
          updateStreaming((m) => appendTextDelta(m, delta, "text"));
        },
        onThinkingDelta: (delta) => {
          updateStreaming((m) => appendTextDelta(m, delta, "thinking"));
        },
        onRedactedThinking: (data) => {
          updateStreaming((m) => appendRedactedThinking(m, data));
        },
        onToolStart: (name, input, toolUseId) => {
          setStatusText(`执行工具: ${name}`);
          updateStreaming((m) => appendToolBlock(m, name, input, toolUseId));
        },
        onToolEnd: (_name, toolUseId, result) => {
          updateStreaming((m) => setToolResult(m, toolUseId, truncatePreview(result)));
        },
        onAssistantComplete: () => {
          const current = streamingRef.current;
          if (current) {
            const finalized = finalizeStreamingMessage(current);
            streamingRef.current = finalized;
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === finalized.id);
              if (idx === -1) {
                return prev;
              }
              const next = [...prev];
              next[idx] = finalized;
              return next;
            });
          }
        },
        onError: (message) => {
          setError(message);
        },
      });

      streamingRef.current = null;
      setIsBusy(false);
      setStatusText("输入消息继续 · q 退出 · ↑↓ 滚动");
    },
    [session, isBusy, updateStreaming]
  );

  return {
    ready,
    session,
    messages,
    isBusy,
    statusText,
    error,
    toolMismatchWarning,
    filePath,
    sendMessage,
  };
}
