-- 新增「酱汁蘸料」分类，与 app/js/config.schema.js 的 categories 对齐。
-- sort_order 动态取 MAX+1：categories 是运行时可增删的活表，硬编码数字会和已有分类（运营加的）撞 sort_order；与 POST /api/categories 的算法一致，保证排在最后。
INSERT OR IGNORE INTO categories (id, name, sort_order)
SELECT 'cat_jiangzhi', '酱汁蘸料', COALESCE(MAX(sort_order), 0) + 1 FROM categories;
