// 删除自定义分类（仅 admin）。不影响已用该分类的选品，它们保留分类名文本。
import { json, fail, guard } from "../../_lib/respond.js";
import { requireAdmin } from "../../_lib/access.js";

export async function onRequestDelete(context) {
  return guard("categories_delete", async () => {
    const { env, params } = context;
    const denied = requireAdmin(context); if (denied) return denied;
    const res = await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(params.id).run();
    if (!res.meta || res.meta.changes === 0) return fail("分类不存在", 404);
    return json({ ok: true });
  });
}
