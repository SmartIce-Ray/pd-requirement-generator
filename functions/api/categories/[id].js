// 删除自定义分类（不影响已用该分类的选品，它们保留分类名文本）。
import { json, fail } from "../../_lib/respond.js";

export async function onRequestDelete(context) {
  const { env, params } = context;
  const res = await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(params.id).run();
  if (!res.meta || res.meta.changes === 0) return fail("分类不存在", 404);
  return json({ ok: true });
}
