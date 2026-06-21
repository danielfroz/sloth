import { assertEquals, assertStrictEquals, assertThrows } from "jsr:@std/assert@1.0.9";
import { beforeEach, describe, it } from "jsr:@std/testing@1.0.6/bdd";
import { Base, BaseResult, buildControllers, clearRoutes, Errors, Middleware, Route, RouteDecoratorOptions } from "../src/mod.ts";

// Minimal handlers for testing the route registry + controller assembly.
class GetHandler {
  handle(b: Base): Promise<BaseResult> {
    return Promise.resolve({ id: b.id, sid: b.sid });
  }
}
class SaveHandler {
  handle(b: Base): Promise<BaseResult> {
    return Promise.resolve({ id: b.id, sid: b.sid });
  }
}
class DeepHandler {
  handle(b: Base): Promise<BaseResult> {
    return Promise.resolve({ id: b.id, sid: b.sid });
  }
}
class HealthHandler {
  handle(b: Base): Promise<BaseResult> {
    return Promise.resolve({ id: b.id, sid: b.sid });
  }
}

// Applies @Route functionally. The decorator's second (context) arg is ignored
// at runtime, so we cast to a unary call to keep the tests terse and isolated.
const route = (path: string, Class: unknown, options?: RouteDecoratorOptions) =>
  (Route(path, options) as (c: unknown) => void)(Class);

describe("Route / buildControllers", () => {
  // The decorator records into a module-level registry; clear it before each
  // test so registrations don't leak between cases.
  beforeEach(() => {
    clearRoutes();
  });

  it("groups routes that share a base segment into one controller", () => {
    route("/echo/get", GetHandler);
    route("/echo/save", SaveHandler);

    const controllers = buildControllers();
    assertEquals(controllers.length, 1);

    const echo = controllers[0];
    assertEquals(echo.base, "/echo");
    assertEquals(echo.routes.length, 2);
    assertEquals(echo.routes.map((r) => r.route.endpoint).sort(), ["/get", "/save"]);
  });

  it("keeps the full remaining path as the endpoint for nested routes", () => {
    route("/echo/sub/deep", DeepHandler);

    const [echo] = buildControllers();
    assertEquals(echo.base, "/echo");
    assertEquals(echo.routes.length, 1);
    assertEquals(echo.routes[0].route.endpoint, "/sub/deep");
  });

  it("uses an empty base for single-segment paths", () => {
    route("/health", HealthHandler);

    const [c] = buildControllers();
    assertEquals(c.base, "");
    assertEquals(c.routes[0].route.endpoint, "/health");
  });

  it("produces one controller per distinct base", () => {
    route("/echo/get", GetHandler);
    route("/health", HealthHandler);

    const controllers = buildControllers();
    assertEquals(controllers.length, 2);
    assertEquals(controllers.map((c) => c.base).sort(), ["", "/echo"]);
  });

  it("normalizes paths missing a leading slash (same result as with slash)", () => {
    route("echo/get", GetHandler);

    const [echo] = buildControllers();
    assertEquals(echo.base, "/echo");
    assertEquals(echo.routes[0].route.endpoint, "/get");
  });

  it("trims surrounding whitespace and a trailing slash", () => {
    route("  /echo/get/  ", GetHandler);

    const [echo] = buildControllers();
    assertEquals(echo.base, "/echo");
    assertEquals(echo.routes[0].route.endpoint, "/get");
  });

  it("rejects empty and whitespace-only paths", () => {
    assertThrows(() => route("", GetHandler), Errors.ArgumentError, "path");
    assertThrows(() => route("   ", GetHandler), Errors.ArgumentError, "path");
  });

  it("carries route-scoped middleware (use) onto the route descriptor", () => {
    const auth: Middleware = () => Promise.resolve();
    route("/echo/save", SaveHandler, { use: [auth] });

    const [echo] = buildControllers();
    const saved = echo.routes[0];
    assertEquals(saved.route.middlewares?.length, 1);
    assertStrictEquals(saved.route.middlewares?.[0], auth);
  });

  it("leaves middlewares undefined when use is not provided", () => {
    route("/echo/get", GetHandler);

    const [echo] = buildControllers();
    assertEquals(echo.routes[0].route.middlewares, undefined);
  });
});
