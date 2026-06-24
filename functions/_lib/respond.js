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
