// 选品库配置：品牌（常量）+ 分类（D1）。前端登录后首调，也兼作鉴权探测。
import { BRANDS } from "../_lib/brands.js";
import { json, guard } from "../_lib/respond.js";

export async function onRequestGet(context) {
  return guard("config", async () => {
    const res = await context.env.DB.prepare(
      "SELECT id, name FROM categories ORDER BY sort_order, name"
    ).all();
    return json({
      brands: BRANDS,
      categories: (res.results || []).map((c) => ({ id: c.id, name: c.name })),
    });
  });
}
