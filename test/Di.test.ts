import { assertEquals, assertStrictEquals, assertThrows } from "jsr:@std/assert@1.0.9";
import { describe, it } from "jsr:@std/testing@1.0.6/bdd";
import { DI } from "../src/mod.ts";

describe("DI.inject — lazy by default", () => {
  it("returns value/primitive dependencies eagerly (no proxy)", () => {
    const c = DI.createContainer();
    const conf = { a: 1 };
    const TConf = DI.Type<{ a: number }>("Conf");
    const TToken = DI.Type<string>("Token");
    c.register(TConf, { useValue: conf });
    c.register(TToken, { useValue: "secret-abc" });

    class Owner {
      constructor(
        readonly conf = DI.inject(TConf),
        readonly token = DI.inject(TToken),
      ) {}
    }
    const TOwner = DI.Type<Owner>("Owner");
    c.register(TOwner, { useClass: Owner }, { scope: DI.Scope.Singleton });

    const owner = c.resolve(TOwner);
    assertStrictEquals(owner.conf, conf); // same identity — eager, not a proxy
    assertEquals(owner.token, "secret-abc"); // primitives cannot be proxied
  });

  it("returns class dependencies lazily — constructed on first use, memoized", () => {
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
      constructor(readonly dep = DI.inject(TDep)) {}
    }

    c.register(TDep, { useClass: Dep }, { scope: DI.Scope.Singleton });
    c.register(TOwner, { useClass: Owner }, { scope: DI.Scope.Singleton });

    const owner = c.resolve(TOwner);
    assertEquals(built, 0); // not constructed until first access
    assertEquals(owner.dep.n, 1);
    assertEquals(owner.dep.n, 1); // same instance
    assertEquals(built, 1); // built exactly once
  });

  it("resolves a two-way circular dependency with no annotation", () => {
    const c = DI.createContainer();
    const TA = DI.Type<A>("A");
    const TB = DI.Type<B>("B");

    class A {
      constructor(readonly b = DI.inject(TB)) {} // plain inject — no lazy keyword
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

    assertEquals(c.resolve(TA).askB(), "B");
    assertEquals(c.resolve(TB).askA(), "A");
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
      constructor(readonly counter = DI.inject(TCounter)) {}
    }

    c.register(TCounter, { useClass: Counter }, { scope: DI.Scope.Singleton });
    c.register(TOwner, { useClass: Owner }, { scope: DI.Scope.Singleton });

    const owner = c.resolve(TOwner);
    owner.counter.inc().inc();
    assertEquals(owner.counter.value, 2);
  });

  it("throws at inject time for an unregistered Type token (fail fast)", () => {
    const c = DI.createContainer();
    const TMissing = DI.Type("Missing");
    class Owner {
      constructor(readonly dep = DI.inject(TMissing)) {}
    }
    const TOwner = DI.Type<Owner>("Owner");
    c.register(TOwner, { useClass: Owner });
    assertThrows(() => c.resolve(TOwner), Error, "unregistered token");
  });
});

describe("DI.container — resolve / scope", () => {
  it("constructs an unregistered class as Transient (di-wise behavior)", () => {
    const c = DI.createContainer();
    let built = 0;
    class Bare {
      constructor() {
        built++;
      }
    }
    c.resolve(Bare);
    c.resolve(Bare);
    assertEquals(built, 2); // not registered => Transient => fresh each time
  });

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

  it("throws on an unregistered Type token", () => {
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
    assertEquals(resolved, 2);
    assertEquals(built, 2);
  });

  it("fails fast on a missing class dependency (lazy inject lookup is eager)", () => {
    const c = DI.createContainer();
    const TMissingRepo = DI.Type("Repo"); // never registered
    const TSvc = DI.Type<Svc>("Svc");
    class Svc {
      constructor(readonly repo = DI.inject(TMissingRepo)) {}
    }
    c.register(TSvc, { useClass: Svc }, { scope: DI.Scope.Singleton });
    assertThrows(() => c.warmup(), Error, "warmup failed");
  });

  it("does not trip circular detection on a lazy cycle", () => {
    const c = DI.createContainer();
    const TA = DI.Type<A>("A");
    const TB = DI.Type<B>("B");
    class A {
      constructor(readonly b = DI.inject(TB)) {}
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

    const { resolved } = c.warmup();
    assertEquals(resolved, 2);
    assertEquals(c.resolve(TA).ping(), "pong");
  });
});
