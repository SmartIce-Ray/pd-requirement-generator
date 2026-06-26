// 登出：清 cookie。
import { json } from "../_lib/respond.js";
import { clearCookie } from "../_lib/auth.js";

export async function onRequestPost(context) {
  const secure = new URL(context.request.url).protocol === "https:";
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie({ secure }) });
}
