import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import {
  backupPath,
  claudeDir,
  createTempHome,
  importFresh,
  readJson,
  removeTempHome,
  settingsPath,
} from "./helpers.js";

let homeDir;
let originalHome;
let configModule;

before(async () => {
  originalHome = process.env.HOME;
  homeDir = await createTempHome("ccs-config-");
  process.env.HOME = homeDir;
  configModule = await importFresh(import.meta.url, "../src/config.js");
});

after(async () => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  await removeTempHome(homeDir);
});

test("readJsonFile returns fallback when file is missing", async () => {
  const fallback = { ok: true };
  const missingPath = path.join(homeDir, "missing.json");

  const result = await configModule.readJsonFile(missingPath, fallback);

  assert.deepEqual(result, fallback);
});

test("readJsonFile throws a path-aware error for invalid JSON", async () => {
  const filePath = path.join(homeDir, "broken.json");
  await fs.writeFile(filePath, "{broken", "utf8");

  await assert.rejects(
    configModule.readJsonFile(filePath, {}),
    (error) =>
      error instanceof Error &&
      error.message.includes(filePath) &&
      error.message.includes("配置文件损坏"),
  );
});

test("readJsonFile returns parsed JSON for a valid file", async () => {
  const filePath = path.join(homeDir, "valid.json");
  const payload = { providers: [{ name: "demo" }] };
  await fs.writeFile(filePath, JSON.stringify(payload), "utf8");

  const result = await configModule.readJsonFile(filePath, {});

  assert.deepEqual(result, payload);
});

test("ensureConfig creates config.json and parent directory on first call", async () => {
  await fs.rm(claudeDir(homeDir), { recursive: true, force: true });

  const result = await configModule.ensureConfig();
  const saved = await readJson(configModule.CCS_CONFIG);

  assert.equal(result.created, true);
  assert.ok(result.config.current);
  assert.equal(saved.current, result.config.current);
  assert.equal(saved.providers.length, 1);
});

test("ensureConfig does not overwrite an existing config", async () => {
  const existing = {
    current: "custom-id",
    providers: [{ id: "custom-id", name: "custom", isBuiltin: false, envVars: {}, lastUsedAt: null }],
  };
  await fs.mkdir(path.dirname(configModule.CCS_CONFIG), { recursive: true });
  await fs.writeFile(configModule.CCS_CONFIG, `${JSON.stringify(existing, null, 2)}\n`, "utf8");

  const result = await configModule.ensureConfig();
  const saved = await readJson(configModule.CCS_CONFIG);

  assert.equal(result.created, false);
  assert.deepEqual(result.config, existing);
  assert.deepEqual(saved, existing);
});

test("ensureConfig throws on corrupt config.json instead of resetting", async () => {
  await fs.mkdir(path.dirname(configModule.CCS_CONFIG), { recursive: true });
  await fs.writeFile(configModule.CCS_CONFIG, "INVALID_JSON", "utf8");

  await assert.rejects(
    () => configModule.ensureConfig(),
    (error) => error instanceof Error && error.message.includes("配置文件损坏") && error.message.includes(configModule.CCS_CONFIG),
  );
});

test("saveConfig and getConfig round-trip data", async () => {
  const nextConfig = {
    current: "provider-1",
    providers: [
      {
        id: "provider-1",
        name: "provider-1",
        description: "test provider",
        isBuiltin: false,
        envVars: { ANTHROPIC_BASE_URL: "https://example.com" },
        lastUsedAt: "2026-03-28T00:00:00.000Z",
      },
    ],
  };

  await configModule.saveConfig(nextConfig);

  const loaded = await configModule.getConfig();

  assert.deepEqual(loaded, nextConfig);
});

test("writeConfig writes isolated settings files under the temp HOME", async () => {
  const payload = {
    config: { current: "x", providers: [] },
    settings: { env: { FOO: "bar" } },
  };

  await configModule.writeConfig(payload);

  assert.deepEqual(await readJson(configModule.CCS_CONFIG), payload.config);
  assert.deepEqual(await readJson(settingsPath(homeDir)), payload.settings);
  assert.equal(backupPath(homeDir).startsWith(homeDir), true);
});
