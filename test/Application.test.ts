import { assertEquals } from "jsr:@std/assert@1.0.9";
import { beforeEach, describe, it } from "jsr:@std/testing@1.0.6/bdd";
import {
  Application,
  Base,
  BaseResult,
  clearRoutes,
  Controller,
  Framework,
  Middleware,
  Route,
} from "../src/mod.ts";

// Recording stub Framework: captures the order in which the Application wires
// middlewares and controllers, so we can assert the pipeline ordering.
function recorder() {
  const calls: string[] = [];
  const framework = {
    app: () => ({}),
    createController: (c: Controller) => {
      calls.push(`C:${c.base}`);
    },
    createMiddleware: (m: Middleware) => {
      calls.push(`M:${(m as { name: string }).name}`);
    },
    listen: () => Promise.resolve(),
  } as unknown as Framework;
  return { calls, framework };
}

const auth: Middleware = () => Promise.resolve();
const notfound: Middleware = () => Promise.resolve();

class GetHandler {
  handle(b: Base): Promise<BaseResult> {
    return Promise.resolve({ id: b.id, sid: b.sid });
  }
}

describe("HandlerBuilder.pipeline", () => {
  beforeEach(() => {
    clearRoutes();
  });

  it("orders before -> manual controllers -> after (discover off)", async () => {
    const { calls, framework } = recorder();
    const app = new Application({ framework });
    const ctrl = new Controller("/echo");

    app.Handlers.pipeline({
      before: [auth],
      controllers: [ctrl],
      after: [notfound],
      discover: false,
    });
    await app.start({ port: 0 });

    assertEquals(calls, ["M:auth", "C:/echo", "M:notfound"]);
  });

  it("inserts @Route-discovered controllers between before and after", async () => {
    const { calls, framework } = recorder();
    (Route("/echo/get") as (c: unknown) => void)(GetHandler);

    const app = new Application({ framework });
    app.Handlers.pipeline({ before: [auth], after: [notfound] });
    await app.start({ port: 0 });

    assertEquals(calls, ["M:auth", "C:/echo", "M:notfound"]);
  });
});
