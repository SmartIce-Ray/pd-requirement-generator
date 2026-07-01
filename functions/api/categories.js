// 分类：GET 列表(所有人) / POST 新增自定义分类(仅 admin —— 分类是受控词表，防多人加类目搞碎)。
import { json, fail, guard } from "../_lib/respond.js";
import { genId } from "../_lib/ids.js";
import { requireAdmin } from "../_lib/access.js";
import { normalizeKind } from "../_lib/query.js";

export async function onRequestGet(context) {
  return guard("categories_list", async () => {
    const res = await context.env.DB.prepare(
      "SELECT id, name, kind FROM categories ORDER BY sort_order, name"
    ).all();
    return json({ categories: (res.results || []).map((c) => ({ id: c.id, name: c.name, kind: c.kind || "product" })) });
  });
}

export async function onRequestPost(context) {
  return guard("categories_create", async () => {
    const { request, env } = context;
    const denied = requireAdmin(context); if (denied) return denied;
    let body;
    try { body = await request.json(); } catch { return fail("请求格式错误", 400); }
    const name = (body.name || "").trim();
    if (!name) return fail("分类名不能为空", 400);
    if (name.length > 20) return fail("分类名过长", 400);
    const kind = normalizeKind(body.kind);

    const existing = await env.DB.prepare("SELECT id FROM categories WHERE name = ?").bind(name).first();
    if (existing) return fail("分类已存在", 409);

    const id = genId();
    const row = await env.DB.prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM categories").first();
    const sort = (row && row.next) || 1;
    await env.DB.prepare("INSERT INTO categories (id, name, sort_order, kind) VALUES (?,?,?,?)").bind(id, name, sort, kind).run();
    return json({ category: { id, name, kind } }, 201);
  });
}
