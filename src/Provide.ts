import { container } from "./Container.ts";
import type { Constructor, Container, Scope, Token } from "./di/index.ts";

/**
 * Options accepted by {@link Provide} / {@link Repository} / {@link Service}.
 */
export interface ProvideOptions {
  /**
   * DI scope of the provided instance. Defaults to {@link Scope.Singleton}
   * (the container default).
   */
  scope?: Scope;
}

/**
 * A class binding declared via {@link Provide}, waiting to be registered into the
 * container by {@link registerProviders}.
 */
export interface ProviderRegistration {
  token: Token;
  // deno-lint-ignore no-explicit-any
  ctor: Constructor<any>;
  scope?: Scope;
}

/**
 * Module-level registry of provider bindings. Populated as an import-time side
 * effect when a class decorated with {@link Provide} is evaluated. Consumed by
 * {@link registerProviders} (typically via `app.Providers.discover()`).
 *
 * IMPORTANT: provider modules must actually be imported for their decorators to
 * run — import the barrel (e.g. `import '@/repositories/mongo/index.ts'`) before
 * calling `app.Providers.discover()`.
 */
const registry = new Array<ProviderRegistration>();

/**
 * Decorator that binds a class to a {@link Token} for the DI container, with the
 * registration deferred to discovery (registration order is irrelevant — `inject`
 * is lazy and `warmup` validates at boot).
 *
 * {@link Repository} and {@link Service} are aliases with the same behavior; pick
 * whichever reads best at the call site.
 *
 * @example
 * ```ts
 * ⁤@Repository(Types.Repos.Order)
 * export class OrderMongo implements OrderRepository { … }
 * ```
 */
export function Provide<T extends object>(token: Token<T>, options?: ProvideOptions) {
  // Generic over the concrete class so an implementation (e.g. EchoMem) can be
  // bound to an interface token (Type<EchoRepository>) — the class only has to be
  // assignable to the token's type.
  return <Class extends Constructor<T>>(value: Class, _context: ClassDecoratorContext<Class>): void => {
    registry.push({ token, ctor: value, scope: options?.scope });
  };
}

/**
 * Alias of {@link Provide}, for repository implementations.
 */
export const Repository: typeof Provide = Provide;

/**
 * Alias of {@link Provide}, for service implementations.
 */
export const Service: typeof Provide = Provide;

/**
 * Registers every {@link Provide}-decorated class discovered so far into the
 * container (defaults to the global {@link container}). Idempotent per binding —
 * re-registering a token overwrites the previous binding.
 */
export function registerProviders(into: Container = container): void {
  for (const { token, ctor, scope } of registry) {
    into.register(token, { useClass: ctor }, scope ? { scope } : undefined);
  }
}

/**
 * Empties the provider registry (tests / rebuild guard).
 */
export function clearProviders(): void {
  registry.length = 0;
}
