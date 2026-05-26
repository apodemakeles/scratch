import { TextInput } from "@inkjs/ui";
import { Box, Text } from "ink";

export type PromptInputProps = {
  isDisabled: boolean;
  onSubmit: (value: string) => void;
};

export function PromptInput({ isDisabled, onSubmit }: PromptInputProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="green">You:</Text>
      <TextInput
        isDisabled={isDisabled}
        placeholder={isDisabled ? "请等待回复…" : "输入消息，Enter 发送"}
        onSubmit={(value) => {
          onSubmit(value);
        }}
      />
    </Box>
  );
}
