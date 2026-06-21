import { currentContainer } from "./container.ts";
import type { Constructor, Token } from "./token.ts";

/**
 * Inject a dependency — **lazy by default**.
 *
 * Resolves against the container currently driving resolution, so it must be
 * called within a constructor (or factory) reached through `container.resolve`.
 * The idiomatic use is a constructor default parameter:
 *
 * ```ts
 * class GetHandler {
 *   constructor(private readonly repo = inject(Types.Repos.Echo)) {}
 * }
 * ```
 *
 * Behavior (see {@link Container.inject}):
 * - **class** dependency → a transparent proxy constructed on first use, so
 *   circular dependencies and registration order never matter;
 * - **value / factory** dependency → resolved eagerly (so primitives work);
 * - unregistered `Type` token → throws (surfaces wiring mistakes at boot under
 *   `warmup`).
 *
 * Passing the dependency explicitly (`new GetHandler(mockRepo)`) skips injection
 * entirely, keeping handlers unit-testable without a container.
 */
export function inject<Instance extends object>(token: Constructor<Instance>): Instance;
export function inject<Value>(token: Token<Value>): Value;
export function inject<T>(token: Token<T>): T {
  const container = currentContainer();
  if (!container) {
    throw new Error("inject() can only be used within an injection context (during container.resolve)");
  }
  return container.inject(token);
}
