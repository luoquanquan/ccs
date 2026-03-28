import inquirer from "inquirer";
import { buildProviderNameSet } from "./providers.js";

export async function promptProviderSelection(providers, message, currentId) {
  const { selectedName } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedName",
      message,
      choices: providers.map((p) => ({
        name: `${currentId === p.id ? "✓ " : ""}${p.name}`,
        value: p.name,
      })),
    },
  ]);
  return selectedName;
}

export async function promptNameAndDescription(providers, currentProvider) {
  const questions = [];

  if (!currentProvider?.isBuiltin) {
    const existingNames = buildProviderNameSet(providers, currentProvider?.id);
    questions.push({
      type: "input",
      name: "name",
      message: "请输入服务商名称",
      default: currentProvider?.name ?? "",
      validate: (input) => {
        const value = input.trim();
        if (!value) return "名称不能为空";
        if (existingNames.has(value)) return "名称必须唯一";
        return true;
      },
      filter: (input) => input.trim(),
    });
  }

  questions.push({
    type: "input",
    name: "description",
    message: "请输入描述（可选）",
    default: currentProvider?.description ?? "",
    filter: (input) => input.trim(),
  });

  return inquirer.prompt(questions);
}

export async function promptEnvVars(initialEnvVars = {}, mode = "add") {
  const envVars = { ...initialEnvVars };

  while (true) {
    if (mode === "edit") {
      console.log("当前环境变量：");
      const entries = Object.entries(envVars);
      if (entries.length === 0) {
        console.log("  -");
      } else {
        for (const [key, value] of entries) {
          console.log(`  ${key}=${value}`);
        }
      }
    }

    const { envVar } = await inquirer.prompt([
      {
        type: "input",
        name: "envVar",
        message:
          mode === "edit"
            ? "输入 KEY=VALUE 添加或覆盖变量，输入 KEY= 删除变量，留空结束"
            : "输入环境变量 KEY=VALUE（留空结束）",
        validate: (input) => {
          const value = input.trim();
          if (!value) return true;
          const sep = value.indexOf("=");
          if (sep === -1) return "格式必须为 KEY=VALUE";
          if (!value.slice(0, sep).trim()) return "KEY 不能为空";
          return true;
        },
        filter: (input) => input.trim(),
      },
    ]);

    if (!envVar) break;

    const sep = envVar.indexOf("=");
    const key = envVar.slice(0, sep).trim();
    const value = envVar.slice(sep + 1);

    if (mode === "edit" && value === "") {
      delete envVars[key];
      continue;
    }

    envVars[key] = value;
  }

  return envVars;
}
