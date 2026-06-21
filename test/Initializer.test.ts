import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.9";
import { describe, it } from "jsr:@std/testing@1.0.6/bdd";
import { Application, container, DI, type Framework, type Initializer } from "../src/mod.ts";

// Minimal framework stub — Inits never touches it (no start()).
function stubApp(): Application {
  const framework = {
    app: () => ({}),
    createController: () => {},
    createMiddleware: () => {},
    listen: () => Promise.resolve(),
  } as unknown as Framework;
  return new Application({ framework });
}

describe("Application.Inits / Initializer", () => {
  it("runs initializers in argument order", async () => {
    const order: string[] = [];
    class AInit implements Initializer {
      init() {
        order.push("A");
      }
    }
    class BInit implements Initializer {
      async init() {
        await Promise.resolve();
        order.push("B");
      }
    }
    await stubApp().Inits.run(AInit, BInit);
    assertEquals(order, ["A", "B"]);
  });

  it("supports constructor DI inside an initializer", async () => {
    const TVal = DI.Type<string>("Init.Val");
    container.register(TVal, { useValue: "hi" });
    let seen: string | undefined;
    class UsesVal implements Initializer {
      constructor(readonly v = DI.inject(TVal)) {}
      init() {
        seen = this.v;
      }
    }
    await stubApp().Inits.run(UsesVal);
    assertEquals(seen, "hi");
  });

  it("runs sequentially so an earlier init can register for a later one", async () => {
    const TX = DI.Type<string>("Init.X");
    class Producer implements Initializer {
      init() {
        container.register(TX, { useValue: "x" });
      }
    }
    let got: string | undefined;
    class Consumer implements Initializer {
      constructor(readonly x = DI.inject(TX)) {}
      init() {
        got = this.x;
      }
    }
    await stubApp().Inits.run(Producer, Consumer);
    assertEquals(got, "x");
  });

  it("aborts the run when an initializer throws", async () => {
    const ran: string[] = [];
    class Ok implements Initializer {
      init() {
        ran.push("ok");
      }
    }
    class Boom implements Initializer {
      init() {
        throw new Error("boom");
      }
    }
    class Never implements Initializer {
      init() {
        ran.push("never");
      }
    }
    await assertRejects(() => stubApp().Inits.run(Ok, Boom, Never), Error, "boom");
    assertEquals(ran, ["ok"]); // Never did not run
  });
});
