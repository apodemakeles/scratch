import type Anthropic from "@anthropic-ai/sdk";
import { parseCli } from "../lib/cli.ts";
import { encodeProjectSlug, resolveProjectRoot } from "../lib/project-slug.ts";
import {
  createSession,
  diffToolNames,
  type LoadedSession,
  loadSession,
} from "../lib/session-store.ts";
import { buildSystemPrompt } from "../prompts/index.ts";
import { apiTools } from "../tools/index.ts";
import { DEFAULT_MAX_TOKENS, DEFAULT_MODEL } from "./constants.ts";
import type { SessionRuntime, ToolMismatchWarning } from "./types.ts";

export type InitSessionResult = {
  session: SessionRuntime;
  conversations: Anthropic.MessageParam[];
  loadedSession?: LoadedSession;
  toolMismatch?: ToolMismatchWarning;
};

export async function initSession(): Promise<InitSessionResult> {
  const cli = parseCli();
  const cwd = process.cwd();
  const projectRoot = await resolveProjectRoot(cwd);
  const projectSlug = encodeProjectSlug(projectRoot);

  if (cli.resumeSessionId) {
    const loaded = await loadSession(cli.resumeSessionId, projectSlug);
    const { missingInCurrent, newInCurrent } = diffToolNames(loaded.meta.tools, apiTools);
    const toolMismatch =
      missingInCurrent.length > 0 || newInCurrent.length > 0
        ? { missingInCurrent, newInCurrent }
        : undefined;

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
      toolMismatch,
    };
  }

  const sessionId = crypto.randomUUID();
  const systemPrompt = buildSystemPrompt();
  const filePath = await createSession({
    sessionId,
    cwd,
    projectRoot,
    projectSlug,
    model: DEFAULT_MODEL,
    maxTokens: DEFAULT_MAX_TOKENS,
    system: systemPrompt,
    tools: apiTools,
  });

  return {
    session: {
      sessionId,
      filePath,
      systemText: systemPrompt.text,
      tools: apiTools,
      model: DEFAULT_MODEL,
      maxTokens: DEFAULT_MAX_TOKENS,
      resumed: false,
    },
    conversations: [],
  };
}
