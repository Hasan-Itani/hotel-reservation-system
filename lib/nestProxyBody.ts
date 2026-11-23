export async function getNestProxyBody(
  request: Request,
  method: string,
  headers: Headers,
  jsonBody?: string,
) {
  const body = method === "GET" || method === "HEAD"
    ? undefined
    : jsonBody ?? await request.text();

  if (!body) {
    headers.delete("content-type");
    return undefined;
  }

  if (jsonBody !== undefined) {
    headers.set("content-type", "application/json");
  }
  return body;
}
