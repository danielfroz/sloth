import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.9";
import { describe, it } from "jsr:@std/testing@1.0.6/bdd";
import { DI } from "../src/mod.ts";

describe("DI.lazy", () => {
  it("breaks a two-way circular dependency between singletons", () => {
    const c = DI.createContainer();
    const TA = DI.Type<A>("A");
    const TB = DI.Type<B>("B");

    class A {
      // lazy on one edge of the cycle is enough to break it
      constructor(readonly b = DI.lazy(TB)) {}
      whoami() {
        return "A";
      }
      askB() {
        return this.b.whoami();
      }
    }

    class B {
      constructor(readonly a = DI.inject(TA)) {}
      whoami() {
        return "B";
      }
      askA() {
        return this.a.whoami();
      }
    }

    c.register(TA, { useClass: A }, { scope: DI.Scope.Singleton });
    c.register(TB, { useClass: B }, { scope: DI.Scope.Singleton });

    const a = c.resolve(TA);
    assertEquals(a.askB(), "B"); // B resolved lazily, on first use
    const b = c.resolve(TB);
    assertEquals(b.askA(), "A"); // back-edge sees the cached singleton A
  });

  it("throws without lazy (documents the behavior lazy fixes)", () => {
    const c = DI.createContainer();
    const TA = DI.Type<A>("A");
    const TB = DI.Type<B>("B");

    class A {
      constructor(readonly b = DI.inject(TB)) {}
    }
    class B {
      constructor(readonly a = DI.inject(TA)) {}
    }

    c.register(TA, { useClass: A }, { scope: DI.Scope.Singleton });
    c.register(TB, { useClass: B }, { scope: DI.Scope.Singleton });

    assertThrows(() => c.resolve(TA), Error, "circular dependency");
  });

  it("resolves at most once and memoizes the instance", () => {
    const c = DI.createContainer();
    let built = 0;
    const TDep = DI.Type<Dep>("Dep");
    const TOwner = DI.Type<Owner>("Owner");

    class Dep {
      readonly n: number;
      constructor() {
        this.n = ++built;
      }
    }

    class Owner {
      constructor(readonly dep = DI.lazy(TDep)) {}
    }

    c.register(TDep, { useClass: Dep }, { scope: DI.Scope.Singleton });
    c.register(TOwner, { useClass: Owner }, { scope: DI.Scope.Singleton });

    const owner = c.resolve(TOwner);
    assertEquals(built, 0); // not resolved until first access
    assertEquals(owner.dep.n, 1);
    assertEquals(owner.dep.n, 1); // still the same instance
    assertEquals(built, 1); // built exactly once
  });

  it("binds methods to the real instance (private fields, fluent return this)", () => {
    const c = DI.createContainer();
    const TCounter = DI.Type<Counter>("Counter");
    const TOwner = DI.Type<Owner>("Owner");

    class Counter {
      #count = 0;
      inc() {
        this.#count++;
        return this; // fluent
      }
      get value() {
        return this.#count;
      }
    }

    class Owner {
      constructor(readonly counter = DI.lazy(TCounter)) {}
    }

    c.register(TCounter, { useClass: Counter }, { scope: DI.Scope.Singleton });
    c.register(TOwner, { useClass: Owner }, { scope: DI.Scope.Singleton });

    const owner = c.resolve(TOwner);
    owner.counter.inc().inc();
    assertEquals(owner.counter.value, 2);
  });
});

describe("DI.container", () => {
  it("defaults class registrations to Singleton (one shared instance)", () => {
    const c = DI.createContainer();
    let built = 0;
    const TThing = DI.Type<Thing>("Thing");
    class Thing {
      constructor() {
        built++;
      }
    }
    c.register(TThing, { useClass: Thing }); // no scope => Singleton
    c.resolve(TThing);
    c.resolve(TThing);
    assertEquals(built, 1);
  });

  it("honours explicit Transient scope (a fresh instance per resolve)", () => {
    const c = DI.createContainer();
    let built = 0;
    const TThing = DI.Type<Thing>("Thing");
    class Thing {
      constructor() {
        built++;
      }
    }
    c.register(TThing, { useClass: Thing }, { scope: DI.Scope.Transient });
    c.resolve(TThing);
    c.resolve(TThing);
    assertEquals(built, 2);
  });

  it("throws on an unregistered token", () => {
    const c = DI.createContainer();
    assertThrows(() => c.resolve(DI.Type("Nope")), Error, "unregistered token");
  });
});

describe("DI.warmup", () => {
  it("constructs every class/factory token once and reports the count", () => {
    const c = DI.createContainer();
    let built = 0;
    const TRepo = DI.Type<Repo>("Repo");
    const TSvc = DI.Type<Svc>("Svc");

    class Repo {
      constructor() {
        built++;
      }
    }
    class Svc {
      constructor(readonly repo = DI.inject(TRepo)) {
        built++;
      }
    }

    c.register(TRepo, { useClass: Repo }, { scope: DI.Scope.Singleton });
    c.register(TSvc, { useClass: Svc }, { scope: DI.Scope.Singleton });
    c.register(DI.Type("Cfg"), { useValue: { ok: true } }); // value provider: skipped

    const { resolved } = c.warmup();
    assertEquals(resolved, 2); // value provider not counted
    assertEquals(built, 2);
  });

  it("fails fast: aggregates a missing dependency into an InitError", () => {
    const c = DI.createContainer();
    const TMissing = DI.Type("Missing");
    const TSvc = DI.Type<Svc>("Svc");
    class Svc {
      constructor(readonly dep = DI.inject(TMissing)) {}
    }
    c.register(TSvc, { useClass: Svc }, { scope: DI.Scope.Singleton });
    assertThrows(() => c.warmup(), Error, "warmup failed");
  });

  it("coexists with lazy cycles (warmup does not trip circular detection)", () => {
    const c = DI.createContainer();
    const TA = DI.Type<A>("A");
    const TB = DI.Type<B>("B");
    class A {
      constructor(readonly b = DI.lazy(TB)) {}
      ping() {
        return this.b.pong();
      }
    }
    class B {
      constructor(readonly a = DI.inject(TA)) {}
      pong() {
        return "pong";
      }
    }
    c.register(TA, { useClass: A }, { scope: DI.Scope.Singleton });
    c.register(TB, { useClass: B }, { scope: DI.Scope.Singleton });

    const { resolved } = c.warmup(); // must not throw
    assertEquals(resolved, 2);
    assertEquals(c.resolve(TA).ping(), "pong");
  });
});
