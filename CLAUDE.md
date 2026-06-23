# 产品研发需求生成器 — 项目说明

把"参考图 + 方向"变成研发能照着做的需求 PPT。四品牌：宁桂杏 / 野百灵 / 飞花小馆 / 邦兰埔。
纯静态前端工具（`app/`），无后端、无构建步骤；生成 PPT 经浏览器 File System Access API 自动写入本地「品牌/需求/」，其它浏览器降级为下载。

## 部署模型

- **平台**：Cloudflare Pages（静态，直接上传 `app/`；用 `wrangler.jsonc` 的 `pages_build_output_dir: app` 锁定只上线 app/，非 git-connected 自动部署）
- **模式**：A（CLI-based + preview-first）
- **生产分支**：`main`（main = 生产；功能 PR `--base main`）
- **部署触发**：CLI 主动 —— `npm run deploy:preview` 出预览 URL 验证 → `npm run deploy` 切生产（认证走环境变量 `CLOUDFLARE_API_TOKEN`）
- **环境**：无 staging；preview 部署即验证环境
- **仓库**：`SmartIce-Ray/pd-requirement-generator`（私有）
- **分支纪律**：禁止直接 push `main`；功能走 `feat/` `fix/` `chore/` 分支 → PR → squash 合并 → 部署
- **不上线/不进仓库**：四个品牌内容文件夹（含品牌定位、真实需求 PPT/PDF、参考图库）已 `.gitignore`，敏感、仅本地

## 关键约束

- 视觉走 SmartICE **M 暖米石墨** + PingFang SC；**无 emoji、无斜体**
- 自动归档是**本地能力**（File System Access API）：仅 Chrome/Edge + 用户授权的本地文件夹有效；公开访问者没有品牌文件夹，授权后会在所选目录新建「品牌/需求/」，或降级下载
- 份量 / 成本 / 售价**不进需求**（研发出成品后按成本定价法定）
- 生成的文件名 `品牌-需求名-日期.pptx`，直接写进「品牌/需求/」，不再单独建需求名子文件夹

## 提交前必做

- 无 TS / 无构建：跳过 `tsc` / `build`；改 `app/js/*.js` 后用 `node --check` 过语法
- 前端改动：PC (1440px) + 移动 (430px) 双端验证（Playwright 截图）
- 改部署相关文件（`wrangler.jsonc` / `package.json` 部署脚本 / `CLAUDE.md` 部署模型）后，不能只看本地 —— 跑 `npm run deploy:preview` 看预览 URL 实际可用再合并
