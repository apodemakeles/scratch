import { appendFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import {
  getScratchProjectsDir,
  getScratchProjectsRoot,
  getSessionFilePath,
} from "./project-slug.ts";

export type SessionMetaLine = {
  type: "meta";
  version: 1;
  sessionId: string;
  createdAt: string;
  cwd: string;
  projectRoot: string;
  projectSlug: string;
  model: string;
  maxTokens: number;
  system: { text: string };
  tools: Anthropic.Tool[];
};

export type SessionMessageLine = {
  type: "message";
  at: string;
  message: Anthropic.MessageParam;
};

export type SessionLine = SessionMetaLine | SessionMessageLine;

export type LoadedSession = {
  meta: SessionMetaLine;
  messages: Anthropic.MessageParam[];
  filePath: string;
};

export type CreateSessionInput = {
  sessionId: string;
  cwd: string;
  projectRoot: string;
  projectSlug: string;
  model: string;
  maxTokens: number;
  system: { text: string };
  tools: Anthropic.Tool[];
};

async function appendLine(filePath: string, line: SessionLine): Promise<void> {
  const serialized = `${JSON.stringify(line)}\n`;
  await appendFile(filePath, serialized, "utf8");
}

export async function createSession(input: CreateSessionInput): Promise<string> {
  const dir = getScratchProjectsDir(input.projectSlug);
  await mkdir(dir, { recursive: true });

  const filePath = getSessionFilePath(input.projectSlug, input.sessionId);
  const meta: SessionMetaLine = {
    type: "meta",
    version: 1,
    sessionId: input.sessionId,
    createdAt: new Date().toISOString(),
    cwd: input.cwd,
    projectRoot: input.projectRoot,
    projectSlug: input.projectSlug,
    model: input.model,
    maxTokens: input.maxTokens,
    system: input.system,
    tools: input.tools,
  };

  await Bun.write(filePath, `${JSON.stringify(meta)}\n`);
  return filePath;
}

export async function appendSessionMessage(
  filePath: string,
  message: Anthropic.MessageParam
): Promise<void> {
  const line: SessionMessageLine = {
    type: "message",
    at: new Date().toISOString(),
    message,
  };
  await appendLine(filePath, line);
}

async function findSessionFilePaths(sessionId: string): Promise<string[]> {
  const fileName = `${sessionId}.jsonl`;
  const root = getScratchProjectsRoot();
  const matches: string[] = [];

  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return matches;
  }

  for (const slug of entries) {
    const candidate = path.join(root, slug, fileName);
    if (await Bun.file(candidate).exists()) {
      matches.push(candidate);
    }
  }

  return matches;
}

export async function findSessionFile(sessionId: string, projectSlug: string): Promise<string> {
  const preferred = getSessionFilePath(projectSlug, sessionId);
  if (await Bun.file(preferred).exists()) {
    return preferred;
  }

  const matches = await findSessionFilePaths(sessionId);
  if (matches.length === 0) {
    throw new Error(`未找到 session: ${sessionId}`);
  }
  if (matches.length > 1) {
    throw new Error(`session ${sessionId} 对应多个文件，请指定项目后重试:\n${matches.join("\n")}`);
  }

  return matches[0]!;
}

function parseSessionLine(raw: string, lineNo: number): SessionLine {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`会话文件第 ${lineNo} 行 JSON 无效`);
  }

  if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
    throw new Error(`会话文件第 ${lineNo} 行缺少 type 字段`);
  }

  return parsed as SessionLine;
}

export async function loadSession(sessionId: string, projectSlug: string): Promise<LoadedSession> {
  const filePath = await findSessionFile(sessionId, projectSlug);
  const text = await Bun.file(filePath).text();
  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error(`会话文件为空: ${filePath}`);
  }

  let meta: SessionMetaLine | undefined;
  const messages: Anthropic.MessageParam[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = parseSessionLine(lines[i]!, i + 1);
    if (line.type === "meta") {
      if (meta) {
        throw new Error(`会话文件第 ${i + 1} 行：重复的 meta 行`);
      }
      if (line.version !== 1) {
        throw new Error(`不支持的会话版本: ${line.version}`);
      }
      if (line.sessionId !== sessionId) {
        throw new Error(`session-id 不匹配：期望 ${sessionId}，文件内为 ${line.sessionId}`);
      }
      meta = line;
    } else if (line.type === "message") {
      if (!meta) {
        throw new Error(`会话文件第 ${i + 1} 行：message 出现在 meta 之前`);
      }
      messages.push(line.message);
    } else {
      throw new Error(`会话文件第 ${i + 1} 行：未知 type`);
    }
  }

  if (!meta) {
    throw new Error(`会话文件缺少 meta 行: ${filePath}`);
  }

  return { meta, messages, filePath };
}

/** 对比恢复的工具与当前注册表，返回缺失或新增的工具名。 */
export function diffToolNames(
  saved: readonly Anthropic.Tool[],
  current: readonly Anthropic.Tool[]
): { missingInCurrent: string[]; newInCurrent: string[] } {
  const savedNames = new Set(saved.map((t) => t.name));
  const currentNames = new Set(current.map((t) => t.name));

  const missingInCurrent = [...savedNames].filter((n) => !currentNames.has(n));
  const newInCurrent = [...currentNames].filter((n) => !savedNames.has(n));

  return { missingInCurrent, newInCurrent };
}
