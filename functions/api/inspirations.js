// 选品记录：GET 列表(筛选) / POST 新建(单图 → R2 + D1)。
import { json, fail } from "../_lib/respond.js";
import { genId } from "../_lib/ids.js";
import { validateBrands, buildListQuery, parseRow } from "../_lib/query.js";
import { BRAND_NAMES } from "../_lib/brands.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const brandRaw = url.searchParams.get("brand") || "";
  const brand = BRAND_NAMES.includes(brandRaw) ? brandRaw : "";
  const category = url.searchParams.get("category") || "";
  const untagged = url.searchParams.get("untagged") === "1";
  const { sql, params } = buildListQuery({ brand, category, untagged });
  const res = await env.DB.prepare(sql).bind(...params).all();
  return json({ items: (res.results || []).map(parseRow) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let form;
  try { form = await request.formData(); } catch { return fail("需要 multipart 表单", 400); }

  const image = form.get("image");
  if (!image || typeof image === "string") return fail("缺少图片", 400);

  const brands = JSON.stringify(validateBrands(form.get("brands")));
  const categoryRaw = form.get("category");
  const category = categoryRaw ? String(categoryRaw) : null;
  const notes = form.get("notes") ? String(form.get("notes")) : "";

  const id = genId();
  const imageType = image.type || "image/jpeg";
  const buf = await image.arrayBuffer();
  await env.IMAGES.put(id, buf, { httpMetadata: { contentType: imageType } });

  const created_at = Date.now();
  try {
    await env.DB.prepare(
      "INSERT INTO inspirations (id, image_key, image_type, brands, category, notes, created_at) VALUES (?,?,?,?,?,?,?)"
    ).bind(id, id, imageType, brands, category, notes, created_at).run();
  } catch (e) {
    await env.IMAGES.delete(id).catch(() => {}); // 回滚孤儿对象
    return fail("保存失败", 500);
  }
  return json({ item: parseRow({ id, image_type: imageType, brands, category, notes, created_at }) }, 201);
}
