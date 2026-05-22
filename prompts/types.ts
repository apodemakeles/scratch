/** 构建系统提示词时的上下文（启动时确定，运行期不变） */
export type SystemPromptContext = {
  readonly cwd: string;
};

/** 构建完成后的系统提示词，运行期只读 */
export type BuiltSystemPrompt = Readonly<{
  text: string;
}>;

/** 根据上下文生成系统提示词；可在启动时选用不同实现 */
export interface SystemPromptBuilder {
  build(context: SystemPromptContext): BuiltSystemPrompt;
}
