// 单条选品：PATCH 改标签(品牌/分类/想法) / DELETE 删行+删图。
import { json, fail, guard } from "../../_lib/respond.js";
import { validateBrands, parseRow } from "../../_lib/query.js";

export async function onRequestPatch(context) {
  return guard("inspiration_patch", async () => {
    const { request, env, params } = context;
    const id = params.id;
    let body;
    try { body = await request.json(); } catch { return fail("请求格式错误", 400); }

    const sets = [];
    const vals = [];
    if (body.brands !== undefined) { sets.push("brands = ?"); vals.push(JSON.stringify(validateBrands(body.brands))); }
    if (body.category !== undefined) { sets.push("category = ?"); vals.push(body.category ? String(body.category) : null); }
    if (body.notes !== undefined) { sets.push("notes = ?"); vals.push(String(body.notes)); }
    if (!sets.length) return fail("无可更新字段", 400);

    vals.push(id);
    const res = await env.DB.prepare(`UPDATE inspirations SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
    if (!res.meta || res.meta.changes === 0) return fail("记录不存在", 404);

    const row = await env.DB.prepare("SELECT * FROM inspirations WHERE id = ?").bind(id).first();
    return json({ item: parseRow(row) });
  });
}

export async function onRequestDelete(context) {
  return guard("inspiration_delete", async () => {
    const { env, params } = context;
    const id = params.id;
    const row = await env.DB.prepare("SELECT image_key FROM inspirations WHERE id = ?").bind(id).first();
    if (!row) return fail("记录不存在", 404);
    await env.DB.prepare("DELETE FROM inspirations WHERE id = ?").bind(id).run();
    // 删图失败留痕（D1 行已删，否则成无痕 R2 孤儿）。
    await env.IMAGES.delete(row.image_key).catch((e) =>
      console.error("inspiration_delete_r2_orphan", id, row.image_key, String(e))
    );
    return json({ ok: true });
  });
}
