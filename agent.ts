import type Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { printGoodbye, printStartupBanner } from "./lib/banner.ts";
import { writeAssistantPrefix, writeThinkingPrefix } from "./lib/chat-display.ts";
import { parseCli } from "./lib/cli.ts";
import { anthropicClient } from "./lib/client.ts";
import { toAssistantMessageParam } from "./lib/conversation.ts";
import { getUserInput } from "./lib/input.ts";
import { encodeProjectSlug, resolveProjectRoot } from "./lib/project-slug.ts";
import { printSessionHistory } from "./lib/session-history.ts";
import {
  appendSessionMessage,
  createSession,
  diffToolNames,
  type LoadedSession,
  loadSession,
} from "./lib/session-store.ts";
import { buildSystemPrompt } from "./prompts/index.ts";
import { apiTools, runTool } from "./tools/index.ts";

const MODEL = "glm-5.1";
const MAX_TOKENS = 4096;

type SessionRuntime = {
  sessionId: string;
  filePath: string;
  systemText: string;
  tools: Anthropic.Tool[];
  model: string;
  maxTokens: number;
  resumed: boolean;
};

async function initSession(): Promise<{
  session: SessionRuntime;
  conversations: Anthropic.MessageParam[];
  loadedSession?: LoadedSession;
}> {
  const cli = parseCli();
  const cwd = process.cwd();
  const projectRoot = await resolveProjectRoot(cwd);
  const projectSlug = encodeProjectSlug(projectRoot);

  if (cli.resumeSessionId) {
    const loaded = await loadSession(cli.resumeSessionId, projectSlug);
    const { missingInCurrent, newInCurrent } = diffToolNames(loaded.meta.tools, apiTools);
    if (missingInCurrent.length > 0 || newInCurrent.length > 0) {
      console.warn(
        chalk.yellow(
          `工具集与当前注册表不一致 — 已移除: ${missingInCurrent.join(", ") || "无"}；新增未写入会话: ${newInCurrent.join(", ") || "无"}`
        )
      );
    }

    return {
      session: {
        sessionId: loaded.meta.sessionId,
        filePath: loaded.filePath,
        systemText: loaded.meta.system.text,
        tools: loaded.meta.tools,
        model: loaded.meta.model,
        maxTokens: loaded.meta.maxTokens,
        resumed: true,
      },
      conversations: [...loaded.messages],
      loadedSession: loaded,
    };
  }

  const sessionId = crypto.randomUUID();
  const systemPrompt = buildSystemPrompt();
  const filePath = await createSession({
    sessionId,
    cwd,
    projectRoot,
    projectSlug,
    model: MODEL,
    maxTokens: MAX_TOKENS,
    system: systemPrompt,
    tools: apiTools,
  });

  return {
    session: {
      sessionId,
      filePath,
      systemText: systemPrompt.text,
      tools: apiTools,
      model: MODEL,
      maxTokens: MAX_TOKENS,
      resumed: false,
    },
    conversations: [],
  };
}

async function persistMessage(filePath: string, message: Anthropic.MessageParam): Promise<void> {
  await appendSessionMessage(filePath, message);
}

const run = async () => {
  const { session, conversations, loadedSession } = await initSession();

  printStartupBanner({
    sessionId: session.sessionId,
    filePath: session.filePath,
    resumed: session.resumed,
  });

  if (session.resumed && loadedSession) {
    printSessionHistory(loadedSession);
  }

  let processUserInput = true;

  while (true) {
    if (processUserInput) {
      const userInput = await getUserInput();
      if (userInput === "q" || userInput === "quit") {
        break;
      }
      const userMessage: Anthropic.MessageParam = { role: "user", content: userInput };
      conversations.push(userMessage);
      await persistMessage(session.filePath, userMessage);
    }

    processUserInput = true;

    const stream = anthropicClient.messages.stream({
      model: session.model,
      system: session.systemText,
      messages: conversations,
      max_tokens: session.maxTokens,
      tools: session.tools,
      thinking: { type: "enabled", budget_tokens: 1024, display: "summarized" } as any,
    });

    let wroteAssistantPrefix = false;
    let wroteThinkingPrefix = false;

    stream.on("text", (delta) => {
      if (!wroteAssistantPrefix) {
        writeAssistantPrefix(wroteThinkingPrefix);
        wroteAssistantPrefix = true;
      }
      process.stdout.write(chalk.blue(delta));
    });

    stream.on("thinking", (delta) => {
      if (!wroteThinkingPrefix) {
        writeThinkingPrefix();
        wroteThinkingPrefix = true;
      }
      process.stdout.write(chalk.gray(delta));
    });

    stream.on("contentBlock", (block) => {
      if (block.type === "redacted_thinking") {
        const redacted = typeof block.data === "string" ? block.data : "[redacted_thinking]";
        process.stdout.write(chalk.gray(`Thinking (redacted): ${redacted}\n`));
      }
    });

    stream.on("error", (err) => {
      console.error(chalk.red(err.message));
    });

    try {
      const msg = await stream.finalMessage();
      if (wroteAssistantPrefix || wroteThinkingPrefix) {
        process.stdout.write("\n");
      }

      const assistantMessage = toAssistantMessageParam(msg);
      if (assistantMessage) {
        conversations.push(assistantMessage);
        await persistMessage(session.filePath, assistantMessage);
      }

      if (msg.stop_reason === "tool_use") {
        const toolUses = msg.content.filter((b) => b.type === "tool_use");
        const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          console.log(chalk.yellow(`tool: ${tu.name}(${JSON.stringify(tu.input)})`));
          const toolExecutionResult = await runTool(tu.name, tu.input);
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
        processUserInput = false;
      }
    } catch (err) {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    }
  }

  printGoodbye();
};

run().catch((err) => {
  console.error(chalk.red(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
