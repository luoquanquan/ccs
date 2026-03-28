import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const MARKER_START = "# CCS_START";
export const MARKER_END = "# CCS_END";

export function detectShellRcPath(shell = process.env.SHELL || "") {
  const home = os.homedir();
  const normalized = path.basename(shell);

  if (process.platform === "win32") {
    return path.join(home, "Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
  }

  if (normalized.includes("zsh")) return path.join(home, ".zshrc");
  if (normalized.includes("bash")) return path.join(home, ".bashrc");
  if (normalized.includes("fish")) return path.join(home, ".config", "fish", "config.fish");

  return path.join(home, ".profile");
}

export function quoteForShell(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function buildEnvLines(envVars, platform = process.platform) {
  return Object.entries(envVars)
    .map(([key, value]) => {
      if (platform === "win32") {
        return `$env:${key} = ${JSON.stringify(String(value))}`;
      }

      return `export ${key}=${quoteForShell(value)}`;
    })
    .join("\n");
}

function buildUnsetLine(key, platform = process.platform) {
  if (platform === "win32") {
    return `Remove-Item Env:${key} -ErrorAction SilentlyContinue`;
  }
  return `unset ${key}`;
}

export function extractMarkerKeys(source) {
  const match = source.match(
    new RegExp(`${MARKER_START}([\\s\\S]*?)${MARKER_END}`),
  );
  if (!match) return [];
  return [...match[1].matchAll(/^export\s+(\w+)=/gm)].map((m) => m[1]);
}

export function buildMarkerBlock(envVars, unsetKeys = [], platform = process.platform) {
  const parts = [];
  if (unsetKeys.length > 0) {
    parts.push(unsetKeys.map((k) => buildUnsetLine(k, platform)).join("\n"));
  }
  const envLines = buildEnvLines(envVars, platform);
  if (envLines) parts.push(envLines);
  return [MARKER_START, ...parts, MARKER_END].join("\n");
}

export function hasMarkerBlock(source) {
  return source.includes(MARKER_START) && source.includes(MARKER_END);
}

export async function updateShellRc(rcPath, envVars, unsetKeys = []) {
  let content = "";
  try {
    content = await readFile(rcPath, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  await writeFile(rcPath, replaceMarkerBlock(content, envVars, unsetKeys), "utf8");
}

export function replaceMarkerBlock(source, envVars, unsetKeys = [], platform = process.platform) {
  const block = buildMarkerBlock(envVars, unsetKeys, platform);
  const pattern = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`, "g");

  if (hasMarkerBlock(source)) {
    return source.replace(pattern, block);
  }

  return `${source.trimEnd()}\n\n${block}\n`;
}
