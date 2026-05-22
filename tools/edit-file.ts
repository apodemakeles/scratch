import fs from "fs";
import { z } from "zod";
import { defineTool } from "./types.ts";

const args = z.object({
  path: z.string(),
  old_string: z.string(),
  new_string: z.string(),
});

function readFileContent(path: string): string {
  if (!fs.existsSync(path)) {
    return `File does not exist at ${path}`;
  }
  return fs.readFileSync(path, "utf8");
}

async function execute({ path, old_string, new_string }: z.infer<typeof args>): Promise<string> {
  const content = readFileContent(path);
  const updatedContent = content.replace(old_string, new_string);
  fs.writeFileSync(path, updatedContent);
  return `File ${path} updated successfully`;
}

export const editFileTool = defineTool({
  name: "edit_file",
  description: "Edit a file in the local file system",
  args,
  execute,
});
