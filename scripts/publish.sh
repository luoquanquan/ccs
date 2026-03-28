#!/usr/bin/env bash
set -euo pipefail

BUMP=${1:-patch}

if [[ "$BUMP" != patch && "$BUMP" != minor && "$BUMP" != major ]] && ! [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "用法：npm run publish [patch|minor|major|<version>]" >&2
  echo "默认：patch" >&2
  exit 1
fi

echo "▶ 运行测试..."
npm test

echo "▶ 更新版本号 ($BUMP)..."
npm version "$BUMP" --message "chore: release v%s"

echo "▶ 推送到 git..."
git push
git push --tags

echo "▶ 发布到 npm..."
npm publish --access public

echo "✓ 发布完成"
