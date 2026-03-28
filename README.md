# ccs — Claude Code 服务商切换器

用于管理和快速切换 Claude Code 服务商配置的命令行工具。支持内置 Anthropic 服务商（含代理注入）和任意自定义服务商。

## 安装

```bash
npm install -g claude-code-provider-switcher
```

或不安装直接运行：

```bash
node bin/ccs.js
```

## 快速开始

```bash
# 首次初始化：导入现有配置或确认 Anthropic 已就绪
ccs init

# 安装 tab 补全
ccs completion >> ~/.zshrc && source ~/.zshrc

# 查看所有服务商
ccs list

# 切换服务商
ccs use kimi
```

## 命令列表

| 命令 | 别名 | 说明 |
|------|------|------|
| `ccs` | — | 无参数时交互式选择服务商 |
| `ccs init` | — | 首次初始化向导，自动导入现有配置 |
| `ccs list` | `ls` | 以表格形式列出所有服务商 |
| `ccs add` | `a` | 交互式添加服务商 |
| `ccs add --preset <名称>` | `-p` | 使用预设模板添加服务商（见下方） |
| `ccs use [名称]` | `u` | 切换到指定服务商 |
| `ccs edit [名称]` | `e` | 编辑服务商配置 |
| `ccs remove [名称]` | `rm` | 删除服务商 |
| `ccs current` | `c` | 显示当前激活的服务商详情 |
| `ccs proxy [地址]` | `p` | 查看或设置 Anthropic 服务商的代理地址 |
| `ccs export [文件]` | — | 导出服务商配置（不指定文件则输出到 stdout） |
| `ccs import <文件>` | — | 从 JSON 文件导入服务商配置 |
| `ccs completion` | — | 输出 shell 补全脚本 |

## 预设服务商

使用 `ccs add --preset <名称>` 可跳过手动填写 URL，只需提供 API Token。

| 预设名 | 服务商 |
|--------|--------|
| `kimi` | 月之暗面 Kimi |
| `glm` | 智谱 GLM |
| `qwen` | 阿里云 Qwen |
| `openrouter` | OpenRouter |
| `deepseek` | DeepSeek |

```bash
ccs add --preset deepseek
# 提示输入 DeepSeek API Token
```

## 切换原理

执行 `ccs use <名称>` 时，工具依次：

1. 将 `~/.claude/settings.json` 备份到 `~/.claude/ccs-data/settings.backup.json`
2. 把服务商的非代理环境变量写入 `~/.claude/settings.json` 的 `env` 字段（完全替换）
3. 更新 shell rc 文件中 `# CCS_START` / `# CCS_END` 标记块内的代理变量
4. 更新 `~/.claude/ccs-data/config.json` 中的 `current` 和 `lastUsedAt`

**代理变量**（`HTTP_PROXY`、`HTTPS_PROXY`）写入 shell rc 文件，需执行 `source <rc文件>` 立即生效。**其他变量**（如 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`）在重启 Claude Code 后生效。

## 添加自定义服务商

```bash
ccs add
# 依次提示：名称、描述
# 然后必填：ANTHROPIC_BASE_URL、ANTHROPIC_AUTH_TOKEN
# 最后可选：自定义 KEY=VALUE（直接回车跳过）
```

示例：

```
名称：my-proxy
描述：我的中转服务
ANTHROPIC_BASE_URL：https://your-proxy.example.com
ANTHROPIC_AUTH_TOKEN：sk-your-token
以下为自定义环境变量（可选），直接回车跳过
KEY=VALUE（留空结束）：
```

## 导出与导入

```bash
# 导出到文件（包含 Token，请妥善保管）
ccs export providers.json

# 导入（同名服务商自动跳过，isBuiltin 强制为 false）
ccs import providers.json
```

导出的 JSON 不包含 `id` 和 `lastUsedAt` 字段，便于跨设备迁移。

## 文件路径

| 文件 | 用途 |
|------|------|
| `~/.claude/ccs-data/config.json` | 服务商列表及当前选中项 |
| `~/.claude/settings.json` | Claude Code 配置（切换时写入） |
| `~/.claude/ccs-data/settings.backup.json` | 每次切换前的自动备份 |

## Shell RC 文件检测

工具根据 `$SHELL` 自动选择 rc 文件：

| Shell | 文件 |
|-------|------|
| zsh | `~/.zshrc` |
| bash | `~/.bashrc` |
| fish | `~/.config/fish/config.fish` |
| PowerShell | `$PROFILE` |
| 其他 | `~/.profile` |

## 开发

```bash
# 运行所有测试
npm test

# 只运行匹配名称的测试
node --test --test-name-pattern "ccs use" test/**/*.test.js

# 发布新版本（自动测试 → 更新版本号 → git tag + push → npm publish）
npm run publish          # 默认 patch
npm run publish minor
npm run publish 1.2.3
```
