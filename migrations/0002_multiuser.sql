-- 选品灵感库 schema · 0002 多人协作：实名账号 + 灵感记上传人。

-- users：每账号一行；pw 为 PBKDF2 编码串（'' = 未设密码，登录拒）；role: admin|collector。
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  pw          TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'collector',
  created_at  INTEGER NOT NULL
);

-- 种子 admin：id 固定 usr_admin，密码留空（由 scripts/set-password.mjs 设，不把哈希提交进 git）。
-- name 默认 Ray，如需改登录名请在首次应用迁移前改这里。
INSERT OR IGNORE INTO users (id, name, pw, role, created_at) VALUES
  ('usr_admin', 'Ray', '', 'admin', 0);

-- inspirations 记上传人（可空；存量都是 admin 的，回填给 usr_admin）。
-- 注：SQLite 加列时 NOT NULL 必须配死默认值；不想用死默认污染后续每次插入，故留可空 + 应用层强制新上传带 uploader。
ALTER TABLE inspirations ADD COLUMN uploader_id TEXT;
UPDATE inspirations SET uploader_id = 'usr_admin' WHERE uploader_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_insp_uploader ON inspirations(uploader_id);
