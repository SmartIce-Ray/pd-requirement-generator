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

// 构建总览列表查询（参数化，防注入）。untagged 优先于 category。
export function buildListQuery({ brand, category, untagged } = {}) {
  const where = [];
  const params = [];
  if (brand) { where.push("brands LIKE ?"); params.push(`%"${brand}"%`); }
  if (untagged) {
    where.push("category IS NULL");
  } else if (category) {
    where.push("category = ?"); params.push(category);
  }
  const sql =
    "SELECT * FROM inspirations" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY created_at DESC";
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
    notes: row.notes,
    created_at: row.created_at,
  };
}
