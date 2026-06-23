#!/bin/bash
# 双击启动：在本地起一个静态服务并打开 Chrome。
# 走 localhost（而不是直接双击 index.html），是因为"自动写入品牌文件夹"需要安全环境。
cd "$(dirname "$0")" || exit 1
PORT=8123
URL="http://localhost:${PORT}"

# 端口被占就顺延找一个空的
while lsof -i :"$PORT" >/dev/null 2>&1; do PORT=$((PORT+1)); URL="http://localhost:${PORT}"; done

( sleep 1; open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL" ) &

echo "──────────────────────────────────────────"
echo "  产品研发需求生成器 运行中"
echo "  地址：$URL"
echo "  用完直接关掉这个终端窗口即可停止。"
echo "──────────────────────────────────────────"
# 用带 no-cache 头的小服务，确保改了代码总能看到最新版本（不被浏览器缓存坑）
python3 "$(dirname "$0")/_serve.py" "$PORT"
