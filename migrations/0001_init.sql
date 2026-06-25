-- 选品灵感库 schema · 0001 init
-- inspirations：每张选品图一行；brands 存 JSON 数组（多选品牌名）；category NULL=未整理。

CREATE TABLE IF NOT EXISTS inspirations (
  id          TEXT PRIMARY KEY,             -- base62 随机串
  image_key   TEXT NOT NULL,                -- R2 object key（= id）
  image_type  TEXT,                         -- content-type，如 image/jpeg
  brands      TEXT NOT NULL DEFAULT '[]',   -- JSON 数组：多选品牌名
  category    TEXT,                         -- 分类名；NULL = 未整理
  notes       TEXT NOT NULL DEFAULT '',     -- 想法/灵感
  created_at  INTEGER NOT NULL              -- epoch 毫秒
);
CREATE INDEX IF NOT EXISTS idx_insp_created  ON inspirations(created_at);
CREATE INDEX IF NOT EXISTS idx_insp_category ON inspirations(category);

-- categories：预设 + 可自定义；种子与 app/js/config.schema.js 的 categories 对齐。
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL
);
INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES
  ('cat_caipin',  '菜品', 1),
  ('cat_xiaochi', '小吃', 2),
  ('cat_yinpin',  '饮品', 3),
  ('cat_tianpin', '甜品', 4),
  ('cat_zhushi',  '主食', 5);
