// 密码门：登录设 HttpOnly cookie（存 HMAC(APP_PASSWORD) 派生令牌，不存明文）。
// 用 cookie 而非 Bearer，因为 <img src="/api/img/:key"> 带不了 Authorization 头。
const COOKIE_NAME = "sid";
const TOKEN_PAYLOAD = "selip-auth-v1";

async function hmacHex(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 由 APP_PASSWORD 派生会话令牌（确定性，可在每次请求重算比对）。
export async function sessionToken(password) {
  if (!password) return "";
  return hmacHex(password, TOKEN_PAYLOAD);
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isAuthed(request, env) {
  const password = env && env.APP_PASSWORD;
  if (!password) return false;
  const sid = parseCookies(request.headers.get("Cookie"))[COOKIE_NAME];
  if (!sid) return false;
  return timingSafeEqual(sid, await sessionToken(password));
}

// secure 由调用方按 https/http 决定（localhost http 下不能加 Secure，否则浏览器不存）。
export function sessionCookie(token, { secure = true, maxAgeDays = 60 } = {}) {
  const attrs = [
    `${COOKIE_NAME}=${token}`, "HttpOnly", "SameSite=Strict", "Path=/",
    `Max-Age=${maxAgeDays * 24 * 3600}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearCookie({ secure = true } = {}) {
  const attrs = [`${COOKIE_NAME}=`, "HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=0"];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export { COOKIE_NAME };
