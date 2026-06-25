// /api/* 密码门：除 /api/login 外，全部要求已登录（cookie）。
import { isAuthed } from "../_lib/auth.js";
import { fail } from "../_lib/respond.js";

const PUBLIC = new Set(["/api/login"]);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (PUBLIC.has(url.pathname)) return context.next();
  if (!(await isAuthed(request, env))) return fail("未登录", 401);
  return context.next();
}
