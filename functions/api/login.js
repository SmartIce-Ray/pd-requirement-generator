// 登录：按 name 查账号 → PBKDF2 校验密码 → 签发会话令牌。失败统一文案（不区分无此人/密码错）。
import { signToken, sessionCookie } from "../_lib/auth.js";
import { verifyPassword } from "../_lib/passwords.js";
import { json, fail, guard } from "../_lib/respond.js";

export async function onRequestPost(context) {
  return guard("login", async () => {
    const { request, env } = context;
    if (!env.APP_PASSWORD) return fail("服务未配置", 500);
    let name = "", password = "";
    try {
      const body = await request.json();
      name = ((body && body.name) || "").trim();
      password = (body && body.password) || "";
    } catch { return fail("请求格式错误", 400); }
    if (!name || !password) return fail("用户名或密码错误", 401);

    const row = await env.DB.prepare("SELECT id, name, role, pw FROM users WHERE name = ?").bind(name).first();
    const ok = row && row.pw && await verifyPassword(password, row.pw);
    if (!ok) return fail("用户名或密码错误", 401);

    const token = await signToken({ uid: row.id, role: row.role, name: row.name }, env.APP_PASSWORD);
    const secure = new URL(request.url).protocol === "https:";
    return json(
      { ok: true, me: { name: row.name, role: row.role } },
      200,
      { "Set-Cookie": sessionCookie(token, { secure }) }
    );
  });
}
