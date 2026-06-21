import { currentContainer } from "./container.ts";
import type { Constructor, Token } from "./token.ts";

function requireContainer(fn: string) {
  const container = currentContainer();
  if (!container) {
    throw new Error(`${fn}() can only be used within an injection context (during container.resolve)`);
  }
  return container;
}

/**
 * Inject a dependency.
 *
 * Resolves immediately against the container currently driving resolution — so
 * it must be called within a constructor (or factory) reached through
 * `container.resolve`. The idiomatic use is a constructor default parameter:
 *
 * ```ts
 * class GetHandler {
 *   constructor(private readonly repo = inject(Types.Repos.Echo)) {}
 * }
 * ```
 *
 * Passing the dependency explicitly (`new GetHandler(mockRepo)`) skips injection
 * entirely, which keeps handlers unit-testable without a container.
 */
export function inject<Instance extends object>(token: Constructor<Instance>): Instance;
export function inject<Value>(token: Token<Value>): Value;
export function inject<T>(token: Token<T>): T {
  return requireContainer("inject").resolve(token);
}

/**
 * Lazily inject a dependency.
 *
 * Unlike {@link inject}, which resolves immediately, `lazy` returns a transparent
 * proxy and defers resolution until the first time a member is accessed. The
 * instance is resolved at most once and memoized.
 *
 * The primary use case is **breaking circular dependencies**: because the
 * dependency is not resolved during construction, the owning instance can finish
 * constructing (and be cached as a singleton) before the cycle is closed.
 * Resolution then happens on first use, by which point the other side of the
 * cycle already exists. It also removes registration-order sensitivity — the
 * token only needs to be registered before it is first *used*, not before it is
 * injected.
 *
 * Method members are bound to the resolved instance, so private fields and
 * `return this` continue to work as expected.
 *
 * ```ts
 * class A {
 *   constructor(private b = lazy(Types.B)) {} // breaks the A <-> B cycle
 *   run() { return this.b.help(); }           // B resolved here, on first use
 * }
 * class B {
 *   constructor(private a = inject(Types.A)) {}
 *   help() { return "ok"; }
 * }
 * ```
 */
export function lazy<Instance extends object>(token: Constructor<Instance>): Instance;
export function lazy<Value extends object>(token: Token<Value>): Value;
export function lazy<T extends object>(token: Token<T>): T {
  const container = requireContainer("lazy");
  let instance: T | undefined;
  let resolved = false;
  const resolve = (): T => {
    if (!resolved) {
      instance = container.resolve(token) as T;
      resolved = true;
    }
    return instance as T;
  };
  return new Proxy(Object.create(null) as T, {
    get(_target, prop) {
      const target = resolve() as Record<PropertyKey, unknown>;
      const value = target[prop];
      return typeof value == "function" ? value.bind(target) : value;
    },
    set(_target, prop, value) {
      (resolve() as Record<PropertyKey, unknown>)[prop] = value;
      return true;
    },
    has(_target, prop) {
      return prop in (resolve() as object);
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(resolve() as object);
    },
    ownKeys() {
      return Reflect.ownKeys(resolve() as object);
    },
    getOwnPropertyDescriptor(_target, prop) {
      const descriptor = Reflect.getOwnPropertyDescriptor(resolve() as object, prop);
      if (descriptor) {
        // The proxy target is an empty object, so any reported property must be
        // configurable to satisfy the proxy invariants.
        descriptor.configurable = true;
      }
      return descriptor;
    },
  });
}
