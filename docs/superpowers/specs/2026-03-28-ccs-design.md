# CCS — Claude Code Switcher 设计文档

**日期**: 2026-03-28
**状态**: 已批准

---

## 概述

`ccs` 是一款跨平台命令行工具，用于管理和快速切换 Claude Code 的服务商配置。支持内置 Anthropic 服务商（含代理注入）和任意自定义服务商（自定义环境变量）。

---

## 数据模型

配置文件路径：`~/.claude/ccs-data/config.json`

```json
{
  "current": "<provider-uuid>",
  "providers": [
    {
      "id": "<uuid>",
      "name": "anthropic",
      "description": "官方 Anthropic（默认）",
      "isBuiltin": true,
      "envVars": {
        "HTTP_PROXY": "http://127.0.0.1:7890",
        "HTTPS_PROXY": "http://127.0.0.1:7890"
      },
      "lastUsedAt": "2026-03-28T10:00:00.000Z"
    },
    {
      "id": "<uuid>",
      "name": "my-proxy",
      "description": "第三方中转",
      "isBuiltin": false,
      "envVars": {
        "ANTHROPIC_BASE_URL": "https://example.com",
        "ANTHROPIC_AUTH_TOKEN": "sk-xxx"
      },
      "lastUsedAt": null
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `current` | string \| null | 当前激活的 provider id |
| `providers` | array | 所有服务商列表 |
| `id` | string | UUID，自动生成 |
| `name` | string | 服务商名称，唯一 |
| `description` | string | 可选描述 |
| `isBuiltin` | boolean | true 时不可删除、名称不可修改 |
| `envVars` | object | 任意 key-value 环境变量 |
| `lastUsedAt` | string \| null | 最后一次切换到该服务商的 ISO 时间戳 |

### envVars 路由规则

切换时，envVars 按 key 名路由到不同目标：

| 变量 | 写入目标 | 生效方式 |
|------|---------|---------|
| `HTTP_PROXY` / `HTTPS_PROXY` | shell rc 文件标记块 | source rc 文件 |
| 其余所有变量 | `~/.claude/settings.json` → `env` 字段（完全替换） | 重启 Claude Code |

---

## 命令设计

| 命令 | 别名 | 描述 |
|------|------|------|
| `ccs` | — | 无参数时：交互式切换服务商 |
| `ccs init` | — | 首次初始化向导，自动导入现有配置 |
| `ccs list` | `ls` | 列出所有服务商（表格，含最后使用时间） |
| `ccs add` | `a` | 交互式添加服务商 |
| `ccs use [name]` | `u` | 切换服务商（无 name 则交互选择） |
| `ccs edit [name]` | `e` | 编辑服务商配置 |
| `ccs remove [name]` | `rm` | 删除服务商（isBuiltin 不可删） |
| `ccs current` | `c` | 显示当前激活的服务商详情 |
| `ccs proxy [url]` | `p` | 设置代理地址 |
| `ccs completion` | — | 输出 shell 补全脚本 |

### `init` 流程

检测 `~/.claude/settings.json` 中是否存在 `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`：
- 若存在：提示用户为其命名，自动导入为一个新 provider
- 若不存在：跳过，仅确认 `anthropic` 内置 provider 已就绪
- 提示用户执行 `ccs completion` 安装 tab 补全

### `add` 交互流程

1. 输入名称（必填，唯一）
2. 输入描述（可选）
3. 循环添加 env var：输入 `KEY=VALUE`，回车继续，空回车结束

### `use` 切换流程

1. 备份 `~/.claude/settings.json` 到 `~/.claude/ccs-data/settings.backup.json`
2. 将新服务商的非代理 envVars 写入 `settings.json` 的 `env` 字段（完全替换）
3. 更新 shell rc 文件标记块（注入或清空代理变量）
4. 更新 `config.json`：`current` + 该 provider 的 `lastUsedAt`
5. 输出提示：
   - `✓ 已切换到 <name>，重启 Claude Code 生效`
   - 若代理发生变化，追加提示 source 命令

### `proxy` 命令流程

- `ccs proxy` — 显示当前代理地址，交互式提示输入新值（默认值为当前地址）
- `ccs proxy <url>` — 直接设置新代理地址
- 同时更新 `anthropic` provider 的 `HTTP_PROXY` + `HTTPS_PROXY` 至 `config.json`
- 若当前激活的是 `anthropic`，立即同步写入 shell rc 文件并提示 source

### `completion` 命令

输出对应 shell 的补全脚本，内容为补全 provider 名称：

```bash
# 安装（zsh）
ccs completion >> ~/.zshrc && source ~/.zshrc

# 安装（bash）
ccs completion >> ~/.bashrc && source ~/.bashrc
```

补全范围：`use`、`edit`、`remove` 命令的 `[name]` 参数，动态读取 `config.json` 中的 provider 名称列表。

---

## 安全与可靠性

### 自动备份

每次执行 `use` 命令修改 `settings.json` 前，自动备份：
```
~/.claude/ccs-data/settings.backup.json
```
写入失败时自动还原，并输出错误信息。

---

## 跨平台支持

### shell rc 文件检测

```
process.platform === 'win32'
  → PowerShell $PROFILE

process.platform === 'linux' | 'darwin'
  → $SHELL 包含 'zsh'  → ~/.zshrc
  → $SHELL 包含 'bash' → ~/.bashrc
  → 其他               → ~/.profile
```

### 标记块格式

**Unix（bash/zsh）**：
```bash
# CCS_START
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890
# CCS_END
```

**Windows（PowerShell）**：
```powershell
# CCS_START
$env:HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
# CCS_END
```

首次切换时，若 rc 文件中不存在标记块，则追加到文件末尾。

### 生效提示（按平台）

| 平台 | 提示命令 |
|------|---------|
| macOS / Linux | `source ~/.zshrc` 或 `source ~/.bashrc` |
| Windows | `. $PROFILE` |

---

## 文件结构

```
ccs/
├── bin/
│   └── ccs.js          # #!/usr/bin/env node，Commander 入口
├── src/
│   ├── commands.js     # 所有命令 handler
│   ├── config.js       # 读写 config.json + settings.json（含备份）
│   └── shellrc.js      # shell rc 文件标记注入/替换（跨平台）
└── package.json
```

## 依赖

| 包 | 用途 |
|----|------|
| `commander` | 命令解析 |
| `inquirer` | 交互式提示 |
| `chalk` | 终端着色 |
| `uuid` | provider id 生成 |

## package.json 关键配置

```json
{
  "type": "module",
  "bin": { "ccs": "./bin/ccs.js" }
}
```

全局安装：`npm install -g .` 或 `npm link`

---

## 关键路径常量

| 变量 | 路径 |
|------|------|
| CCS_CONFIG | `~/.claude/ccs-data/config.json` |
| CLAUDE_SETTINGS | `~/.claude/settings.json` |
| SETTINGS_BACKUP | `~/.claude/ccs-data/settings.backup.json` |
| SHELL_RC | 按平台动态检测 |

---

## 首次运行行为

首次运行时，若 `config.json` 不存在：
1. 自动创建 `~/.claude/ccs-data/` 目录
2. 预置内置 `anthropic` provider（含默认代理 envVars，`lastUsedAt: null`）
3. 写入 `config.json`，`current` 设为 anthropic 的 id
4. 提示用户运行 `ccs init` 完成初始化
