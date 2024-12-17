import { container } from "./Container.ts"
import { Base, BaseHandler, BaseResult } from "./Cqrs.ts"
import { Constructor, Scope, Token, Type } from "./di/index.ts"

export interface Route {
  type: Token,
  route: RouteHandler<Base, BaseResult>
}

export interface RouteHandler<T extends Base, TR extends BaseResult> {
  endpoint: string
  handler: Constructor<BaseHandler<T, TR>>
}

export interface RouteOptions {
  scope: Scope
}

export class Controller {
  readonly #routes = new Array<Route>()

  constructor(
    readonly base: string
  ) {}

  get routes(): Route[] {
    return this.#routes
  }

  add<T extends Base, TR extends BaseResult>(route: RouteHandler<T, TR>, options?: RouteOptions): Controller {
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

