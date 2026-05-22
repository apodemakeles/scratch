export type CliOptions = {
  resumeSessionId?: string;
};

/** 解析 `-r <id>` / `--resume <id>` */
export function parseCli(argv = process.argv.slice(2)): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-r" || arg === "--resume") {
      const id = argv[i + 1];
      if (!id || id.startsWith("-")) {
        throw new Error(`${arg} 需要指定 session-id`);
      }
      options.resumeSessionId = id;
      i++;
    }
  }

  return options;
}
