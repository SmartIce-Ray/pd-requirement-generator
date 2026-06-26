// 单账号（admin 专属）：PATCH 重置密码 / DELETE 删除账号。
// 删除保护：不能删自己、不能删最后一个 admin。被删账号的图保留（uploader 悬空 → 显示「已删除」）。
import { json, fail, guard } from "../../_lib/respond.js";
import { requireAdmin, getUser } from "../../_lib/access.js";
import { hashPassword } from "../../_lib/passwords.js";

export async function onRequestPatch(context) {
  return guard("users_reset_pw", async () => {
    const { request, env, params } = context;
    const denied = requireAdmin(context); if (denied) return denied;
    let body;
    try { body = await request.json(); } catch { return fail("请求格式错误", 400); }
    const password = (body && body.password) || "";
    if (password.length < 6) return fail("新密码至少 6 位", 400);

    const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(params.id).first();
    if (!target) return fail("账号不存在", 404);
    const pw = await hashPassword(password);
    await env.DB.prepare("UPDATE users SET pw = ? WHERE id = ?").bind(pw, params.id).run();
    return json({ ok: true });
  });
}

export async function onRequestDelete(context) {
  return guard("users_delete", async () => {
    const { env, params } = context;
    const denied = requireAdmin(context); if (denied) return denied;
    const me = getUser(context);
    if (me && me.uid === params.id) return fail("不能删除自己", 409);

    const target = await env.DB.prepare("SELECT id, role FROM users WHERE id = ?").bind(params.id).first();
    if (!target) return fail("账号不存在", 404);
    if (target.role === "admin") {
      const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first();
      if (((row && row.n) || 0) <= 1) return fail("不能删除最后一个管理员", 409);
    }
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(params.id).run();
    return json({ ok: true });
  });
}
