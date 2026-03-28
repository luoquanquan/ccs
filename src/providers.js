export const PRESETS = {
  kimi: {
    description: "月之暗面 Kimi",
    envVars: { ANTHROPIC_BASE_URL: "https://api.moonshot.cn/anthropic", ANTHROPIC_AUTH_TOKEN: "" },
  },
  glm: {
    description: "智谱 GLM",
    envVars: { ANTHROPIC_BASE_URL: "https://open.bigmodel.cn/api/paas/v4/anthropic", ANTHROPIC_AUTH_TOKEN: "" },
  },
  qwen: {
    description: "阿里云 Qwen",
    envVars: { ANTHROPIC_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1", ANTHROPIC_AUTH_TOKEN: "" },
  },
  openrouter: {
    description: "OpenRouter",
    envVars: { ANTHROPIC_BASE_URL: "https://openrouter.ai/api/v1", ANTHROPIC_AUTH_TOKEN: "" },
  },
  deepseek: {
    description: "DeepSeek",
    envVars: { ANTHROPIC_BASE_URL: "https://api.deepseek.com/v1", ANTHROPIC_AUTH_TOKEN: "" },
  },
};

export function splitEnvVars(envVars = {}) {
  const proxyEnvVars = {};
  const appEnvVars = {};
  for (const [key, value] of Object.entries(envVars)) {
    if (key === "HTTP_PROXY" || key === "HTTPS_PROXY") {
      proxyEnvVars[key] = value;
    } else {
      appEnvVars[key] = value;
    }
  }
  return { proxyEnvVars, appEnvVars };
}

export function normalizeProxyEnvVars(envVars = {}) {
  const normalized = {};
  if (envVars.HTTP_PROXY !== undefined) normalized.HTTP_PROXY = envVars.HTTP_PROXY;
  if (envVars.HTTPS_PROXY !== undefined) normalized.HTTPS_PROXY = envVars.HTTPS_PROXY;
  return normalized;
}

export function buildProviderNameSet(providers = [], excludeId) {
  return new Set(
    providers.filter((p) => p.id !== excludeId).map((p) => p.name),
  );
}

export function findProviderByName(providers, name) {
  const found = providers.find((p) => p.name === name);
  if (!found) throw new Error(`找不到服务商 "${name}"`);
  return found;
}

export function buildPresetProvider(preset, providers) {
  const template = PRESETS[preset];
  if (!template) {
    const available = Object.keys(PRESETS).join(", ");
    throw new Error(`未知预设 "${preset}"，可用：${available}`);
  }
  if (providers.some((p) => p.name === preset)) {
    throw new Error(`服务商 "${preset}" 已存在，请先删除或使用 ccs edit 修改`);
  }
  return { name: preset, description: template.description, envVars: { ...template.envVars } };
}

export async function pingProvider(provider) {
  if (provider.isBuiltin) return null;
  const baseUrl = provider.envVars?.ANTHROPIC_BASE_URL;
  if (!baseUrl) return null;
  const start = Date.now();
  try {
    await fetch(baseUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return Date.now() - start;
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "超时";
    return "失败";
  }
}
