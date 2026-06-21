import { EchoGetQuery, EchoGetQueryResult } from "@/models/cqrs/echo/index.ts"
import { Types } from "@/types.ts"
import { DI, Errors, QueryHandler, Route } from "@danielfroz/sloth"

/**
 * The endpoint is declared right here with @Route — no controllers/*.ts to
 * maintain. At startup Sloth assembles the controller from every @Route-decorated
 * handler.
 *
 * Scope is optional and defaults to DI.Scope.Singleton (one shared instance).
 * Pass DI.Scope.Transient to recreate the handler on every request — only needed
 * when a handler must hold per-request state. Prefer keeping handlers stateless
 * (see the README "Handler Scope" section); then Singleton is the better default.
 * To override:
 *
 * ```ts
 * @Route('/echo/get', { scope: DI.Scope.Transient })
 * export class EchoGetHandler ... {}
 * ```
 */
@Route('/echo/get')
export class EchoGetHandler implements QueryHandler<EchoGetQuery, EchoGetQueryResult> {
  constructor(
    private readonly echoRepo = DI.inject(Types.Repos.Echo)
  ) {}

  async handle(query: EchoGetQuery): Promise<EchoGetQueryResult> {
    if(!query)
      throw new Errors.ArgumentError('query')
    if(!query.id)
      throw new Errors.ArgumentError('query.id')

    const { id, sid } = query

    const echo = await this.echoRepo.get(id)

    return {
      id,
      sid,
      echo
    }
  }
}

