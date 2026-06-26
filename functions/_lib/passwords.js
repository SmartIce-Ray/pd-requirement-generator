// 密码哈希：WebCrypto PBKDF2-HMAC-SHA256。无第三方依赖（bcrypt/argon2 在 Workers 跑不了）。
// 存储单列格式：pbkdf2$sha256$<iters>$<saltB64>$<hashB64>，带参数前缀便于将来平滑升级。
// 注意：迭代 100000 是 CF workerd 的硬上限（超了会抛错），对受信内部团队是可接受折中。
// scripts/set-password.mjs 内联了同款参数，改这里务必同步那边。
import { timingSafeEqual } from "./auth.js";

const ALGO = "pbkdf2";
const HASH = "sha256";
const ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function bytesToB64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveHash(password, salt, iterations) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, KEY_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveHash(password, salt, ITERATIONS);
  return `${ALGO}$${HASH}$${ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(hash)}`;
}

export async function verifyPassword(password, stored) {
  if (!password || !stored || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 5) return false;
  const [algo, hashName, itersStr, saltB64, hashB64] = parts;
  if (algo !== ALGO || hashName !== HASH) return false;
  const iterations = parseInt(itersStr, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  let salt;
  try { salt = b64ToBytes(saltB64); } catch { return false; }
  const actual = bytesToB64(await deriveHash(password, salt, iterations));
  return timingSafeEqual(actual, hashB64);
}
