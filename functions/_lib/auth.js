// 会话鉴权：登录设 HttpOnly cookie，内放「签名令牌」(uid+role+name+过期，HMAC 防篡改)。
// 用 cookie 而非 Bearer，因为 <img src="/api/img/:key"> 带不了 Authorization 头。
// 令牌无状态（不存会话表）：签名密钥复用 env.APP_PASSWORD（改造后它只做签名、不再是登录口令）。
// 注：无状态 ⇒ 删号/改角色不会立即失效，旧令牌最长到 exp(30 天)才失权；要全员强制下线就轮换 APP_PASSWORD。
const COOKIE_NAME = "sid";

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---- base64url 编解码（令牌放进 cookie，须 url-safe）----
function b64urlFromBytes(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s) {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlFromStr(str) { return b64urlFromBytes(enc.encode(str)); }
function b64urlToStr(s) { return dec.decode(b64urlToBytes(s)); }

async function hmacBytes(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return new Uint8Array(sig);
}

// 签发会话令牌：payload(base64url) + "." + HMAC(payload)(base64url)。
export async function signToken({ uid, role, name }, secret, { maxAgeDays = 30 } = {}) {
  if (!uid || !secret) return "";
  const now = Math.floor(Date.now() / 1000);
  const payload = { v: 2, uid, role, name, iat: now, exp: now + maxAgeDays * 24 * 3600 };
  const b64Payload = b64urlFromStr(JSON.stringify(payload));
  const sig = b64urlFromBytes(await hmacBytes(secret, b64Payload));
  return `${b64Payload}.${sig}`;
}

// 验令牌：先验签（防篡改）→ 通过才解析 → 查过期。返回 {uid,role,name} 或 null。
export async function verifyToken(token, secret) {
  if (!token || typeof token !== "string" || !secret) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const b64Payload = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = b64urlFromBytes(await hmacBytes(secret, b64Payload));
  if (!timingSafeEqual(providedSig, expectedSig)) return null;
  let payload;
  try { payload = JSON.parse(b64urlToStr(b64Payload)); } catch { return null; }
  if (!payload || typeof payload !== "object") return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;
  if (!payload.uid || !payload.role) return null;
  return { uid: payload.uid, role: payload.role, name: payload.name || "" };
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (!k) continue;
    const raw = part.slice(idx + 1).trim();
    // 容错：坏的 %xx 序列会让 decodeURIComponent 抛错；中间件在 hot path 调它，不能因任一坏 cookie 把整站 /api/* 打成 500，故降级用原值。
    try { out[k] = decodeURIComponent(raw); } catch { out[k] = raw; }
  }
  return out;
}

export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// secure 由调用方按 https/http 决定（localhost http 下不能加 Secure，否则浏览器不存）。
export function sessionCookie(token, { secure = true, maxAgeDays = 30 } = {}) {
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
