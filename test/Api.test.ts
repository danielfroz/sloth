import { assert, assertEquals, assertInstanceOf, assertRejects } from "jsr:@std/assert@1.0.9";
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing@1.0.6/bdd";
import { ApiFetch, Errors } from "../src/mod.ts";

const realFetch = globalThis.fetch;

/** Replaces global fetch with a stub for the duration of a test. */
const stubFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) => {
  globalThis.fetch = impl as typeof fetch;
};

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Api.ApiFetch", () => {
  let api: ApiFetch;

  beforeEach(() => {
    api = new ApiFetch();
    api.init({ base: "https://svc.local", throwOnError: true });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("resolves the parsed JSON on 200 (happy path)", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ ok: true, value: 42 }, 200)));
    const res = await api.get<{ ok: boolean; value: number }>({ url: "/thing/get" });
    assertEquals(res.value, 42);
  });

  it("classifies a connection refused as 503 / connection.refused", async () => {
    stubFetch(() => {
      const err = new TypeError("error sending request for url (https://svc.local): client error (Connect)");
      // deno-lint-ignore no-explicit-any
      (err as any).cause = { code: "ECONNREFUSED", message: "tcp connect error: Connection refused" };
      return Promise.reject(err);
    });
    const err = await assertRejects(() => api.get({ url: "/thing/get" }), Errors.ApiError);
    assertInstanceOf(err, Errors.ApiError);
    assertEquals(err.status, 503);
    assertEquals(err.code, "connection.refused");
    assertEquals(err.method, "GET");
  });

  it("classifies an AbortSignal timeout as 504 / connection.timeout", async () => {
    stubFetch(() => {
      const err = new DOMException("Signal timed out.", "TimeoutError");
      return Promise.reject(err);
    });
    const err = await assertRejects(() => api.post({ url: "/thing/save", body: { a: 1 } }), Errors.ApiError);
    assertInstanceOf(err, Errors.ApiError);
    assertEquals(err.status, 504);
    assertEquals(err.code, "connection.timeout");
    assertEquals(err.method, "POST");
  });

  it("classifies a connection reset as 502 / connection.reset", async () => {
    stubFetch(() => {
      const err = new TypeError("error sending request");
      // deno-lint-ignore no-explicit-any
      (err as any).cause = { code: "ECONNRESET" };
      return Promise.reject(err);
    });
    const err = await assertRejects(() => api.get({ url: "/thing/get" }), Errors.ApiError);
    assertInstanceOf(err, Errors.ApiError);
    assertEquals(err.status, 502);
    assertEquals(err.code, "connection.reset");
  });

  it("classifies a DNS failure as 502 / dns.notfound", async () => {
    stubFetch(() => {
      const err = new TypeError("error sending request");
      // deno-lint-ignore no-explicit-any
      (err as any).cause = { code: "ENOTFOUND", message: "failed to lookup address information" };
      return Promise.reject(err);
    });
    const err = await assertRejects(() => api.get({ url: "/thing/get" }), Errors.ApiError);
    assertInstanceOf(err, Errors.ApiError);
    assertEquals(err.status, 502);
    assertEquals(err.code, "dns.notfound");
  });

  it("preserves an upstream error result (status + code NOT reclassified)", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ error: { code: "thing.invalid", message: "bad thing" } }, 500)));
    const err = await assertRejects(() => api.get({ url: "/thing/get" }), Errors.ApiError);
    assertInstanceOf(err, Errors.ApiError);
    assertEquals(err.status, 500);
    assertEquals(err.code, "thing.invalid");
    assertEquals(err.message, "bad thing");
  });

  it("maps a non-JSON error body to code 'service' keeping the real status", async () => {
    stubFetch(() => new Promise((resolve) =>
      resolve(new Response("<html>502 Bad Gateway</html>", { status: 502 }))));
    const err = await assertRejects(() => api.get({ url: "/thing/get" }), Errors.ApiError);
    assertInstanceOf(err, Errors.ApiError);
    assertEquals(err.status, 502);
    assertEquals(err.code, "service");
    assert(err.message.includes("502 Bad Gateway"));
  });

  it("maps a non-JSON 2xx body to 502 / response.invalid", async () => {
    stubFetch(() => new Promise((resolve) =>
      resolve(new Response("not json", { status: 200 }))));
    const err = await assertRejects(() => api.get({ url: "/thing/get" }), Errors.ApiError);
    assertInstanceOf(err, Errors.ApiError);
    assertEquals(err.status, 502);
    assertEquals(err.code, "response.invalid");
  });

  it("validates required arguments before hitting the network", async () => {
    // deno-lint-ignore no-explicit-any
    await assertRejects(() => api.get({} as any), Errors.ArgumentError, "url");
    // deno-lint-ignore no-explicit-any
    await assertRejects(() => api.post({ url: "/x" } as any), Errors.ArgumentError, "body");
  });
});
