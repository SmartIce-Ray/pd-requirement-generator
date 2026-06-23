#!/usr/bin/env python3
# 本地静态服务，带 no-store 头：浏览器永远拿最新文件，避免改了代码却看到旧版本(缓存)。
import sys, http.server, socketserver

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


with socketserver.TCPServer(("", port), Handler) as httpd:
    print(f"serving (no-cache) on port {port}")
    httpd.serve_forever()
