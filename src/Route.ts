import { Controller } from "./Controller.ts";
import { Base, BaseHandler, BaseResult } from "./Cqrs.ts";
import type { Constructor } from "./di/index.ts";
import { Scope } from "./di/index.ts";

/**
 * TC39 standard class-decorator signature.
 *
 * @see {@link https://github.com/tc39/proposal-decorators?tab=readme-ov-file#classes}
 */
type ClassDecorator<Class extends Constructor<object>> = (
  value: Class,
  context: ClassDecoratorContext<Class>,
) => Class | void;
import * as Errors from "./Errors.ts";
import { Middleware } from "./Middleware.ts";

/**
 * Options accepted by the {@link Route} decorator.
 */
export interface RouteDecoratorOptions {
  /**
   * DI scope of the handler instance. Defaults to {@link Scope.Singleton}
   * (same default as {@link Controller.add}). Use {@link Scope.Transient} to
   * recreate the handler on every request.
   */
  scope?: Scope;
  /**
   * Route-scoped middlewares, run (in order) before the handler for THIS route
   * only — e.g. `@Route('/echo/save', { use: [AuthMiddleware] })` to require
   * auth on writes but not reads. A middleware that doesn't call `next()`
   * short-circuits the handler, exactly like a global one.
   */
  use?: Middleware[];
}

/**
 * A single handler declared via the {@link Route} decorator, waiting to be
 * assembled into a {@link Controller} by {@link buildControllers}.
 */
export interface RouteRegistration {
  handler: Constructor<BaseHandler<Base, BaseResult>>;
  path: string;
  scope?: Scope;
  middlewares?: Middleware[];
}

/**
 * Module-level registry of routes. Populated as an import-time side effect when
 * a handler module decorated with {@link Route} is evaluated. Consumed by
 * {@link buildControllers} (typically via `app.Handlers.routes()`).
 *
 * IMPORTANT: handler modules must actually be imported for their decorators to
 * run. Import the handlers barrel (e.g. `import '@/handlers/cqrs/index.ts'`)
 * before calling `app.Handlers.routes()`.
 */
const registry = new Array<RouteRegistration>();

/**
 * Normalizes a route path: ensures a single leading slash and drops a trailing
 * slash (except for the root `/`).
 */
function normalize(path: string): string {
  let p = path.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/**
 * Splits a full route path into a controller base (first segment) and the
 * remaining endpoint, so routes that share a prefix are grouped under one
 * {@link Controller}.
 *
 * - `/echo/get`     -> { base: '/echo', endpoint: '/get' }
 * - `/echo/sub/get` -> { base: '/echo', endpoint: '/sub/get' }
 * - `/health`       -> { base: '',      endpoint: '/health' }
 */
function split(path: string): { base: string; endpoint: string } {
  const segments = normalize(path).split("/").filter(Boolean);
  if (segments.length <= 1) {
    return { base: "", endpoint: `/${segments.join("/")}` };
  }
  return {
    base: `/${segments[0]}`,
    endpoint: `/${segments.slice(1).join("/")}`,
  };
}

/**
 * Class decorator that declares the HTTP route served by a CQRS handler.
 *
 * The decorated handler is recorded in a module-level registry (an import-time
 * side effect). At
 * startup, `app.Handlers.routes()` reads the registry and assembles the
 * {@link Controller}s automatically — no manual `Controller.add()` wiring.
 *
 * @example
 * ```ts
 * ⁤@Route('/echo/get', { scope: Scope.Transient })
 * export class EchoGetHandler implements QueryHandler<EchoGetQuery, EchoGetQueryResult> {
 *   async handle(query: EchoGetQuery): Promise<EchoGetQueryResult> { ... }
 * }
 *
 * ⁤@Route('/echo/save', { use: [AuthMiddleware] }) // route-scoped middleware
 * export class EchoSaveHandler implements CommandHandler<EchoSaveCommand, EchoSaveCommandResult> { ... }
 * ```
 */
export function Route<This extends BaseHandler<Base, BaseResult>>(
  path: string,
  options?: RouteDecoratorOptions,
): ClassDecorator<Constructor<This>> {
  // Validate after trimming so empty/whitespace-only paths are rejected.
  // A missing leading slash is NOT an error — normalize() adds it, so
  // `echo/get` and `/echo/get` resolve to the same route.
  if (!path || !path.trim()) throw new Errors.ArgumentError("path");
  return (Class) => {
    registry.push({
      handler: Class as Constructor<BaseHandler<Base, BaseResult>>,
      path: normalize(path),
      scope: options?.scope,
      middlewares: options?.use,
    });
  };
}

/**
 * Builds the {@link Controller}s from every {@link Route}-decorated handler in
 * the registry, grouping routes by their base segment. Reuses
 * {@link Controller.add} so the resulting controllers go through the exact same
 * DI registration and request pipeline as manually-authored ones.
 */
export function buildControllers(): Controller[] {
  const byBase = new Map<string, Controller>();
  for (const reg of registry) {
    const { base, endpoint } = split(reg.path);
    let controller = byBase.get(base);
    if (!controller) {
      controller = new Controller(base);
      byBase.set(base, controller);
    }
    controller.add(
      { endpoint, handler: reg.handler, middlewares: reg.middlewares },
      reg.scope ? { scope: reg.scope } : undefined,
    );
  }
  return [...byBase.values()];
}

/**
 * Clears the route registry. Intended for tests and as a guard against
 * double-registration if controllers are rebuilt within the same process.
 */
export function clearRoutes(): void {
  registry.length = 0;
}
