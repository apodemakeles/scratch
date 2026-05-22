import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { defineTool } from "./types.ts";

const execAsync = promisify(exec);

const args = z.object({
  command: z
    .string()
    .describe(
      "The bash command to execute. Must be non-interactive (no vim, top, or long-running watchers like `npm run dev`). Quote paths containing spaces."
    ),
});

async function execute({ command }: z.infer<typeof args>): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 30_000 });
    return `<stdout>\n${stdout}</stdout>\n<stderr>\n${stderr}</stderr>`;
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string; code?: number };
    return `<stdout>\n${err.stdout ?? ""}</stdout>\n<stderr>\n${err.stderr ?? err.message}</stderr>\n<exit_code>${err.code ?? 1}</exit_code>`;
  }
}

export const bashTool = defineTool({
  name: "bash",
  description: "Execute a bash command in the local environment",
  args,
  execute,
});
