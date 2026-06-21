import { InitError } from "../Errors.ts";
import {
  type ClassProvider,
  type FactoryProvider,
  isClassProvider,
  isValueProvider,
  type Provider,
  type ValueProvider,
} from "./provider.ts";
import { createLazyProxy } from "./proxy.ts";
import { Scope } from "./scope.ts";
import { type Constructor, isConstructor, type Token } from "./token.ts";

/**
 * Registration options.
 */
export interface RegistrationOptions {
  /**
   * The scope of the registration.
   *
   * @defaultValue Scope.Singleton
   */
  readonly scope?: Scope;
}

interface Registration<T = any> {
  provider: Provider<T>;
  scope: Scope;
  instance?: { current: T };
}

/**
 * Container API.
 */
export interface Container {
  /**
   * Register a class provider with a token.
   */
  register<Instance extends object>(token: Token<Instance>, provider: ClassProvider<Instance>, options?: RegistrationOptions): this;

  /**
   * Register a factory provider with a token.
   */
  register<Value>(token: Token<Value>, provider: FactoryProvider<Value>, options?: RegistrationOptions): this;

  /**
   * Register a value provider with a token. Values are always constants.
   */
  register<Value>(token: Token<Value>, provider: ValueProvider<Value>): this;

  /**
   * Resolve a token to an instance, **eagerly**.
   *
   * Used by the framework (warmup, initializers, per-request handler resolution).
   * An unregistered `Constructor` token is constructed as `Transient`; an
   * unregistered `Type` token throws. A true cycle reached through eager
   * resolution throws `circular dependency detected` — but `inject` (lazy by
   * default) means cycles do not normally arise.
   */
  resolve<Instance extends object>(token: Constructor<Instance>): Instance;
  resolve<Value>(token: Token<Value>): Value;

  /**
   * Resolve a dependency for injection, **lazily by default**.
   *
   * - A **class** dependency (or an unregistered `Constructor`) is returned as a
   *   transparent proxy that constructs on first use — this is what makes
   *   circular dependencies and registration order irrelevant.
   * - A **value** or **factory** dependency is resolved eagerly and returned
   *   directly (so primitives — secret strings, URIs — work; they cannot be proxied).
   * - An unregistered `Type` token throws (it can neither be constructed nor proxied),
   *   surfacing wiring mistakes at inject time — i.e. at boot under `warmup`.
   *
   * Prefer the free {@link inject} helper inside constructors; this is its engine.
   */
  inject<Instance extends object>(token: Constructor<Instance>): Instance;
  inject<Value>(token: Token<Value>): Value;

  /**
   * Whether a token is registered.
   */
  has(token: Token): boolean;

  /**
   * Eagerly resolve every registered class/factory token once, surfacing any
   * construction error at boot instead of on the first request that touches it.
   *
   * Singletons are constructed and cached; transients are constructed and
   * discarded (validation only). Safe with {@link lazy} — lazy proxies do not
   * recurse, and each target token is validated on its own.
   *
   * @throws {InitError} aggregating every token that failed to resolve.
   */
  warmup(): { resolved: number };
}

// The container currently driving a synchronous resolution. The free `inject()`
// helper reads this to know which container to resolve against. Set/restored
// around each `resolve()`; correct because construction is synchronous
// (single-threaded, no `await` between `new Class()` and its `inject()` default-
// param evaluation).
let current: Container | undefined;

// @internal
export function currentContainer(): Container | undefined {
  return current;
}

/**
 * Create a new, empty container.
 */
export function createContainer(): Container {
  const registry = new Map<Token, Registration>();
  // Tokens currently mid-construction — re-entry means a circular dependency.
  const resolving = new Set<Token>();

  const container: Container = {
    register<T>(token: Token<T>, provider: Provider<T>, options?: RegistrationOptions) {
      // Default Singleton: matches handler/@Route/ServiceBuilder defaults, and
      // anything injected into a Singleton handler is already shared across
      // concurrent requests, so a shared instance adds no new requirement.
      // Use `{ scope: Transient }` for the rare dep that needs a fresh instance.
      const scope = options?.scope ?? Scope.Singleton;
      registry.set(token, { provider, scope });
      return container;
    },

    resolve<T>(token: Token<T>): T {
      let registration = registry.get(token) as Registration<T> | undefined;
      if (!registration) {
        // di-wise behavior: an unregistered class is constructed Transient. Many
        // services resolve handler classes this way (e.g. event handlers).
        if (isConstructor(token)) {
          registration = {
            provider: { useClass: token } as ClassProvider<T & object>,
            scope: Scope.Transient,
          };
        } else {
          throw new Error(`unregistered token ${tokenName(token)}`);
        }
      }
      const previous = current;
      current = container;
      try {
        return instantiate(token, registration);
      } finally {
        current = previous;
      }
    },

    inject<T>(token: Token<T>): T {
      const registration = registry.get(token) as Registration<T> | undefined;
      if (registration) {
        // class → lazy proxy (deferred construction breaks cycles); value/factory
        // → eager (returns the real value; primitives cannot be proxied).
        if (isClassProvider(registration.provider)) {
          return createLazyProxy(() => container.resolve(token) as T & object) as T;
        }
        return container.resolve(token);
      }
      // unregistered: a class can still be built lazily; anything else is a wiring
      // mistake and throws now (surfaces at boot under warmup).
      if (isConstructor(token)) {
        return createLazyProxy(() => container.resolve(token) as T & object) as T;
      }
      throw new Error(`unregistered token ${tokenName(token)}`);
    },

    has(token: Token): boolean {
      return registry.has(token);
    },

    warmup(): { resolved: number } {
      const errors: string[] = [];
      let resolved = 0;
      for (const [token, registration] of registry) {
        // value providers are constants — nothing to construct or validate.
        if (isValueProvider(registration.provider)) continue;
        try {
          container.resolve(token);
          resolved++;
        } catch (error) {
          errors.push(`${tokenName(token)}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (errors.length > 0) {
        throw new InitError(`warmup failed for ${errors.length} token(s):\n  ${errors.join("\n  ")}`);
      }
      return { resolved };
    },
  };

  return container;

  function instantiate<T>(token: Token<T>, registration: Registration<T>): T {
    const provider = registration.provider;
    if (isValueProvider(provider)) {
      return provider.useValue;
    }
    if (registration.scope == Scope.Singleton && registration.instance) {
      return registration.instance.current;
    }
    if (resolving.has(token)) {
      throw new Error(`circular dependency detected while resolving ${tokenName(token)}`);
    }
    resolving.add(token);
    let instance: T;
    try {
      instance = isClassProvider(provider)
        ? new provider.useClass() as T
        : provider.useFactory();
    } finally {
      resolving.delete(token);
    }
    if (registration.scope == Scope.Singleton) {
      registration.instance = { current: instance };
    }
    return instance;
  }
}

function tokenName(token: Token): string {
  return (token as { name?: string }).name ?? String(token);
}
