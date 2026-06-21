import { assertEquals } from "jsr:@std/assert@1.0.9";
import { beforeEach, describe, it } from "jsr:@std/testing@1.0.6/bdd";
import { clearProviders, DI, Provide, registerProviders, Repository, Service } from "../src/mod.ts";

describe("Provide / Repository / Service discovery", () => {
  beforeEach(() => clearProviders());

  it("discovers a decorated class and registers it under its token", () => {
    const c = DI.createContainer();
    const TOrder = DI.Type<OrderRepo>("OrderRepo");

    @Repository(TOrder)
    class OrderRepo {
      ping() {
        return "order";
      }
    }

    registerProviders(c);
    assertEquals(c.has(TOrder), true);
    assertEquals(c.resolve(TOrder).ping(), "order");
  });

  it("treats @Repository / @Service / @Provide identically", () => {
    const c = DI.createContainer();
    const T1 = DI.Type<A>("A");
    const T2 = DI.Type<B>("B");
    const T3 = DI.Type<C>("C");

    @Repository(T1)
    class A {}
    @Service(T2)
    class B {}
    @Provide(T3)
    class C {}

    registerProviders(c);
    assertEquals([c.has(T1), c.has(T2), c.has(T3)], [true, true, true]);
  });

  it("honours the scope option", () => {
    const c = DI.createContainer();
    let built = 0;
    const T = DI.Type<S>("S");

    @Service(T, { scope: DI.Scope.Transient })
    class S {
      constructor() {
        built++;
      }
    }

    registerProviders(c);
    c.resolve(T);
    c.resolve(T);
    assertEquals(built, 2); // Transient => fresh each resolve
  });

  it("clearProviders empties the registry", () => {
    const c = DI.createContainer();
    const TX = DI.Type("X");

    @Provide(TX)
    class X {}

    clearProviders();
    registerProviders(c); // nothing left to register
    assertEquals(c.has(TX), false);
  });
});
