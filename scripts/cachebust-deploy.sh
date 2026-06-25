#!/usr/bin/env bash
# CLI 部署的缓存破坏：部署前把 app/index.html 里资源的 ?v=__BUILD__ 占位换成当前提交 SHA，
# 部署结束（成功或失败）再还原占位，避免把 SHA 写死进源码。
# 与 .github/workflows/deploy.yml 里的 sed 步骤等价，保证 CLI（deploy:preview / deploy）
# 与 CI 三条部署路径都能破缓存（CF Pages 静态资源固定 max-age=14400、_headers 改不动它）。
set -euo pipefail
cd "$(dirname "$0")/.."

# 部署前工作区必须干净（部署规范）：否则 trap 的 git checkout 还原会吞掉 index.html 的未提交改动。
if ! git diff --quiet -- app/index.html; then
  echo "错误：app/index.html 有未提交改动，请先提交或还原再部署。" >&2
  exit 1
fi

SHA=$(git rev-parse HEAD)
trap 'git checkout -- app/index.html 2>/dev/null || true' EXIT

sed -i.bak "s/__BUILD__/${SHA}/g" app/index.html && rm -f app/index.html.bak
echo "已注入版本 ${SHA:0:8} 到 app/index.html，开始部署…"
npx wrangler pages deploy "$@"
