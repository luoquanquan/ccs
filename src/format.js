import chalk from "chalk";

export function formatLastUsedAt(lastUsedAt) {
  if (!lastUsedAt) return "从未使用";
  const d = new Date(lastUsedAt);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function maskSecret(value) {
  if (value.length <= 8) return chalk.dim("****");
  return chalk.dim(`${value.slice(0, 4)}${"*".repeat(Math.min(value.length - 8, 12))}${value.slice(-4)}`);
}
