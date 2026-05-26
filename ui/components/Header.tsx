import { Box, Text } from "ink";
import type { SessionRuntime } from "../../core/types.ts";

const STARTUP_CAT = `  /\\__/\\
 (=^.^=)
 (")_(")`;

export type HeaderProps = {
  session: SessionRuntime | null;
  filePath: string | null;
};

export function Header({ session, filePath }: HeaderProps) {
  if (!session) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>{STARTUP_CAT}</Text>
        <Text dimColor>加载中…</Text>
      </Box>
    );
  }

  const mode = session.resumed ? "恢复会话" : "新会话";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>{STARTUP_CAT}</Text>
      <Text dimColor>
        {mode} · {session.model} · {session.sessionId}
      </Text>
      {filePath && <Text dimColor>{filePath}</Text>}
    </Box>
  );
}
