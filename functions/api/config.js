// 选品库配置：品牌（常量）+ 分类（D1）+ 当前用户 me（角色门禁靠它）。登录后首调，也兼作鉴权探测。
import { BRANDS } from "../_lib/brands.js";
import { json, guard } from "../_lib/respond.js";
import { getUser } from "../_lib/access.js";

export async function onRequestGet(context) {
  return guard("config", async () => {
    const res = await context.env.DB.prepare(
      "SELECT id, name FROM categories ORDER BY sort_order, name"
    ).all();
    const u = getUser(context);
    return json({
      brands: BRANDS,
      categories: (res.results || []).map((c) => ({ id: c.id, name: c.name })),
      me: u ? { uid: u.uid, name: u.name, role: u.role } : null,
    });
  });
}
