# scratch

一个自用的 **终端 Agent 练手项目**：基于 [Bun](https://bun.com)、[@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) 与 **React + Ink**（与 Claude Code 同款终端 UI），在 TUI 中与模型对话，并调用本地工具完成简单任务。

## 功能

- **Ink 终端 UI**：上方聊天记录区展示 User /「小喵」/ Thinking / 工具调用；底部输入框发送消息
- **流式对话**：实时更新助手回复与 Thinking 内容
- **Extended Thinking**：启用模型的思考块，并写入会话记录
- **工具调用**：模型可调用以下内置工具
  - `read_file` — 读取文件
  - `list_file` — 列出目录
  - `create_file` — 创建文件
  - `edit_file` — 编辑文件
  - `bash` — 执行 shell 命令
- **可配置系统提示词**：按当前工作目录等上下文在启动时生成 system prompt
- **会话持久化（JSONL）**
  - 新会话自动生成 `session-id`
  - 记录写入 `~/.scratch/projects/<项目slug>/<session-id>.jsonl`
  - 首行为 meta（系统提示词、工具定义、模型等），之后每行一条消息
  - 项目 slug 按 git 仓库根目录（或 cwd）编码，规则参考 Claude Code
- **恢复会话**：`-r` / `--resume` 加载历史对话，在聊天记录区展示后继续聊

## 环境要求

- [Bun](https://bun.com) ≥ 1.3
- 可访问的 Anthropic 兼容 API（通过环境变量配置）

## 配置

在项目根目录配置环境变量（Bun 会自动加载 `.env`）：

```bash
ANTHROPIC_API_KEY=your_api_key
# 可选：自定义 API 地址（代理或兼容端点）
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

## 安装

```bash
bun install
```

## 使用

**启动新会话**

```bash
bun run start
# 或开发模式（热重载）
bun run dev
```

启动后顶部显示 session-id 与会话文件路径；在底部输入框输入消息后 **Enter** 发送；输入 `q` 或 `quit` 退出。

**快捷键**

| 按键 | 作用 |
|------|------|
| Enter | 发送消息 |
| `q` / `quit` | 退出 |
| `Ctrl+C` | 退出 |
| `↑` / `↓` | 滚动聊天记录 |
| `PgUp` / `PgDn` | 翻页滚动 |

**恢复已有会话**

```bash
bun run start -- -r <session-id>
# 示例
bun run start -- -r 550e8400-e29b-41d4-a716-446655440000
```

历史消息会直接显示在聊天记录区（不含 tool result 正文详情）。

**代码检查**

```bash
bun run check
```

## 项目结构（简要）

```
ui/                   # React + Ink 终端 UI
core/                 # 会话初始化、Agent 轮次、消息展示模型
lib/                  # 客户端、会话存储、CLI 等
prompts/              # 系统提示词构建
tools/                # 工具定义与注册
agent.ts              # 兼容入口（转发至 ui/main.tsx）
```

## 说明

本项目仅供个人学习与实验，未做生产级安全与权限隔离；`bash` 等工具会在本机真实执行命令，请在可信环境中使用。
