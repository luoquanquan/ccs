import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { v4 as uuid } from "uuid";
import inquirer from "inquirer";

const DEFAULT_PROXY = "http://127.0.0.1:7890";

const home = os.homedir();
const ccsDataDir = path.join(home, ".claude", "ccs-data");
export const CCS_CONFIG = path.join(home, ".claude", "ccs-data", "config.json");
export const CLAUDE_SETTINGS = path.join(home, ".claude", "settings.json");
export const SETTINGS_BACKUP = path.join(home, ".claude", "ccs-data", "settings.backup.json");

export async function readJsonFile(filePath, fallback = {}) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`配置文件损坏，请手动检查或删除：${filePath}\n原因：${err.message}`);
  }
}

export async function writeJsonFile(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, `${content}\n`, "utf8");
  await fs.chmod(filePath, 0o600);
}

export async function backupFile() {
  await fs.copyFile(CLAUDE_SETTINGS, SETTINGS_BACKUP);
  return SETTINGS_BACKUP;
}

export async function ensureConfig() {
  await fs.mkdir(ccsDataDir, { recursive: true });

  let exists = false;
  try {
    await fs.access(CCS_CONFIG);
    exists = true;
  } catch {
    // file does not exist, will create below
  }

  if (exists) {
    const config = await readJsonFile(CCS_CONFIG); // throws on corrupt JSON
    return { created: false, config };
  }

  {
    let proxyUrl = DEFAULT_PROXY;
    if (process.stdin.isTTY) {
      const { enableProxy } = await inquirer.prompt([
        { type: "confirm", name: "enableProxy", message: `是否启用代理？（默认：${DEFAULT_PROXY}）`, default: true },
      ]);
      if (enableProxy) {
        const { inputUrl } = await inquirer.prompt([
          { type: "input", name: "inputUrl", message: "请输入代理地址", default: DEFAULT_PROXY, filter: (s) => s.trim() },
        ]);
        proxyUrl = inputUrl || DEFAULT_PROXY;
      } else {
        proxyUrl = null;
      }
    }

    const builtinId = uuid();
    const envVars = proxyUrl ? { HTTP_PROXY: proxyUrl, HTTPS_PROXY: proxyUrl } : {};
    const config = {
      current: builtinId,
      providers: [
        {
          id: builtinId,
          name: "anthropic",
          description: "官方 Anthropic（默认）",
          isBuiltin: true,
          envVars,
          lastUsedAt: null,
        },
      ],
    };

    await writeJsonFile(CCS_CONFIG, config);
    return { created: true, config };
  }
}

export async function getConfig() {
  const { config } = await ensureConfig();
  return config;
}

export async function saveConfig(config) {
  await writeJsonFile(CCS_CONFIG, config);
}

export async function readConfig() {
  return {
    config: await readJsonFile(CCS_CONFIG, {}),
    settings: await readJsonFile(CLAUDE_SETTINGS, {}),
  };
}

export async function writeConfig(nextData) {
  await writeJsonFile(CCS_CONFIG, nextData?.config ?? {});
  await writeJsonFile(CLAUDE_SETTINGS, nextData?.settings ?? {});
}
