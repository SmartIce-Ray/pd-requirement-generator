// /api/* 鉴权门：除 /api/login 外，全部要求有效会话令牌（cookie）。
// 验签通过后把身份挂到 context.data.user = {uid, role, name}，下游 handler 直接读。
import { verifyToken, parseCookies, COOKIE_NAME } from "../_lib/auth.js";
import { fail } from "../_lib/respond.js";

const PUBLIC = new Set(["/api/login"]);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (PUBLIC.has(url.pathname)) return context.next();

  const secret = env && env.APP_PASSWORD;
  if (!secret) return fail("服务未配置", 500);
  const sid = parseCookies(request.headers.get("Cookie"))[COOKIE_NAME];
  const user = await verifyToken(sid, secret);
  if (!user) return fail("未登录", 401);

  context.data = context.data || {};
  context.data.user = user;
  return context.next();
}
