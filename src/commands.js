import fs from "node:fs/promises";
import chalk from "chalk";
import inquirer from "inquirer";
import { table, getBorderCharacters } from "table";
import { v4 as uuid } from "uuid";
import {
  backupFile,
  CCS_CONFIG,
  CLAUDE_SETTINGS,
  getConfig,
  readJsonFile,
  saveConfig,
  writeJsonFile,
} from "./config.js";
import {
  detectShellRcPath,
  extractMarkerKeys,
  hasMarkerBlock,
  quoteForShell,
  updateShellRc,
} from "./shellrc.js";
import {
  PRESETS,
  buildPresetProvider,
  findProviderByName,
  normalizeProxyEnvVars,
  pingProvider,
  splitEnvVars,
} from "./providers.js";
import {
  promptEnvVars,
  promptNameAndDescription,
  promptProviderSelection,
} from "./prompts.js";
import { formatLastUsedAt, maskSecret } from "./format.js";

export async function initCommand() {
  const config = await getConfig();
  const settings = await readJsonFile(CLAUDE_SETTINGS, {});
  const env = settings?.env ?? {};
  const hasAnthropicConfig =
    typeof env.ANTHROPIC_BASE_URL === "string" &&
    env.ANTHROPIC_BASE_URL.length > 0 &&
    typeof env.ANTHROPIC_AUTH_TOKEN === "string" &&
    env.ANTHROPIC_AUTH_TOKEN.length > 0;

  if (hasAnthropicConfig) {
    const existingNames = new Set((config.providers ?? []).map((p) => p.name));
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "请输入服务商名称",
        validate: (input) => {
          const value = input.trim();
          if (!value) return "名称不能为空";
          if (existingNames.has(value)) return "名称必须唯一";
          return true;
        },
        filter: (input) => input.trim(),
      },
      {
        type: "input",
        name: "description",
        message: "请输入描述（可选）",
        filter: (input) => input.trim(),
      },
    ]);

    const provider = {
      id: uuid(),
      name: answers.name,
      description: answers.description || "",
      isBuiltin: false,
      envVars: {
        ANTHROPIC_BASE_URL: env.ANTHROPIC_BASE_URL,
        ANTHROPIC_AUTH_TOKEN: env.ANTHROPIC_AUTH_TOKEN,
      },
      lastUsedAt: null,
    };

    config.providers = [...(config.providers ?? []), provider];
    await saveConfig(config);
    console.log(`✓ 已导入现有配置为 "${provider.name}"`);
  } else {
    console.log("✓ Anthropic 内置服务商已就绪");
  }

  console.log("提示：运行 ccs completion >> ~/.zshrc && source ~/.zshrc 安装 tab 补全");
}

export async function listCommand() {
  const config = await getConfig();
  const providers = config.providers ?? [];

  if (providers.length === 0) {
    console.log(chalk.yellow("暂无服务商"));
    return;
  }

  const latencies = await Promise.all(providers.map(pingProvider));

  const header = ["名称", "描述", "最后使用时间", "延迟", "状态"].map((h) => chalk.gray(h));
  const dataRows = providers.map((provider, i) => {
    const isCurrent = config.current === provider.id;
    const name = isCurrent ? chalk.green(`✓ ${provider.name}`) : provider.name;
    const lat = latencies[i];
    const latencyStr =
      lat === null
        ? chalk.gray("-")
        : typeof lat === "number"
          ? chalk.green(`${lat}ms`)
          : chalk.red(lat);
    return [
      name,
      provider.description || "-",
      formatLastUsedAt(provider.lastUsedAt),
      latencyStr,
      isCurrent ? chalk.green("当前") : "",
    ];
  });

  console.log(
    table([header, ...dataRows], {
      border: getBorderCharacters("norc"),
      columnDefault: { paddingLeft: 1, paddingRight: 1 },
      drawHorizontalLine: () => true,
    }),
  );
}

export async function addCommand(preset) {
  const config = await getConfig();
  const providers = config.providers ?? [];

  let name, description, envVars;

  if (preset) {
    const partial = buildPresetProvider(preset, providers);
    const { token } = await inquirer.prompt([
      { type: "input", name: "token", message: `请输入 ${partial.description} 的 API Token：` },
    ]);
    ({ name, description } = partial);
    envVars = { ...partial.envVars, ANTHROPIC_AUTH_TOKEN: token };
  } else {
    ({ name, description } = await promptNameAndDescription(providers));
    const { baseUrl, token } = await inquirer.prompt([
      {
        type: "input",
        name: "baseUrl",
        message: "请输入 ANTHROPIC_BASE_URL：",
        validate: (input) => input.trim() ? true : "不能为空",
        filter: (input) => input.trim(),
      },
      {
        type: "input",
        name: "token",
        message: "请输入 ANTHROPIC_AUTH_TOKEN：",
        validate: (input) => input.trim() ? true : "不能为空",
        filter: (input) => input.trim(),
      },
    ]);
    console.log(chalk.gray("以下为自定义环境变量（可选），直接回车跳过"));
    const extraEnvVars = await promptEnvVars();
    envVars = { ANTHROPIC_BASE_URL: baseUrl, ANTHROPIC_AUTH_TOKEN: token, ...extraEnvVars };
  }

  config.providers = [
    ...providers,
    { id: uuid(), name, description: description || "", isBuiltin: false, envVars, lastUsedAt: null },
  ];
  await saveConfig(config);
  console.log(chalk.green(`✓ 已添加服务商 "${name}"`));
}

