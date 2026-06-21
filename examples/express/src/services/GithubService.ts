import { Repo } from "@/models/dtos/index.ts";
import { Types } from "@/types.ts";
import { DI, Service } from "@danielfroz/sloth";

// The raw shape returned by api.github.com (only the fields we consume).
interface GithubRepo {
  full_name: string
  description: string | null
  stargazers_count: number
  forks_count: number
  language: string | null
}

/**
 * A Service that wraps an external HTTP API.
 *
 * - `@Service(...)` binds it to its token; `app.Providers.discover()` registers it.
 * - The Api client (an `ApiFetch` registered as a value by `ApiInit`) is injected
 *   through the constructor — a value dependency, so it's resolved eagerly.
 * - `getRepo()` calls the API and maps the raw payload to our own `Repo` DTO, so
 *   the handler/Result never leaks the upstream shape.
 *
 * Unit-test it without a container: `new GithubService(fakeApi)`.
 */
@Service(Types.Services.Github)
export class GithubService {
  constructor(
    private readonly api = DI.inject(Types.Api.Github)
  ) {}

  async getRepo(owner: string, name: string): Promise<Repo> {
    const raw = await this.api.get<GithubRepo>({
      url: `/repos/${owner}/${name}`,
      // GitHub requires a User-Agent header — shows ApiFetch's per-request headers.
      headers: { 'User-Agent': 'sloth-example' },
    })
    return {
      fullName: raw.full_name,
      description: raw.description ?? undefined,
      stars: raw.stargazers_count,
      forks: raw.forks_count,
      language: raw.language ?? undefined,
    }
  }
}
