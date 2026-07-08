import { BRAND_NAMES } from "./brands.js";

// 把输入（数组或 JSON 字符串）过滤成合法品牌名数组。
export function validateBrands(input) {
  let arr = input;
  if (typeof input === "string") {
    try { arr = JSON.parse(input); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter((b) => BRAND_NAMES.includes(b)))];
}

// 用途 kind 归一：只认 'creative'，其余（缺省/非法/大小写不符/类型不符）一律归 'product'。
// 默认拒绝方向——读侧(GET)与写侧(POST)都用它，保证任意脏输入都落到产品口径，创意绝不漏进选品。
export function normalizeKind(x) {
  return x === "creative" ? "creative" : "product";
}

// 构建总览列表查询（参数化，防注入）。LEFT JOIN users 取上传人名
// （账号被删后为 NULL → 前端显示「已删除」）。筛选维度：用途 kind / 品牌 / 分类 / 上传人。
export function buildListQuery({ brand, category, cuisine, uploader, kind } = {}) {
  const where = [];
  const params = [];
  if (kind) { where.push("i.kind = ?"); params.push(kind); }
  if (brand) { where.push("i.brands LIKE ?"); params.push(`%"${brand}"%`); }
  if (category) { where.push("i.category = ?"); params.push(category); }
  if (cuisine) { where.push("i.cuisine = ?"); params.push(cuisine); }
  if (uploader) { where.push("i.uploader_id = ?"); params.push(uploader); }
  const sql =
    "SELECT i.*, u.name AS uploader_name FROM inspirations i " +
    "LEFT JOIN users u ON u.id = i.uploader_id" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY i.created_at DESC";
  return { sql, params };
}

// D1 行 → 前端对象（解析 brands JSON，不外泄 image_key）。
export function parseRow(row) {
  let brands = [];
  try { brands = JSON.parse(row.brands || "[]"); } catch { brands = []; }
  return {
    id: row.id,
    image_type: row.image_type,
    brands,
    category: row.category,
    cuisine: row.cuisine || null,
    notes: row.notes,
    kind: row.kind || "product",
    created_at: row.created_at,
    uploader_id: row.uploader_id || null,
    uploader_name: row.uploader_name || null,
  };
}
