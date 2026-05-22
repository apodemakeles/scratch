import fs from "fs";
import { z } from "zod";
import { defineTool } from "./types.ts";

const args = z.object({
  path: z.string(),
});

function execute({ path }: z.infer<typeof args>): string {
  if (!fs.existsSync(path)) {
    return `File does not exist at ${path}`;
  }
  return fs.readFileSync(path, "utf8");
}

export const readFileTool = defineTool({
  name: "read_file",
  description: "Read a file from the local file system",
  args,
  execute,
});
