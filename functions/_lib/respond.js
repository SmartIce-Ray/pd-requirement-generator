// 统一 JSON 响应 helper。
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export function json(data, status = 200, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
  });
}

export function fail(message, status = 400) {
  return json({ error: message }, status);
}

// 包裹 handler：意外抛错（D1/R2 异常、binding 缺失）记日志并返回 JSON 500，
// 避免裸 await 抛错变成无 JSON、无日志的平台错误页。handler 内主动 return 的
// 400/404/409 等是返回值不是抛错，会原样透传。
export async function guard(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`${label}_failed`, String((e && e.stack) || e));
    return fail("服务器错误，请重试", 500);
  }
}
