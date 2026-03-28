import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export async function createTempHome(prefix = "ccs-test-") {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function removeTempHome(homeDir) {
  await fs.rm(homeDir, { recursive: true, force: true });
}

export async function importFresh(testFileUrl, relativePath) {
  const absPath = path.resolve(path.dirname(fileURLToPath(testFileUrl)), relativePath);
  const moduleUrl = pathToFileURL(absPath);
  moduleUrl.searchParams.set("t", `${Date.now()}-${Math.random()}`);
  return import(moduleUrl.href);
}

export function claudeDir(homeDir) {
  return path.join(homeDir, ".claude");
}

export function ccsDataDir(homeDir) {
  return path.join(claudeDir(homeDir), "ccs-data");
}

export function configPath(homeDir) {
  return path.join(ccsDataDir(homeDir), "config.json");
}

export function settingsPath(homeDir) {
  return path.join(claudeDir(homeDir), "settings.json");
}

export function backupPath(homeDir) {
  return path.join(ccsDataDir(homeDir), "settings.backup.json");
}

export function shellRcPath(homeDir) {
  return path.join(homeDir, ".zshrc");
}

export async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function runCli(homeDir, args, extraEnv = {}) {
  return execFileAsync(process.execPath, ["bin/ccs.js", ...args], {
    cwd: projectRoot,
    env: { ...process.env, ...extraEnv, HOME: homeDir },
  });
}

export async function runCcsCapture(homeDir, args, extraEnv = {}) {
  try {
    const result = await execFileAsync(process.execPath, ["bin/ccs.js", ...args], {
      cwd: projectRoot,
      env: { ...process.env, ...extraEnv, HOME: homeDir },
      timeout: 5000,
      killSignal: "SIGKILL",
    });
    return { ...result, exitCode: 0 };
  } catch (error) {
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      exitCode: typeof error.code === "number" ? error.code : 1,
    };
  }
}
