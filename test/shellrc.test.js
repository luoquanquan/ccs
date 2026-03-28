import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createTempHome, importFresh, removeTempHome } from "./helpers.js";

let homeDir;
let originalHome;
let shellrc;

before(async () => {
  originalHome = process.env.HOME;
  homeDir = await createTempHome("ccs-shellrc-");
  process.env.HOME = homeDir;
  shellrc = await importFresh(import.meta.url, "../src/shellrc.js");
});

after(async () => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  await removeTempHome(homeDir);
});

test("quoteForShell handles plain values, single quotes, dollar signs, and spaces", () => {
  assert.equal(shellrc.quoteForShell("plain"), "'plain'");
  assert.equal(shellrc.quoteForShell("it's"), "'it'\\''s'");
  assert.equal(shellrc.quoteForShell("$HOME"), "'$HOME'");
  assert.equal(shellrc.quoteForShell("two words"), "'two words'");
});

test("buildEnvLines formats unix exports", () => {
  const result = shellrc.buildEnvLines({ FOO: "bar baz", TOKEN: "$abc" }, "linux");

  assert.equal(result, "export FOO='bar baz'\nexport TOKEN='$abc'");
});

test("buildEnvLines formats win32 assignments", () => {
  const result = shellrc.buildEnvLines({ FOO: "bar baz" }, "win32");

  assert.equal(result, '$env:FOO = "bar baz"');
});

test("extractMarkerKeys returns export keys from a marker block", () => {
  const source = [
    "before",
    shellrc.MARKER_START,
    "unset OLD_TOKEN",
    "export HTTP_PROXY='http://127.0.0.1:7890'",
    "export HTTPS_PROXY='http://127.0.0.1:7890'",
    shellrc.MARKER_END,
    "after",
  ].join("\n");

  assert.deepEqual(shellrc.extractMarkerKeys(source), ["HTTP_PROXY", "HTTPS_PROXY"]);
});

test("replaceMarkerBlock appends a marker block when none exists", () => {
  const source = "export PATH=\"$PATH:/custom/bin\"\n";

  const result = shellrc.replaceMarkerBlock(source, { HTTP_PROXY: "http://127.0.0.1:7890" }, [], "linux");

  assert.match(result, /export PATH="\$PATH:\/custom\/bin"/);
  assert.match(result, /# CCS_START[\s\S]*export HTTP_PROXY='http:\/\/127\.0\.0\.1:7890'[\s\S]*# CCS_END/);
});

test("replaceMarkerBlock replaces an existing marker block", () => {
  const source = [
    "line-1",
    shellrc.MARKER_START,
    "export HTTP_PROXY='old'",
    shellrc.MARKER_END,
    "line-2",
  ].join("\n");

  const result = shellrc.replaceMarkerBlock(source, { HTTP_PROXY: "new" }, [], "linux");

  assert.equal(result.includes("export HTTP_PROXY='old'"), false);
  assert.equal(result.includes("export HTTP_PROXY='new'"), true);
  assert.equal(result.includes("line-1"), true);
  assert.equal(result.includes("line-2"), true);
});

test("replaceMarkerBlock emits unset lines when unsetKeys are provided", () => {
  const source = `${shellrc.MARKER_START}\nexport HTTP_PROXY='old'\n${shellrc.MARKER_END}`;

  const result = shellrc.replaceMarkerBlock(source, {}, ["HTTP_PROXY", "HTTPS_PROXY"], "linux");

  assert.match(result, /unset HTTP_PROXY/);
  assert.match(result, /unset HTTPS_PROXY/);
});

test("buildMarkerBlock includes export lines when envVars are present", () => {
  const block = shellrc.buildMarkerBlock({ HTTP_PROXY: "http://127.0.0.1:7890" }, [], "linux");

  assert.match(block, /# CCS_START/);
  assert.match(block, /export HTTP_PROXY='http:\/\/127\.0\.0\.1:7890'/);
  assert.match(block, /# CCS_END/);
});

test("buildMarkerBlock includes unset lines when unsetKeys are present", () => {
  const block = shellrc.buildMarkerBlock({}, ["HTTP_PROXY"], "linux");

  assert.match(block, /unset HTTP_PROXY/);
});

test("buildMarkerBlock puts unset lines before export lines when both exist", () => {
  const block = shellrc.buildMarkerBlock(
    { HTTPS_PROXY: "http://127.0.0.1:7890" },
    ["HTTP_PROXY"],
    "linux",
  );

  assert.equal(block.indexOf("unset HTTP_PROXY") < block.indexOf("export HTTPS_PROXY"), true);
});
