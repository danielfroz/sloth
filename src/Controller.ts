import { container } from "./Container.ts";
import { Base, BaseHandler, BaseResult } from "./Cqrs.ts";
import { Constructor, Scope, Token, Type } from "./di/index.ts";
import { Middleware } from "./Middleware.ts";
import { Errors } from "./mod.ts";

export interface ControllerRoute {
  type: Token,
  route: RouteHandler<Base, BaseResult>
}

export interface RouteHandler<T extends Base, TR extends BaseResult> {
  endpoint: string
  handler: Constructor<BaseHandler<T, TR>>
  /**
   * Route-scoped middlewares, run (in order) before the handler for this route
   * only. The adapters spread them into the framework router before the handler.
   */
  middlewares?: Middleware[]
}

export interface RouteOptions {
  scope: Scope
}

export class Controller {
  readonly #routes = new Array<ControllerRoute>()

  constructor(
    readonly base: string
  ) {}

  get routes(): ControllerRoute[] {
    return this.#routes
  }

  add<T extends Base, TR extends BaseResult>(route: RouteHandler<T, TR>, options?: RouteOptions): Controller {
    if(!route)
      throw new Errors.ArgumentError('route')
    if(!route.endpoint)
      throw new Errors.ArgumentError('route.endpoint')
    if(!route.handler)
      throw new Errors.ArgumentError('route.handler')

    const t = Type(`Controller.Route-${route.handler.name}`)
    container.register(t, { useClass: route.handler }, {
      scope: options?.scope ?? Scope.Singleton
    })

    this.#routes.push({
      type: t,
      route
    })

    return this
  }
}

