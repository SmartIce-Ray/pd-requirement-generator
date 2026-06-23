# 产品研发需求生成器

一个网页工具：选品牌 → 传参考图 → 填需求 → 一键生成需求 PPT，自动存进对应品牌文件夹。

## 怎么用（本地）

1. 双击 `启动.command`（首次若提示"无法打开"，右键 → 打开，或在终端 `chmod +x 启动.command`）。
2. 它会自动用 Chrome 打开工具页面（`http://localhost:8123`）。
3. 选品牌 → 填需求名 → 拖入参考图（iPhone 截图 / 小红书图都行，也可 ⌘+V 粘贴）→ 逐图填"借哪点 / 不要什么" → 填 4 段需求。
4. 点"生成 PPT"。**首次**会让你授权"项目根目录"一次（选 `产品研发需求` 这个文件夹），之后自动把 PPT 写进 `品牌/需求/`（直接放进去，不再单独建需求名子文件夹），命名 `品牌-需求名-日期.pptx`。
5. 草稿自动存（关掉浏览器不丢）；也可"导出草稿"成 JSON 存档、"导入草稿"继续编辑。

> 用 **Chrome / Edge** 才能自动写文件夹（依赖 File System Access API）。Safari/Firefox 会自动降级为"下载到下载文件夹"，你再手动拖进品牌文件夹。

## 为什么走 localhost 而不是直接双击 index.html

"自动写入本地文件夹"这个能力（File System Access API）要求页面在"安全环境"运行，`file://`（直接双击 html）不满足，`http://localhost` 满足。所以用 `启动.command` 起本地服务。

## 设计要点（实现已遵守）

- 图片一律按真实比例缩放放置（fit-to-box），**不变形**；iPhone 竖截图、小红书 3:4 / 方图都整图可见不裁切。
- 图片自动转正（EXIF）、高质量缩到长边 1600px、存 JPEG；HEIC 原图会被拦下并提示。
- PPT 文字按字数自适应字号，防溢出。
- 视觉走 M 暖米石墨 + PingFang SC，无 emoji、无斜体。

## 以后上云（留好的结构）

全部是静态文件，直接把 `app/` 丢到 Vercel / Netlify / Cloudflare Pages 即可（前端零改动）。要做"共享需求库 / AI 辅助"时：`store.js` 的导出 JSON 即后端记录格式，把"下载 JSON"换成 `POST /api/...`；AI 在 `①②` 文本框旁加按钮调 `/api/assist`（走 OpenRouter）。

## 文件结构

- `index.html` 页面 · `styles.css` 视觉 · `启动.command` 本地启动
- `js/config.brands.js` 品牌 · `js/config.schema.js` 4 段字段
- `js/images.js` 图片处理管线 · `js/store.js` 草稿 · `js/fs.js` 落地(写文件夹/下载)
- `js/deck.js` PPT 生成 · `js/app.js` 界面编排 · `vendor/` 离线 PPT 库
