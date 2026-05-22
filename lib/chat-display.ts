import chalk from "chalk";

/** 助手在终端中的显示名称 */
export const ASSISTANT_LABEL = "小喵";

export function formatUserLine(text: string): string {
  return `${chalk.green("User:")} ${text}`;
}

export function formatAssistantLine(text: string): string {
  return chalk.blue(`${ASSISTANT_LABEL}: ${text}`);
}

export function formatThinkingLine(text: string): string {
  return chalk.gray(`Thinking: ${text}`);
}

export function formatThinkingRedactedLine(data: string): string {
  return chalk.gray(`Thinking (redacted): ${data}`);
}

export function writeAssistantPrefix(afterThinking: boolean): void {
  const prefix = afterThinking ? `\n${ASSISTANT_LABEL}: ` : `${ASSISTANT_LABEL}: `;
  process.stdout.write(chalk.blue(prefix));
}

export function writeThinkingPrefix(): void {
  process.stdout.write(chalk.gray("\nThinking: "));
}