export async function useCommand(name) {
  const config = await getConfig();
  const providers = config.providers ?? [];
  let targetName = name;

  if (!targetName) {
    if (!process.stdin.isTTY) {
      console.log("用法：ccs use <服务商名称>");
      console.log("      ccs list     查看所有服务商");
      return;
    }
    targetName = await promptProviderSelection(providers, "请选择服务商", config.current);
  }

  const provider = findProviderByName(providers, targetName);

  if (provider.id === config.current) {
    console.log(chalk.yellow(`已经是当前服务商：${provider.name}`));
    return;
  }

  const previousProvider = providers.find((p) => p.id === config.current);
  const proxyChanged =
    JSON.stringify(normalizeProxyEnvVars(previousProvider?.envVars)) !==
    JSON.stringify(normalizeProxyEnvVars(provider.envVars));

  const settings = await readJsonFile(CLAUDE_SETTINGS, {});
  try {
    await backupFile();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await writeJsonFile(CLAUDE_SETTINGS, settings);
    await backupFile();
  }

  const { proxyEnvVars, appEnvVars } = splitEnvVars(provider.envVars ?? {});
  await writeJsonFile(CLAUDE_SETTINGS, { ...settings, env: appEnvVars });

  const rcPath = detectShellRcPath();
  if (Object.keys(proxyEnvVars).length > 0) {
    await updateShellRc(rcPath, proxyEnvVars);
  } else {
    // Read once to check for existing marker block
    let rcContent = "";
    try {
      rcContent = await fs.readFile(rcPath, "utf8");
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
    }
    if (hasMarkerBlock(rcContent)) {
      await updateShellRc(rcPath, {}, extractMarkerKeys(rcContent));
    }
  }

  config.current = provider.id;
  provider.lastUsedAt = new Date().toISOString();
  await saveConfig(config);

  console.log(chalk.green(`✓ 已切换到 ${provider.name}，重启 Claude Code 生效`));
  if (proxyChanged) {
    console.log(`  请执行：source ${rcPath} 使代理立即生效`);
  }
}

export async function editCommand(name) {
  const config = await getConfig();
  const providers = config.providers ?? [];
  const targetName = name ?? await promptProviderSelection(providers, "请选择要编辑的服务商", config.current);
  const provider = findProviderByName(providers, targetName);

  const answers = await promptNameAndDescription(providers, provider);
  const envVars = await promptEnvVars(provider.envVars ?? {}, "edit");

  if (!provider.isBuiltin) provider.name = answers.name;
  provider.description = answers.description || "";
  provider.envVars = envVars;

  await saveConfig(config);
  console.log(chalk.green(`✓ 已更新服务商 "${provider.name}"`));
}

export async function removeCommand(name) {
  const config = await getConfig();
  const providers = config.providers ?? [];
  let targetName = name;

  if (!targetName) {
    const removable = providers.filter((p) => !p.isBuiltin);
    if (removable.length === 0) throw new Error("没有可删除的服务商");
    targetName = await promptProviderSelection(removable, "请选择要删除的服务商", config.current);
  }

  const provider = findProviderByName(providers, targetName);
  if (provider.isBuiltin) throw new Error("内置服务商不可删除");
  if (config.current === provider.id) {
    throw new Error("当前正在使用的服务商不可删除，请先切换到其他服务商");
  }

  config.providers = providers.filter((p) => p.id !== provider.id);
  await saveConfig(config);
  console.log(chalk.green(`✓ 已删除服务商 "${provider.name}"`));
}

