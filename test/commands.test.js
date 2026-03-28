import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  configPath,
  projectRoot,
  readJson,
  runCli,
  runCcsCapture,
  settingsPath,
  shellRcPath,
  writeJson,
  createTempHome,
  removeTempHome,
} from "./helpers.js";

function makeBuiltin(id = "builtin") {
  return {
    id,
    name: "anthropic",
    description: "官方 Anthropic（默认）",
    isBuiltin: true,
    envVars: {
      HTTP_PROXY: "http://127.0.0.1:7890",
      HTTPS_PROXY: "http://127.0.0.1:7890",
    },
    lastUsedAt: null,
  };
}

function makeProvider(id, name, envVars = {}) {
  return {
    id,
    name,
    description: `${name} provider`,
    isBuiltin: false,
    envVars,
    lastUsedAt: null,
  };
}

async function withTempHome(run) {
  const homeDir = await createTempHome("ccs-commands-");
  try {
    await run(homeDir);
  } finally {
    await removeTempHome(homeDir);
  }
}

test("ccs list prints 暂无服务商 when config has no providers", async () => {
  await withTempHome(async (homeDir) => {
    await writeJson(configPath(homeDir), { current: null, providers: [] });

    const { stdout } = await runCli(homeDir, ["list"]);

    assert.match(stdout, /暂无服务商/);
  });
});

test("ccs list prints a table with headers when providers exist", async () => {
  await withTempHome(async (homeDir) => {
    await writeJson(configPath(homeDir), {
      current: "builtin",
      providers: [makeBuiltin("builtin"), makeProvider("p1", "demo")],
    });

    const { stdout } = await runCli(homeDir, ["list"]);

    assert.match(stdout, /名称/);
    assert.match(stdout, /描述/);
    assert.match(stdout, /最后使用时间/);
    assert.match(stdout, /状态/);
    assert.match(stdout, /demo/);
  });
});

test.skip("ccs add requires an interactive TTY, so add flow is intentionally skipped in execFile integration tests", async () => {
  // Skipped because inquirer prompts need a TTY; these integration tests use child_process.execFile.
  // add (non-preset) flow: name → description → ANTHROPIC_BASE_URL (required) → ANTHROPIC_AUTH_TOKEN (required)
  //   → optional custom KEY=VALUE pairs (empty line to finish)
  // add --preset <name> flow: validates preset exists and is not duplicate, then prompts for API token only.
});

test("ccs with no args prints usage hint and exits 0 when stdin is not a TTY", async () => {
  await withTempHome(async (homeDir) => {
    const result = await runCcsCapture(homeDir, []);

    assert.ok(
      result.exitCode === 0,
      `expected exit 0, got ${result.exitCode}\n${result.stderr}`,
    );
    assert.ok(
      result.stdout.includes("ccs use") || result.stdout.includes("ccs list"),
      `expected usage hint in stdout, got: ${result.stdout}`,
    );
  });
});

test("ccs use updates current provider and writes unset lines when switching to a provider without proxy env", async () => {
  await withTempHome(async (homeDir) => {
    await writeJson(configPath(homeDir), {
      current: "builtin",
      providers: [
        makeBuiltin("builtin"),
        makeProvider("noproxy", "noproxy", { ANTHROPIC_BASE_URL: "https://example.com", ANTHROPIC_AUTH_TOKEN: "token" }),
      ],
    });
    await fs.writeFile(
      shellRcPath(homeDir),
      "# existing\n# CCS_START\nexport HTTP_PROXY='http://127.0.0.1:7890'\nexport HTTPS_PROXY='http://127.0.0.1:7890'\n# CCS_END\n",
      "utf8",
    );

    const { stdout } = await runCli(homeDir, ["use", "noproxy"], { SHELL: "/bin/zsh" });
    const config = await readJson(configPath(homeDir));
    const rcContent = await fs.readFile(shellRcPath(homeDir), "utf8");
    const settings = await readJson(settingsPath(homeDir));

    assert.match(stdout, /已切换到 noproxy/);
    assert.equal(config.current, "noproxy");
    assert.ok(config.providers.find((provider) => provider.id === "noproxy").lastUsedAt);
    assert.match(rcContent, /unset HTTP_PROXY/);
    assert.match(rcContent, /unset HTTPS_PROXY/);
    assert.deepEqual(settings.env, {
      ANTHROPIC_BASE_URL: "https://example.com",
      ANTHROPIC_AUTH_TOKEN: "token",
    });
  });
});

