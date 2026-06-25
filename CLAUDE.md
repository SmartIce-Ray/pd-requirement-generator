# 产品研发需求生成器 + 选品灵感库 — 项目说明

两块能力，一个 CF Pages 项目：
1. **研发需求生成器**（原有）：把"参考图 + 方向"变成研发能照着做的需求 PPT（单产品任务书 / 多产品清单）。四品牌：宁桂杏 / 野百灵 / 飞花小馆 / 邦兰埔。
2. **选品灵感库**（新增）：刷到产品图 → 存图打标（品牌/分类/想法）→ 总览翻阅、勾选 → 一键生成多产品研发需求清单 PPT。

前端 `app/`（vanilla JS，无构建）；选品库后端走 **Pages Functions**（`functions/`）+ **D1**（元数据）+ **R2**（图片），单密码 cookie 鉴权。研发需求 PPT 经浏览器 File System Access API 写入本地「品牌/需求/」，其它浏览器降级下载。

## 部署模型

- **平台**：Cloudflare Pages（`app/` 为站点根，`functions/` 提供 `/api/*` 后端）；`wrangler.jsonc` 配 `pages_build_output_dir: app` + `d1_databases`(DB) + `r2_buckets`(IMAGES)
- **模式**：A（CLI-based + preview-first）
- **生产分支**：`main`（main = 生产，域名 **pd.smartice.ai**；功能 PR `--base main`）
- **部署触发**：push `main` 自动部署（GitHub Actions）；或 CLI `npm run deploy:preview` → `npm run deploy`。认证走 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
- **后端依赖（首次 / 新环境必做）**：
  - D1：`wrangler d1 create pd-inspirations` → 填 database_id → `npm run migrate:remote`
  - R2：账号需先**启用 R2**，`wrangler r2 bucket create pd-inspirations`（token 需 R2:Edit 权限）
  - Secret：`wrangler pages secret put APP_PASSWORD`（选品库登录密码）
- **缓存破坏（别删占位）**：CF Pages 给静态资源固定 `max-age=14400` 且 `_headers` 改不动它，故 `app/index.html` 资源引用带 `?v=__BUILD__` 占位，部署时替换成提交 SHA（CI 走 deploy.yml 的 sed 步；CLI 走 `scripts/cachebust-deploy.sh`）。`index.html` 本身 `max-age=0`，故每次部署浏览器都拉到新 JS/CSS，防"新 HTML + 旧 JS"错配崩页。**改/加资源引用时保留 `?v=__BUILD__`**
- **环境**：无 staging；preview 部署即验证环境
- **仓库**：`SmartIce-Ray/pd-requirement-generator`（私有）
- **分支纪律**：禁止直接 push `main`；功能走 `feat/` / `fix/` / `chore/` → PR → squash → 部署
- **不上线 / 不进仓库**：四个品牌内容文件夹 + `.dev.vars` 已 `.gitignore`，敏感、仅本地

## 关键约束

- 视觉走 SmartICE **M 暖米石墨** + PingFang SC；**无 emoji、无斜体**
- 选品库用户文本（想法 / 分类）一律 `textContent` 渲染防 XSS；上传图严格白名单（JPEG/PNG/WebP/GIF，排除 SVG）；`/api/img` 加 nosniff + CSP
- 研发需求：份量 / 成本 / 售价**不进需求**（研发出成品后按成本定价法定）
- 选品库为单人密码门，登录后所有数据可见（无 per-user 隔离）；`functions/_lib/brands.js` 与 `app/js/config.brands.js` 须同步

## 本地开发 / 测试

- `npm run dev`（= `wrangler pages dev`，本地模拟 D1/R2，读 `.dev.vars` 的 `APP_PASSWORD`）
- `npm test`（vitest：后端纯逻辑 + deck 多产品单测）
- `npm run migrate:local`（本地 D1 迁移）

## 提交前必做

- 无 TS / 无构建：改 `app/js/*.js` 用 `node --check` 过语法；后端逻辑跑 `npm test`
- 前端改动：PC (1440px) + 移动 (430px) 双端验证（Playwright 截图）
- 改部署相关文件（`wrangler.jsonc` / `package.json` 脚本 / `CLAUDE.md` / `functions/`）后，跑 `npm run deploy:preview` 在预览 URL 实测后端绑定再合并
