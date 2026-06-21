/**
 * Create a transparent proxy that defers resolution of its target until the
 * first member access, then memoizes it. Method members are bound to the real
 * instance (so `#private` fields and fluent `return this` work) and the bound
 * functions are cached to avoid allocating on every access.
 *
 * Used by `inject` to make class dependencies lazy (which makes circular
 * dependencies and registration order irrelevant) without proxying primitives —
 * the caller decides what is proxied.
 *
 * @internal
 */
export function createLazyProxy<T extends object>(resolve: () => T): T {
  let instance: T | undefined;
  let resolved = false;
  const bound = new Map<PropertyKey, unknown>();

  const target = (): T => {
    if (!resolved) {
      instance = resolve();
      resolved = true;
    }
    return instance as T;
  };

  return new Proxy(Object.create(null) as T, {
    get(_t, prop) {
      const obj = target() as Record<PropertyKey, unknown>;
      const value = obj[prop];
      if (typeof value != "function") {
        return value;
      }
      let fn = bound.get(prop);
      if (!fn) {
        fn = (value as (...args: unknown[]) => unknown).bind(obj);
        bound.set(prop, fn);
      }
      return fn;
    },
    set(_t, prop, value) {
      (target() as Record<PropertyKey, unknown>)[prop] = value;
      bound.delete(prop);
      return true;
    },
    has(_t, prop) {
      return prop in (target() as object);
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(target() as object);
    },
    ownKeys() {
      return Reflect.ownKeys(target() as object);
    },
    getOwnPropertyDescriptor(_t, prop) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target() as object, prop);
      if (descriptor) {
        // The proxy target is an empty object, so any reported property must be
        // configurable to satisfy the proxy invariants.
        descriptor.configurable = true;
      }
      return descriptor;
    },
  });
}