test("ccs remove deletes an existing non-current provider", async () => {
  await withTempHome(async (homeDir) => {
    await writeJson(configPath(homeDir), {
      current: "builtin",
      providers: [makeBuiltin("builtin"), makeProvider("p1", "demo")],
    });

    const { stdout } = await runCli(homeDir, ["remove", "demo"]);
    const config = await readJson(configPath(homeDir));

    assert.match(stdout, /已删除服务商 "demo"/);
    assert.equal(config.providers.some((provider) => provider.id === "p1"), false);
  });
});

test("ccs remove returns a non-zero exit code when removing the current provider", async () => {
  await withTempHome(async (homeDir) => {
    await writeJson(configPath(homeDir), {
      current: "p1",
      providers: [makeBuiltin("builtin"), makeProvider("p1", "demo")],
    });

    await assert.rejects(
      runCli(homeDir, ["remove", "demo"]),
      (error) =>
        error &&
        error.code !== 0 &&
        /当前正在使用的服务商不可删除/.test(error.stderr),
    );
  });
});

test("ccs current prints the current provider name", async () => {
  await withTempHome(async (homeDir) => {
    await writeJson(configPath(homeDir), {
      current: "p1",
      providers: [makeBuiltin("builtin"), makeProvider("p1", "demo")],
    });

    const { stdout } = await runCli(homeDir, ["current"]);

    assert.match(stdout, /当前服务商：demo/);
  });
});

test("ccs add --preset rejects duplicate provider name without prompting", async () => {
  await withTempHome(async (tmpDir) => {
    await writeJson(configPath(tmpDir), { current: "builtin", providers: [makeBuiltin("builtin")] });
    const cfgPath = configPath(tmpDir);
    const cfg = JSON.parse(await fs.readFile(cfgPath, "utf8"));
    cfg.providers.push({
      id: "00000000-0000-0000-0000-000000000001",
      name: "kimi",
      isBuiltin: false,
      envVars: {},
      lastUsedAt: null,
    });
    await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2), "utf8");

    const result = await runCcsCapture(tmpDir, ["add", "--preset", "kimi"]);

    assert.ok(
      result.stderr.includes("已存在") || result.stdout.includes("已存在"),
      `expected duplicate error, got stdout: ${result.stdout} stderr: ${result.stderr}`,
    );
  });
});

test("ccs import forces isBuiltin to false regardless of exported value", async () => {
  await withTempHome(async (tmpDir) => {
    const exportFile = path.join(tmpDir, "evil-import.json");
    await fs.writeFile(
      exportFile,
      JSON.stringify({
        version: "1",
        exportedAt: new Date().toISOString(),
        providers: [
          {
            name: "evil",
            isBuiltin: true,
            envVars: { ANTHROPIC_BASE_URL: "https://evil.example.com" },
          },
        ],
      }),
      "utf8",
    );

    const result = await runCcsCapture(tmpDir, ["import", exportFile]);

    assert.strictEqual(result.exitCode, 0);
    const cfg = JSON.parse(await fs.readFile(configPath(tmpDir), "utf8"));
    const imported = cfg.providers.find((provider) => provider.name === "evil");
    assert.ok(imported, "provider should have been imported");
    assert.strictEqual(imported.isBuiltin, false, "isBuiltin must be false after import");
  });
});

test("ccs export to stdout omits id and lastUsedAt fields", async () => {
  await withTempHome(async (tmpDir) => {
    const result = await runCcsCapture(tmpDir, ["export"]);

    assert.strictEqual(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.ok(Array.isArray(parsed.providers));
    for (const provider of parsed.providers) {
      assert.ok(!("id" in provider), "export should not include id");
      assert.ok(!("lastUsedAt" in provider), "export should not include lastUsedAt");
    }
  });
});
