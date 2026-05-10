import { Anthropic } from "@anthropic-ai/sdk";
import chalk from "chalk";
import { exec } from "child_process";
import fs from "fs";
import readline from "readline";
import { promisify } from "util";
import { toJSONSchema, z } from "zod";

const execAsync = promisify(exec);

const getUserInput = (): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.green("You: "), (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const bash = async (args: { command: string }) => {
  try {
    const { stdout, stderr } = await execAsync(args.command, { timeout: 30_000 });
    return `<stdout>\n${stdout}</stdout>\n<stderr>\n${stderr}</stderr>`;
  } catch (error: any) {
    return `<stdout>\n${error.stdout ?? ""}</stdout>\n<stderr>\n${error.stderr ?? error.message}</stderr>\n<exit_code>${error.code ?? 1}</exit_code>`;
  }
};

const readFile = (args: { path: string }) => {
  const fileExists = fs.existsSync(args.path);
  if (!fileExists) {
    return `File does not exist at ${args.path}`;
  }

  return fs.readFileSync(args.path, "utf8");
};

const listFile = async (args: { path: string }) => {
  try {
    const { stdout } = await execAsync(
      `npx tree-cli ${args.path} -I "node_modules|.git|dist|build|.next|.vscode|coverage|node_modules"`
    );
    return stdout;
  } catch (error) {
    return `Directory not found: ${args.path}`;
  }
};

const editFile = async (args: { path: string; old_string: string; new_string: string }) => {
  const content = readFile({ path: args.path });
  const updatedContent = content.replace(args.old_string, args.new_string);
  fs.writeFileSync(args.path, updatedContent);
};

const createFile = async (args: { path: string; content: string }) => {
  const dir = args.path.substring(0, args.path.lastIndexOf("/"));
  if (dir) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(args.path, args.content);
  return `File ${args.path} created successfully`;
};

const tool_defs = [
  {
    name: "read_file",
    description: "Read a file from the local file system",
    args: z.object({
      path: z.string(),
    }),
    execute: readFile,
  },
  {
    name: "list_file",
    description: "List files in a directory",
    args: z.object({
      path: z.string(),
    }),
    execute: listFile,
  },
  {
    name: "create_file",
    description: "Create a file in the local file system",
    args: z.object({
      path: z.string(),
      content: z.string(),
    }),
    execute: createFile,
  },
  {
    name: "edit_file",
    description: "Edit a file in the local file system",
    args: z.object({
      path: z.string(),
      old_string: z.string(),
      new_string: z.string(),
    }),
    execute: editFile,
  },
  {
    name: "bash",
    description: ``,
    args: z.object({
      command: z
        .string()
        .describe(
          "The bash command to execute. Must be non-interactive (no vim, top, or long-running watchers like `npm run dev`). Quote paths containing spaces."
        ),
    }),
    execute: bash,
  },
];

const tools = tool_defs.map((item) => ({
  name: item.name,
  description: item.description,
  input_schema: {
    ...toJSONSchema(item.args),
    type: "object" as const,
  },
}));

const executeTool = async (tool_name: string, args: any) => {
  const tool = tool_defs.find((tool) => tool.name === tool_name);
  if (!tool) {
    return "Tool not found";
  }
  // Execute and validate that we have the right tools
  const execute = tool.execute as (args: any) => any;
  return await execute(tool.args.parse(args));
};

const SYSTEM_PROMPT = `
你是一个用来个人工作助手，会进行问题的回答，以及使用我提供的工具\n`;

/** 与原先一致：不把 thinking 写入后续对话，只保留 text / tool_use。 */
const toAssistantConversationContent = (
  msg: Anthropic.Message
): Anthropic.ContentBlockParam[] | string => {
  const blocks = msg.content
    .filter((b) => b.type === "text" || b.type === "tool_use")
    .map((b) =>
      b.type === "text"
        ? { type: "text" as const, text: b.text }
        : { type: "tool_use" as const, id: b.id, name: b.name, input: b.input }
    );
  if (blocks.length === 0) {
    return "";
  }
  if (blocks.length === 1) {
    const first = blocks[0];
    if (first?.type === "text") {
      return first.text;
    }
  }
  return blocks;
};

const run = async () => {
  console.log(chalk.cyanBright("Welcome to Amie!"));

  // Define a new array to store past messages
  const conversations: Anthropic.MessageParam[] = [];
  let processUserInput: boolean = true;
  const maxTokens = 4096;

  while (true) {
    if (processUserInput) {
      const userInput = await getUserInput();
      if (userInput === "q" || userInput === "quit") {
        break;
      }
      conversations.push({ role: "user", content: userInput });
    }

    // Reset processUserInput
    processUserInput = true;

    const stream = client.messages.stream({
      model: "glm-5.1",
      system: SYSTEM_PROMPT,
      messages: conversations,
      max_tokens: maxTokens,
      tools: tools,
      thinking: { type: "enabled", budget_tokens: 1024, display: "summarized" } as any,
    });

    let wroteClaudePrefix = false;
    let wroteThinkingPrefix = false;

    stream.on("text", (delta) => {
      if (!wroteClaudePrefix) {
        process.stdout.write(chalk.blue("Claude: "));
        wroteClaudePrefix = true;
      }
      process.stdout.write(chalk.blue(delta));
    });

    stream.on("thinking", (delta) => {
      if (!wroteThinkingPrefix) {
        process.stdout.write(chalk.gray("\nThinking: "));
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
      if (wroteClaudePrefix || wroteThinkingPrefix) {
        process.stdout.write("\n");
      }

      const assistantContent = toAssistantConversationContent(msg);
      if (assistantContent !== "") {
        conversations.push({ role: "assistant", content: assistantContent });
      }

      if (msg.stop_reason === "tool_use") {
        const toolUses = msg.content.filter((b) => b.type === "tool_use");
        const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          console.log(chalk.yellow(`tool: ${tu.name}(${JSON.stringify(tu.input)})`));
          const tool_execution_result = await executeTool(tu.name, tu.input);
          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: tool_execution_result,
          });
        }
        conversations.push({ role: "user", content: toolResultBlocks });
        processUserInput = false;
      }
    } catch (err) {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    }
  }

  console.log("Exiting...");
};

run();
