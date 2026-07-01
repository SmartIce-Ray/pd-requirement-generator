-- 创意灵感库：给 inspirations / categories 加 kind 判别（product|creative）。
-- 加列带 NOT NULL DEFAULT 'product'，向后兼容——旧行/旧代码自动落 product，可先于部署跑。
ALTER TABLE inspirations ADD COLUMN kind TEXT NOT NULL DEFAULT 'product';
ALTER TABLE categories   ADD COLUMN kind TEXT NOT NULL DEFAULT 'product';
CREATE INDEX IF NOT EXISTS idx_insp_kind ON inspirations(kind);

-- 3 个创意起步分类；sort_order 动态取 MAX+1（沿用 0003 的活表写法，与 POST /api/categories 一致），kind='creative'。
INSERT OR IGNORE INTO categories (id, name, sort_order, kind)
  SELECT 'cat_sjsj', '设计视觉', COALESCE(MAX(sort_order), 0) + 1, 'creative' FROM categories;
INSERT OR IGNORE INTO categories (id, name, sort_order, kind)
  SELECT 'cat_hdcy', '活动创意', COALESCE(MAX(sort_order), 0) + 1, 'creative' FROM categories;
INSERT OR IGNORE INTO categories (id, name, sort_order, kind)
  SELECT 'cat_zbhw', '周边好物', COALESCE(MAX(sort_order), 0) + 1, 'creative' FROM categories;
