-- 灵感库新增「菜系」维度（中餐 / 西餐 / 日料…）：与「分类＝产品形态」正交的第三个轴。
-- 加列可空、单值文本；旧行落 NULL（＝未标菜系），向后兼容，可先于部署跑（同 0004 加列写法）。
-- 菜系值域固定写死在 functions/_lib/cuisines.js（仿品牌常量 brands.js），不进 categories 词表。
ALTER TABLE inspirations ADD COLUMN cuisine TEXT;
CREATE INDEX IF NOT EXISTS idx_insp_cuisine ON inspirations(cuisine);
