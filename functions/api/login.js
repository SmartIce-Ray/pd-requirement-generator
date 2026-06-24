// 登录：校验密码 → 设会话 cookie。
import { sessionToken, sessionCookie, timingSafeEqual } from "../_lib/auth.js";
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
  // 时间安全比对：比对定长令牌（HMAC，64 hex），不泄露密码长度，避免短路 !== 的旁路。
  const expected = await sessionToken(env.APP_PASSWORD);
  const submitted = await sessionToken(password);
  if (!timingSafeEqual(submitted, expected)) return fail("密码错误", 401);
  const secure = new URL(request.url).protocol === "https:";
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(expected, { secure }) });
}
