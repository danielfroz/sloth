import { EchoGetQuery, EchoGetQueryResult } from "@/models/cqrs/echo/index.ts"
import { Types } from "@/types.ts"
import { DI, Errors, QueryHandler, Route } from "@danielfroz/sloth"

/**
 * The endpoint is declared right here with @Route — no controllers/Echo.ts to
 * maintain. At startup `app.Handlers.routes()` assembles the controller from
 * every @Route-decorated handler. Transient scope recreates the handler per request.
 */
@Route('/echo/get', { scope: DI.Scope.Transient })
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

