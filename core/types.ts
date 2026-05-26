import type Anthropic from "@anthropic-ai/sdk";

export type SessionRuntime = {
  sessionId: string;
  filePath: string;
  systemText: string;
  tools: Anthropic.Tool[];
  model: string;
  maxTokens: number;
  resumed: boolean;
};

export type ToolMismatchWarning = {
  missingInCurrent: string[];
  newInCurrent: string[];
};

export type AgentTurnCallbacks = {
  /** 每次 API 调用开始前触发（含工具连跑后的后续轮次） */
  onTurnStart: () => void;
  onTextDelta: (delta: string) => void;
  onThinkingDelta: (delta: string) => void;
  onRedactedThinking: (data: string) => void;
  onToolStart: (name: string, input: unknown, toolUseId: string) => void;
  onToolEnd: (name: string, toolUseId: string, result: string) => void;
  onAssistantComplete: () => void;
  onError: (message: string) => void;
};

export type AgentTurnResult = {
  /** 本轮结束后是否应等待用户输入 */
  needsUserInput: boolean;
};
