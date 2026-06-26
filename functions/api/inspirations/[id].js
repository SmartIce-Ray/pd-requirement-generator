// 单条选品：PATCH 改标签(品牌/分类/想法) / DELETE 删行+删图。
// 归属校验：admin 全权；采集员仅限自己上传的（否则 403）。品牌/分类已入库即不可清空。
import { json, fail, guard } from "../../_lib/respond.js";
import { validateBrands, parseRow } from "../../_lib/query.js";
import { getUser, isOwnerOrAdmin } from "../../_lib/access.js";

export async function onRequestPatch(context) {
  return guard("inspiration_patch", async () => {
    const { request, env, params } = context;
    const id = params.id;
    let body;
    try { body = await request.json(); } catch { return fail("请求格式错误", 400); }

    const existing = await env.DB.prepare(
      "SELECT id, uploader_id FROM inspirations WHERE id = ?"
    ).bind(id).first();
    if (!existing) return fail("记录不存在", 404);
    if (!isOwnerOrAdmin(existing, getUser(context))) return fail("无权修改这条", 403);

    const sets = [];
    const vals = [];
    if (body.brands !== undefined) {
      const bl = validateBrands(body.brands);
      if (!bl.length) return fail("品牌不能清空", 400);
      sets.push("brands = ?"); vals.push(JSON.stringify(bl));
    }
    if (body.category !== undefined) {
      if (!body.category) return fail("分类不能清空", 400);
      sets.push("category = ?"); vals.push(String(body.category));
    }
    if (body.notes !== undefined) { sets.push("notes = ?"); vals.push(String(body.notes)); }
    if (!sets.length) return fail("无可更新字段", 400);

    vals.push(id);
    await env.DB.prepare(`UPDATE inspirations SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();

    const row = await env.DB.prepare(
      "SELECT i.*, u.name AS uploader_name FROM inspirations i LEFT JOIN users u ON u.id = i.uploader_id WHERE i.id = ?"
    ).bind(id).first();
    if (!row) return fail("记录不存在", 404); // 并发删除：UPDATE 后行没了，别让 parseRow(null) 抛成 500
    return json({ item: parseRow(row) });
  });
}

export async function onRequestDelete(context) {
  return guard("inspiration_delete", async () => {
    const { env, params } = context;
    const id = params.id;
    const row = await env.DB.prepare(
      "SELECT image_key, uploader_id FROM inspirations WHERE id = ?"
    ).bind(id).first();
    if (!row) return fail("记录不存在", 404);
    if (!isOwnerOrAdmin(row, getUser(context))) return fail("无权删除这条", 403);

    await env.DB.prepare("DELETE FROM inspirations WHERE id = ?").bind(id).run();
    // 删图失败留痕（D1 行已删，否则成无痕 R2 孤儿）。
    await env.IMAGES.delete(row.image_key).catch((e) =>
      console.error("inspiration_delete_r2_orphan", id, row.image_key, String(e))
    );
    return json({ ok: true });
  });
}