export async function currentCommand() {
  const config = await getConfig();
  const provider = (config.providers ?? []).find((p) => p.id === config.current);

  if (!provider) {
    console.log(chalk.yellow("未设置当前服务商"));
    return;
  }

  console.log(`当前服务商：${provider.name}`);
  console.log(`描述：${provider.description || "-"}`);
  console.log(`内置：${provider.isBuiltin ? "是" : "否"}`);
  console.log(`最后使用：${formatLastUsedAt(provider.lastUsedAt)}`);
  console.log("环境变量：");

  for (const [key, value] of Object.entries(provider.envVars ?? {})) {
    const isSensitive = /TOKEN|SECRET|KEY|PASSWORD|AUTH/i.test(key);
    const display = isSensitive ? maskSecret(String(value)) : chalk.dim(String(value));
    console.log(`  ${key}=${display}`);
  }
}

export async function proxyCommand(url) {
  const config = await getConfig();
  const providers = config.providers ?? [];
  const anthropic = providers.find((p) => p.name === "anthropic");
  if (!anthropic) throw new Error('找不到服务商 "anthropic"');

  const currentProxy = anthropic.envVars?.HTTP_PROXY || "";
  let nextUrl = url;

  if (!nextUrl) {
    console.log(`当前代理：${currentProxy || "（未设置）"}`);
    const { inputUrl } = await inquirer.prompt([
      {
        type: "input",
        name: "inputUrl",
        message: "请输入新代理地址",
        default: currentProxy,
        filter: (input) => input.trim(),
      },
    ]);
    nextUrl = inputUrl;
    if (!nextUrl || nextUrl === currentProxy) {
      console.log("未作修改");
      return;
    }
  }

  anthropic.envVars = { ...(anthropic.envVars ?? {}), HTTP_PROXY: nextUrl, HTTPS_PROXY: nextUrl };
  await saveConfig(config);

  if (config.current === anthropic.id) {
    const rcPath = detectShellRcPath();
    await updateShellRc(rcPath, { HTTP_PROXY: nextUrl, HTTPS_PROXY: nextUrl });
    console.log(chalk.green(`✓ 代理已更新为 ${nextUrl}`));
    console.log(`  请执行：source ${rcPath} 使代理立即生效`);
    return;
  }

  console.log(chalk.green(`✓ 代理已更新为 ${nextUrl}（切换到 anthropic 后生效）`));
}

export async function exportCommand(filePath) {
  const config = await getConfig();
  const providers = (config.providers ?? []).map(({ id: _id, lastUsedAt: _ts, ...rest }) => rest);
  const payload = JSON.stringify({ version: "1", exportedAt: new Date().toISOString(), providers }, null, 2);

  if (filePath) {
    await fs.writeFile(filePath, `${payload}\n`, "utf8");
    await fs.chmod(filePath, 0o600);
    console.log(chalk.green(`✓ 已导出 ${providers.length} 个服务商到 ${filePath}`));
    console.log(chalk.yellow("  注意：文件包含 API token，请妥善保管"));
  } else {
    console.log(payload);
  }
}

export async function importCommand(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    throw new Error(`读取文件失败：${filePath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("文件格式错误，不是有效的 JSON");
  }

  if (!Array.isArray(parsed.providers)) {
    throw new Error("文件格式错误，缺少 providers 字段");
  }

  const config = await getConfig();
  const existingNames = new Set((config.providers ?? []).map((p) => p.name));
  let added = 0;
  let skipped = 0;

  for (const provider of parsed.providers) {
    if (!provider.name || !provider.envVars) { skipped++; continue; }
    if (existingNames.has(provider.name)) {
      console.log(chalk.yellow(`  跳过 "${provider.name}"（已存在）`));
      skipped++;
      continue;
    }
    config.providers.push({ ...provider, id: uuid(), lastUsedAt: null, isBuiltin: false });
    existingNames.add(provider.name);
    added++;
  }

  await saveConfig(config);
  console.log(chalk.green(`✓ 导入完成：新增 ${added} 个，跳过 ${skipped} 个`));
}

export async function completionCommand() {
  const config = await readJsonFile(CCS_CONFIG, { providers: [] });
  const providers = (config.providers ?? []).map((p) => p.name);
  const shell = process.env.SHELL || "";

  if (shell.includes("bash")) {
    const providerList = providers.map((p) => quoteForShell(p)).join(" ");
    console.log(`_ccs_completion() {
  local providers="${providerList}"
  local cmd="\${COMP_WORDS[1]}"
  case "$cmd" in
    use|u|edit|e|remove|rm)
      COMPREPLY=($(compgen -W "$providers" -- "\${COMP_WORDS[COMP_CWORD]}"))
      ;;
  esac
}
complete -F _ccs_completion ccs`);
    return;
  }

  const providerList = providers.map((p) => quoteForShell(p)).join(" ");
  console.log(`#compdef ccs
_ccs() {
  local providers
  providers=(${providerList})
  case $words[2] in
    use|u|edit|e|remove|rm)
      _describe 'provider' providers
      ;;
  esac
}
_ccs "$@"`);
}
