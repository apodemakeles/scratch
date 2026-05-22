import os from "node:os";
import path from "node:path";

const SCRATCH_PROJECTS_ROOT = path.join(os.homedir(), ".scratch", "projects");

/**
 * 解析项目根目录：在 git 仓库内使用 git root，否则使用 cwd。
 * 行为对齐 Claude Code（见 anthropics/claude-code 相关 issue）。
 */
export async function resolveProjectRoot(cwd = process.cwd()): Promise<string> {
  try {
    const result = await Bun.$`git rev-parse --show-toplevel`.cwd(cwd).quiet().nothrow();
    if (result.exitCode === 0) {
      const root = result.stdout.toString().trim();
      if (root) {
        return normalizePath(root);
      }
    }
  } catch {
    // 非 git 仓库或 git 不可用
  }
  return normalizePath(cwd);
}

/** 将绝对路径规范为 POSIX 风格，去掉末尾斜杠。 */
export function normalizePath(p: string): string {
  const resolved = path.resolve(p);
  const posix = resolved.split(path.sep).join("/");
  return posix.replace(/\/+$/, "") || "/";
}

/**
 * Claude Code 风格路径编码：非字母数字替换为 `-`。
 * 有损编码，不同路径可能碰撞（与 Claude Code 相同限制）。
 */
export function encodeProjectSlug(root: string): string {
  const posix = normalizePath(root);
  let slug = posix.replace(/[^A-Za-z0-9]+/g, "-");
  slug = slug.replace(/-+/g, "-").replace(/^-+/, "");
  return slug || "root";
}

export function getScratchProjectsRoot(): string {
  return SCRATCH_PROJECTS_ROOT;
}

export function getScratchProjectsDir(slug: string): string {
  return path.join(SCRATCH_PROJECTS_ROOT, slug);
}

export function getSessionFilePath(slug: string, sessionId: string): string {
  return path.join(getScratchProjectsDir(slug), `${sessionId}.jsonl`);
}
