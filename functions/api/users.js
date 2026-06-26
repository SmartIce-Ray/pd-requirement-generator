// 账号管理（admin 专属）：GET 列出账号(带上传数) / POST 开通账号。
import { json, fail, guard } from "../_lib/respond.js";
import { genId } from "../_lib/ids.js";
import { requireAdmin } from "../_lib/access.js";
import { hashPassword } from "../_lib/passwords.js";

const VALID_ROLES = new Set(["collector", "admin"]);

export async function onRequestGet(context) {
  return guard("users_list", async () => {
    const denied = requireAdmin(context); if (denied) return denied;
    const res = await context.env.DB.prepare(
      `SELECT u.id, u.name, u.role, u.created_at, COUNT(i.id) AS upload_count
       FROM users u LEFT JOIN inspirations i ON i.uploader_id = u.id
       GROUP BY u.id, u.name, u.role, u.created_at
       ORDER BY u.created_at ASC, u.name ASC`
    ).all();
    return json({
      users: (res.results || []).map((u) => ({
        id: u.id, name: u.name, role: u.role,
        created_at: u.created_at, upload_count: u.upload_count || 0,
      })),
    });
  });
}

export async function onRequestPost(context) {
  return guard("users_create", async () => {
    const { request, env } = context;
    const denied = requireAdmin(context); if (denied) return denied;
    let body;
    try { body = await request.json(); } catch { return fail("请求格式错误", 400); }

    const name = ((body && body.name) || "").trim();
    const password = (body && body.password) || "";
    const role = VALID_ROLES.has(body && body.role) ? body.role : "collector";
    if (!name) return fail("姓名不能为空", 400);
    if (name.length > 20) return fail("姓名过长（≤20 字）", 400);
    if (password.length < 6) return fail("初始密码至少 6 位", 400);

    const exists = await env.DB.prepare("SELECT id FROM users WHERE name = ?").bind(name).first();
    if (exists) return fail("该姓名已被占用", 409);

    const id = "usr_" + genId(18);
    const pw = await hashPassword(password);
    const created_at = Date.now();
    try {
      await env.DB.prepare(
        "INSERT INTO users (id, name, pw, role, created_at) VALUES (?,?,?,?,?)"
      ).bind(id, name, pw, role, created_at).run();
    } catch (e) {
      // 仅并发撞名（UNIQUE 约束）返 409；其它错（DB 不可用等）抛给 guard 返真实 500，别误报"姓名占用"。
      if (String((e && e.message) || e).includes("UNIQUE")) return fail("该姓名已被占用", 409);
      throw e;
    }
    return json({ user: { id, name, role, created_at, upload_count: 0 } }, 201);
  });
}
