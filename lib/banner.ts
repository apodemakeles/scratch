import chalk from "chalk";

/** 启动猫脸 */
const STARTUP_CAT = `        /\\__/\\
       (=^.^=)
       (")_(")`;

/** 退出猫脸 */
const GOODBYE_CAT = `        /\\__/\\
       (= -.=)
       (")_(")`;

const HINT = "  输入开始聊天 · q / quit 退出";
const BYE_MSG = "  喵～下次见";

export type StartupBannerInfo = {
  sessionId: string;
  filePath: string;
  resumed: boolean;
};

export function printStartupBanner(info: StartupBannerInfo): void {
  const mode = info.resumed ? "恢复会话" : "新会话";
  console.log(
    `\n${STARTUP_CAT}\n` +
      `${chalk.dim(HINT)}\n` +
      `${chalk.dim(`  ${mode} · ${info.sessionId}`)}\n` +
      `${chalk.dim(`  ${info.filePath}`)}\n`
  );
}

export function printGoodbye(): void {
  console.log(`\n${GOODBYE_CAT}\n${chalk.cyan(BYE_MSG)}\n`);
}
