import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { defineTool } from "./types.ts";

const execAsync = promisify(exec);

const args = z.object({
  path: z.string(),
});

async function execute({ path }: z.infer<typeof args>): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `bunx tree-cli ${path} -I "node_modules|.git|dist|build|.next|.vscode|coverage|node_modules"`
    );
    return stdout;
  } catch {
    return `Directory not found: ${path}`;
  }
}

export const listFileTool = defineTool({
  name: "list_file",
  description: "List files in a directory",
  args,
  execute,
});
