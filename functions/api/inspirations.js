// 选品记录：GET 列表(筛选) / POST 新建(单图 → R2 + D1)。
import { json, fail, guard } from "../_lib/respond.js";
import { genId } from "../_lib/ids.js";
import { validateBrands, buildListQuery, parseRow, normalizeKind } from "../_lib/query.js";
import { BRAND_NAMES } from "../_lib/brands.js";
import { getUser } from "../_lib/access.js";

// 严格图片白名单（排除 SVG —— 可内嵌脚本，储存型 XSS 向量）。
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function onRequestGet(context) {
  return guard("inspirations_list", async () => {
    const { request, env } = context;
    const url = new URL(request.url);
    const brandRaw = url.searchParams.get("brand") || "";
    const brand = BRAND_NAMES.includes(brandRaw) ? brandRaw : "";
    const category = url.searchParams.get("category") || "";
    const uploader = url.searchParams.get("uploader") || "";
    // 用途 kind：缺省/非法一律归 product（normalizeKind 默认拒绝）—— 旧缓存 JS 不带 kind 也只看到产品图，绝不把创意漏进选品。
    const kind = normalizeKind(url.searchParams.get("kind"));
    const { sql, params } = buildListQuery({ brand, category, uploader, kind });
    const res = await env.DB.prepare(sql).bind(...params).all();
    return json({ items: (res.results || []).map(parseRow) });
  });
}

export async function onRequestPost(context) {
  return guard("inspiration_create", async () => {
    const { request, env } = context;
    const user = getUser(context);
    let form;
    try { form = await request.formData(); } catch { return fail("需要 multipart 表单", 400); }

    const image = form.get("image");
    if (!image || typeof image === "string") return fail("缺少图片", 400);
    const imageType = image.type;
    if (!ALLOWED_IMAGE_TYPES.has(imageType)) return fail("不支持的图片类型（仅 JPEG/PNG/WebP/GIF）", 415);

    // 用途 kind：product（默认）| creative；非法/缺省归 product（normalizeKind 默认拒绝）。
    const kind = normalizeKind(form.get("kind"));

    // 必填打标：分类两边都必选；品牌——产品必填至少一个，创意可空（通用 / 暂不涉及品牌）。
    const brandList = validateBrands(form.get("brands"));
    if (kind === "product" && !brandList.length) return fail("请至少选择一个品牌", 400);
    const categoryRaw = form.get("category");
    // 用 != null（非真值判断），否则单字符 "0" 之类会被当空丢弃。
    const category = categoryRaw != null && String(categoryRaw) !== "" ? String(categoryRaw) : null;
    if (!category) return fail("请选择分类", 400);

    const brands = JSON.stringify(brandList);
    const notes = form.get("notes") != null ? String(form.get("notes")) : "";

    const id = genId();
    const buf = await image.arrayBuffer();
    await env.IMAGES.put(id, buf, { httpMetadata: { contentType: imageType } });

    const created_at = Date.now();
    const uploaderId = user ? user.uid : null;
    try {
      await env.DB.prepare(
        "INSERT INTO inspirations (id, image_key, image_type, brands, category, notes, created_at, uploader_id, kind) VALUES (?,?,?,?,?,?,?,?,?)"
      ).bind(id, id, imageType, brands, category, notes, created_at, uploaderId, kind).run();
    } catch (e) {
      // D1 失败：记录真因 + 回滚已写入的 R2 对象（回滚失败也留痕，孤儿 key 是清理唯一线索）。
      console.error("inspiration_insert_failed", id, String((e && e.stack) || e));
      await env.IMAGES.delete(id).catch((delErr) =>
        console.error("inspiration_orphan_r2_object", id, String(delErr))
      );
      return fail("保存失败", 500);
    }
    return json({
      item: parseRow({
        id, image_type: imageType, brands, category, notes, kind, created_at,
        uploader_id: uploaderId, uploader_name: user ? user.name : null,
      }),
    }, 201);
  });
}
