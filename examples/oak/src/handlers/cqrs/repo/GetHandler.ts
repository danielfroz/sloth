import { RepoGetQuery, RepoGetQueryResult } from "@/models/cqrs/repo/index.ts"
import { Types } from "@/types.ts"
import { DI, Errors, QueryHandler, Route } from "@danielfroz/sloth"

/**
 * Fetches a GitHub repository through GithubService and returns the mapped info
 * as part of the Result.
 *
 * The service is injected by token — a class dependency, so it arrives as a lazy
 * proxy (built on first use). Errors from the upstream API surface as
 * `Errors.ApiError`, which the adapter maps to the right HTTP status.
 *
 * Try it: POST /repo/get { "id": "1", "sid": "1", "owner": "danielfroz", "name": "sloth" }
 */
@Route('/repo/get')
export class RepoGetHandler implements QueryHandler<RepoGetQuery, RepoGetQueryResult> {
  constructor(
    private readonly github = DI.inject(Types.Services.Github)
  ) {}

  async handle(query: RepoGetQuery): Promise<RepoGetQueryResult> {
    if(!query)
      throw new Errors.ArgumentError('query')
    if(!query.owner)
      throw new Errors.ArgumentError('query.owner')
    if(!query.name)
      throw new Errors.ArgumentError('query.name')

    const { id, sid, owner, name } = query

    const repo = await this.github.getRepo(owner, name)

    return {
      id,
      sid,
      repo
    }
  }
}
