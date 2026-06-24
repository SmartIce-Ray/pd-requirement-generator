// 取选品图：鉴权后从 R2 取（私有，不公开桶）。<img src> 经 cookie 自动鉴权。
import { fail } from "../../_lib/respond.js";

export async function onRequestGet(context) {
  const { env, params } = context;
  const obj = await env.IMAGES.get(params.key);
  if (!obj) return fail("图片不存在", 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "private, max-age=86400");
  // 纵深防御：即便存了异常 content-type 也不让浏览器嗅探/执行为脚本。
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; img-src 'self'; sandbox");
  headers.set("content-disposition", `inline; filename="${params.key}"`);
  return new Response(obj.body, { headers });
}
