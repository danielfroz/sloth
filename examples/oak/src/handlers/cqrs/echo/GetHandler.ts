import { EchoGetQuery, EchoGetQueryResult } from "@/models/cqrs/echo/index.ts"
import { Types } from "@/types.ts"
import { Errors, QueryHandler } from "@danielfroz/sloth"
import { inject } from "@exuanbo/di-wise"

export class EchoGetHandler implements QueryHandler<EchoGetQuery, EchoGetQueryResult> {
  constructor(
    private readonly echoRepo = inject(Types.Repos.Echo)
  ) {}

  async handle(query: EchoGetQuery): Promise<EchoGetQueryResult> {
    if(!query)
      throw new Errors.ArgumentError('query')
    if(!query)
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

