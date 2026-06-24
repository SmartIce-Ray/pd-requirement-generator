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
  return new Response(obj.body, { headers });
}
