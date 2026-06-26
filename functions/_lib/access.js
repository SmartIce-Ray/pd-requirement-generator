// 角色/归属校验：身份由 _middleware 验签后挂在 context.data.user = {uid, role, name}。
import { fail } from "./respond.js";

export function getUser(context) {
  return (context && context.data && context.data.user) || null;
}

// admin-only 端点用：通过返回 null，未授权返回 403 Response（调用方 `if (denied) return denied`）。
export function requireAdmin(context) {
  const u = getUser(context);
  if (!u || u.role !== "admin") return fail("需要管理员权限", 403);
  return null;
}

// 改/删某条灵感的权限：admin 全权；采集员仅限自己上传的。
export function isOwnerOrAdmin(item, user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return !!(item && item.uploader_id && item.uploader_id === user.uid);
}
