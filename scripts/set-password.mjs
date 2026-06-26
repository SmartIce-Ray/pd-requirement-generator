#!/usr/bin/env node
// 一次性引导：给 users 表里某账号设/改密码。仅为「首个 admin」引导用——
// 日常开号/改密/删号请在 app 内「账号管理」页操作。
//
// 用法:
//   本地: node scripts/set-password.mjs Ray
//   远端: node scripts/set-password.mjs Ray --remote
//
// PBKDF2 参数必须与 functions/_lib/passwords.js 完全一致（改一处同步另一处）。
import { execFileSync } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";
import readline from "node:readline";

const ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function b64(bytes) { return Buffer.from(bytes).toString("base64"); }

async function deriveHash(password, salt, iterations) {
  const km = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, km, KEY_BITS
  );
  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveHash(password, salt, ITERATIONS);
  return `pbkdf2$sha256$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

// 隐藏回显读密码。
function readPassword(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (str) => { if (!muted) rl.output.write(str); };
    process.stdout.write(prompt);
    muted = true;
    rl.question("", (val) => { muted = false; rl.close(); process.stdout.write("\n"); resolve(val); });
  });
}

const name = process.argv[2];
const remote = process.argv.includes("--remote");
if (!name || name.startsWith("--")) {
  console.error("用法: node scripts/set-password.mjs <name> [--remote]");
  process.exit(1);
}

const pw1 = await readPassword(`为账号「${name}」设置密码: `);
if (pw1.length < 6) { console.error("密码至少 6 位"); process.exit(1); }
const pw2 = await readPassword("再输一次确认: ");
if (pw1 !== pw2) { console.error("两次输入不一致"); process.exit(1); }

const encoded = await hashPassword(pw1);
// pw 编码串只含 base64 与 $，无单引号，内嵌 SQL 单引号串安全；name 转义单引号。
const safeName = name.replace(/'/g, "''");
const sql = `UPDATE users SET pw='${encoded}' WHERE name='${safeName}';`;
const args = ["wrangler", "d1", "execute", "pd-inspirations", remote ? "--remote" : "--local", "--command", sql];

console.log(`执行: wrangler d1 execute pd-inspirations ${remote ? "--remote" : "--local"} ...`);
// execFile（非 shell）→ pw 里的 $ 不会被 shell 展开。
execFileSync("npx", args, { stdio: "inherit" });
console.log(`已为「${name}」设密码（${remote ? "远端" : "本地"}）。若提示 0 行更新，请确认迁移已跑、账号名是否一致。`);
