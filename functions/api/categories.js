// 分类：GET 列表 / POST 新增自定义分类。
import { json, fail } from "../_lib/respond.js";
import { genId } from "../_lib/ids.js";

export async function onRequestGet(context) {
  const { env } = context;
  const res = await env.DB.prepare(
    "SELECT id, name FROM categories ORDER BY sort_order, name"
  ).all();
  return json({ categories: (res.results || []).map((c) => ({ id: c.id, name: c.name })) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return fail("请求格式错误", 400); }
  const name = (body.name || "").trim();
  if (!name) return fail("分类名不能为空", 400);
  if (name.length > 20) return fail("分类名过长", 400);

  const id = genId();
  const row = await env.DB.prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM categories").first();
  const sort = (row && row.next) || 1;
  try {
    await env.DB.prepare("INSERT INTO categories (id, name, sort_order) VALUES (?,?,?)").bind(id, name, sort).run();
  } catch (e) {
    return fail("分类已存在", 409);
  }
  return json({ category: { id, name } }, 201);
}
