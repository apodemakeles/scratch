import fs from "fs";
import { z } from "zod";
import { defineTool } from "./types.ts";

const args = z.object({
  path: z.string(),
  content: z.string(),
});

async function execute({ path, content }: z.infer<typeof args>): Promise<string> {
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (dir) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(path, content);
  return `File ${path} created successfully`;
}

export const createFileTool = defineTool({
  name: "create_file",
  description: "Create a file in the local file system",
  args,
  execute,
});
