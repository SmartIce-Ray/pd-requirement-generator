// 登录：校验密码 → 设会话 cookie。
import { sessionToken, sessionCookie } from "../_lib/auth.js";
import { json, fail } from "../_lib/respond.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.APP_PASSWORD) return fail("服务未配置密码", 500);
  let password = "";
  try {
    const body = await request.json();
    password = (body && body.password) || "";
  } catch {
    return fail("请求格式错误", 400);
  }
  if (password !== env.APP_PASSWORD) return fail("密码错误", 401);
  const token = await sessionToken(env.APP_PASSWORD);
  const secure = new URL(request.url).protocol === "https:";
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token, { secure }) });
}
