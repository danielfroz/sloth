import { Constructor, Scope, Token, Type } from "@exuanbo/di-wise"
import { container } from "./Container.ts"
import { Base, BaseHandler, BaseResult } from "./Cqrs.ts"

export interface Route {
  type: Token,
  route: RouteHandler<Base, BaseResult>
}

export interface RouteHandler<T extends Base, TR extends BaseResult> {
  endpoint: string
  handler: Constructor<BaseHandler<T, TR>>
}

export class Controller {
  readonly #routes = new Array<Route>()

  constructor(
    readonly base: string
  ) {}

  get routes(): Route[] {
    return this.#routes
  }

  add<T extends Base, TR extends BaseResult>(route: RouteHandler<T, TR>): Controller {
    const t = Type(`Controller.Route-${route.handler.name}`)
    container.register(t, { useClass: route.handler }, {
      scope: Scope.Resolution
    })
    this.#routes.push({
      type: t,
      route
    })
    return this
  }
}

