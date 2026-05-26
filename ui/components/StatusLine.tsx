import { Box, Text } from "ink";

export type StatusLineProps = {
  statusText: string;
  error: string | null;
  toolMismatchWarning: string | null;
  isBusy: boolean;
};

export function StatusLine({ statusText, error, toolMismatchWarning, isBusy }: StatusLineProps) {
  return (
    <Box flexDirection="column" marginTop={0}>
      {toolMismatchWarning && <Text color="yellow">{toolMismatchWarning}</Text>}
      {error && <Text color="red">{error}</Text>}
      <Text dimColor>
        {isBusy ? "⏳ " : ""}
        {statusText}
      </Text>
    </Box>
  );
}
