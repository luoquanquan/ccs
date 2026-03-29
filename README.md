<div align="center">

# 🎛️ CCS — Claude Code Switcher

**专为 [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) 打造的服务商无缝切换器**

[![npm version](https://img.shields.io/npm/v/@luoquanquan/ccs.svg?style=flat-square)](https://www.npmjs.com/package/@luoquanquan/ccs)
[![License](https://img.shields.io/npm/l/@luoquanquan/ccs.svg?style=flat-square)](https://github.com/luoquanquan/ccs/blob/main/LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/luoquanquan/ccs/release.yml?branch=main&style=flat-square)](https://github.com/luoquanquan/ccs/actions)

让您在 **Anthropic 官方节点**、**第三方中转** 及 **国内大模型（Kimi, GLM, Qwen, DeepSeek 等）** 之间实现秒级无缝切换，彻底告别繁琐的环境变量配置。

</div>

---

## ✨ 核心特性

- 🚀 **开箱即用**：内置对官方 Anthropic 以及各类国内模型（DeepSeek、Kimi、通义千问等）的支持。
- 🛡️ **安全隔离代理**：智能区分 `HTTP_PROXY` 代理注入，保护您的官方账号免受频繁切 IP 带来的风控风险。
- ⚡ **交互式界面**：无需记忆长长的命令参数，运行 `ccs` 即可提供现代化的交互式菜单。
- 📦 **配置迁移**：支持导出和导入服务商列表，跨设备同步更轻松。
- 🔄 **自动备份**：每次切换前自动备份您的原始 Claude Code 配置，以防意外丢失。

## 📦 安装

```bash
npm install -g @luoquanquan/ccs
```

## 🎯 快速上手

```bash
# 1️⃣ 首次运行与环境初始化
ccs init

# 2️⃣ 安装自动补全（体验极速盲打）
ccs completion >> ~/.zshrc && source ~/.zshrc

# 3️⃣ 添加您喜欢的服务商（例如 DeepSeek）
ccs add --preset deepseek

# 4️⃣ 切换并起飞！
ccs use deepseek
```

## ⌨️ 常用命令字典

完整的交互能力覆盖了您的所有日常需求：

| 命令 | 别名 | 功能说明 |
|------|------|------|
| `ccs` | — | **(推荐)** 唤起交互式面板，可视化选择并切换 |
| `ccs list` | `ls` | 📊 查看当前所有可用服务商及其网络延迟 |
| `ccs add` | `a` | ➕ 手动添加新的自定义服务商 |
| `ccs use [名称]` | `u` | ⚡ 直接切换到目标服务商 |
| `ccs current` | `c` | 🔍 查看当前正在使用的服务商配置信息 |
| `ccs proxy [地址]` | `p` | 🌐 针对官方节点快速管理全局网络代理配置 |

*完整命令支持：请通过 `ccs --help` 查看包括导入导出、编辑删除在内的全量命令。*

### 💡 预设大模型一键接入

通过 `ccs add --preset <名称>`，您可以直接接入主流的兼容接口，只需输入 API Token，省去查阅 Base URL 的时间。

支持的预设列表：
- `kimi` (月之暗面)
- `glm` (智谱 GLM)
- `qwen` (阿里云 Qwen)
- `deepseek` (深度求索 DeepSeek)
- `openrouter` (OpenRouter 万能聚合)

## 🧠 CCS 是如何工作的？

当您执行 `ccs use <名称>` 切换时，工具会在后台有条不紊地完成以下工作：

1. **安全第一**：将您当前的 `~/.claude/settings.json` 自动备份到 `~/.claude/ccs-data/settings.backup.json`
2. **环境注入**：将目标服务商的环境变量写入 `settings.json` 的 `env` 字段（完全接管）
3. **代理分离**：如果是官方配置，将代理变量（`HTTP_PROXY`/`HTTPS_PROXY`）专门写入您当前 Shell（如 `.zshrc` / `.bashrc`）的标记块中。
4. **状态持久化**：更新本地使用记录及最后切换时间。

> ⚠️ **注意**：代理类的环境变量通过 Shell 文件注入，需执行 `source ~/.zshrc` (或对应文件) 立即生效。其他如 URL 和 Token，在您**下次启动 Claude Code 时**会自动生效。

### 关于网络代理与账号安全
工具在初始化默认的内置 Anthropic 服务商时会提示您配置代理（默认 `http://127.0.0.1:7890`）。**我们强烈建议官方节点使用固定的代理以防范封号风险**，频繁变动的 IP 或者网络异常容易触发 Anthropic 的安全策略。您随时可以通过 `ccs proxy` 命令重新配置或留空以禁用它。

## 🛠️ 进阶：如何添加自定义服务商？

如果预设列表中没有您的中转商或者本地模型（如 Ollama / vLLM），也可以轻松手动添加：

```bash
ccs add
# 依次填写名称和描述
# 输入中转商提供的 ANTHROPIC_BASE_URL (例如: https://api.your-proxy.com)
# 输入 ANTHROPIC_AUTH_TOKEN (你的 API Key)
# [可选] 添加任何你需要的额外环境变量
```

## 👩‍💻 参与开发

我们非常欢迎任何形式的贡献与 PR。

获取源码与测试：
```bash
git clone https://github.com/luoquanquan/ccs.git
cd ccs
npm install

# 运行所有单元测试
npm test
```

### 持续集成与发布
本项目引入了 `semantic-release` 进行自动化版本管理与发布。[查看版本更新日志](./CHANGELOG.md)。
只需遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范提交到 `main` 分支，GitHub Actions 就会包揽剩下的所有工作（测试、Bump、Changelog 并在 npm 自动发布）。

> **开发者部署贴士**：需在 Github 仓库设置中预先配置好 `NPM_TOKEN` Secret，以授予 Action 发布至 npm 仓库的权限。

---
<div align="center">
  <sub>Made with ❤️ by Luo Quanquan & contributors.</sub>
</div>
