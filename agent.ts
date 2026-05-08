import { Anthropic } from "@anthropic-ai/sdk";
import chalk from "chalk";
import fs from "fs";
import readline from "readline";
import { toJSONSchema, z } from "zod";

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

const readFile = (args: { path: string }) => {
  const fileExists = fs.existsSync(args.path);
  if (!fileExists) {
    return `File does not exist at ${args.path}`;
  }

  return fs.readFileSync(args.path, "utf8");
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
];

const tools = tool_defs.map((item) => ({
  name: item.name,
  description: item.description,
  input_schema: {
    ...toJSONSchema(item.args),
    type: "object" as const,
  },
}));

console.log(JSON.stringify(tools, null, 2));

const executeTool = (tool_name: string, args: any) => {
  const tool = tool_defs.find((tool) => tool.name === tool_name);
  if (!tool) {
    return "Tool not found";
  }
  // Execute and validate that we have the right tools
  return tool.execute(tool.args.parse(args));
};

const run = async () => {
  console.log(chalk.cyanBright("Welcome to Amie!"));

  // Define a new array to store past messages
  const conversations: Anthropic.MessageParam[] = [];
  let processUserInput: boolean = true;

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

    const completion = await client.messages.create({
      model: "glm-5.1",
      messages: conversations,
      max_tokens: 4096,
      tools: tools,
    });

    // Iterate over each potential response in completion
    for (const message of completion.content) {
      switch (message.type) {
        case "text": {
          conversations.push({ role: "assistant", content: message.text });
          console.log(chalk.blue(`Claude: ${message.text}`));
          break;
        }
        case "tool_use": {
          console.log(chalk.yellow(`tool: ${message.name}(${JSON.stringify(message.input)})`));
          conversations.push({
            role: "assistant",
            content: [
              {
                id: message.id,
                input: message.input,
                name: message.name,
                type: "tool_use",
              },
            ],
          });
          const tool_execution_result = executeTool(message.name, message.input);
          conversations.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: message.id,
                content: tool_execution_result,
              },
            ],
          });

          // Set to skip
          processUserInput = false;
          break;
        }
        default: {
          console.log("Unknown message type:", JSON.stringify(message));
        }
      }
    }
  }

  console.log("Exiting...");
};

run();
