import type Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { anthropicClient } from "./lib/client.ts";
import { toAssistantConversationContent } from "./lib/conversation.ts";
import { getUserInput } from "./lib/input.ts";
import { buildSystemPrompt } from "./prompts/index.ts";
import { apiTools, runTool } from "./tools/index.ts";

const systemPrompt = buildSystemPrompt();

const run = async () => {
  console.log(chalk.cyanBright("Welcome to Scratch!"));

  const conversations: Anthropic.MessageParam[] = [];
  let processUserInput = true;
  const maxTokens = 4096;

  while (true) {
    if (processUserInput) {
      const userInput = await getUserInput();
      if (userInput === "q" || userInput === "quit") {
        break;
      }
      conversations.push({ role: "user", content: userInput });
    }

    processUserInput = true;

    const stream = anthropicClient.messages.stream({
      model: "glm-5.1",
      system: systemPrompt.text,
      messages: conversations,
      max_tokens: maxTokens,
      tools: apiTools,
      thinking: { type: "enabled", budget_tokens: 1024, display: "summarized" } as any,
    });

    let wroteClaudePrefix = false;
    let wroteThinkingPrefix = false;

    stream.on("text", (delta) => {
      if (!wroteClaudePrefix) {
        // thinking 块先输出时，正文前缀需另起一行，否则会接在 Thinking 末尾
        const prefix = wroteThinkingPrefix ? "\nClaude: " : "Claude: ";
        process.stdout.write(chalk.blue(prefix));
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
          const toolExecutionResult = await runTool(tu.name, tu.input);
          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: toolExecutionResult,
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
