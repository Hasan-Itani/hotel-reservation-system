import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { getNestProxyBody } from "../lib/nestProxyBody";

describe("Nest proxy request body", () => {
  it("lets an empty DELETE reach Fastify even if the browser declares JSON", async () => {
    const api = Fastify();
    api.delete("/inventory", async () => ({ deleted: true }));
    try {
      const request = new Request("http://localhost/inventory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const headers = new Headers(request.headers);
      const body = await getNestProxyBody(request, request.method, headers);
      assert.equal(body, undefined);
      assert.equal(headers.has("content-type"), false);
      const response = await api.inject({
        method: "DELETE",
        url: "/inventory",
        headers: Object.fromEntries(headers),
        payload: body,
      });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { deleted: true });
    } finally {
      await api.close();
    }
  });

  it("preserves nonempty request bodies and labels explicit JSON", async () => {
    const request = new Request("http://localhost/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: '{"notes":"Updated"}',
    });
    const headers = new Headers(request.headers);
    assert.equal(await getNestProxyBody(request, request.method, headers), '{"notes":"Updated"}');
    assert.equal(headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(await getNestProxyBody(request, request.method, headers, "{}"), "{}");
    assert.equal(headers.get("content-type"), "application/json");
  });
});
