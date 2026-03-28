#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import {
  initCommand,
  listCommand,
  addCommand,
  useCommand,
  editCommand,
  removeCommand,
  currentCommand,
  proxyCommand,
  exportCommand,
  importCommand,
  completionCommand,
} from "../src/commands.js";
import { ensureConfig } from "../src/config.js";

const program = new Command();

program
  .name("ccs")
  .description("CCS CLI")
  .version("0.1.0")
  .action(() => useCommand());

program.command("init").description("首次初始化向导，自动导入现有配置").action(initCommand);
program.command("list").alias("ls").description("列出所有服务商").action(listCommand);
program
  .command("add")
  .alias("a")
  .description("添加服务商")
  .option("-p, --preset <name>", "使用预设模板（kimi/glm/qwen/openrouter/deepseek）")
  .action((opts) => addCommand(opts.preset));
program
  .command("use")
  .alias("u")
  .argument("[name]", "服务商名称")
  .description("切换服务商")
  .action(useCommand);
program.command("edit").alias("e").argument("[name]", "服务商名称").description("编辑服务商配置").action(editCommand);
program
  .command("remove")
  .alias("rm")
  .argument("[name]", "服务商名称")
  .description("删除服务商")
  .action(removeCommand);
program.command("current").alias("c").description("显示当前激活的服务商详情").action(currentCommand);
program.command("proxy").alias("p").argument("[url]", "代理地址").description("设置代理地址").action(proxyCommand);
program.command("export").argument("[file]", "导出路径（默认输出到 stdout）").description("导出服务商配置").action(exportCommand);
program.command("import").argument("<file>", "导入文件路径").description("导入服务商配置").action(importCommand);
program
  .command("completion")
  .description("输出 shell 补全脚本")
  .action(completionCommand);

program.hook("preAction", async (_thisCommand, actionCommand) => {
  if (actionCommand.name() === "completion") {
    return;
  }
  await ensureConfig();
});

program.configureOutput({
  outputError: (str, write) => write(chalk.red(str)),
});

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red(error?.message || "Unknown error"));
  process.exitCode = 1;
});
