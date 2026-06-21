import { EchoRepository } from '@/repositories/index.ts';
import type { GithubService } from '@/services/index.ts';
import { Log } from '@danielfroz/slog';
import { Api, DI } from "@danielfroz/sloth";

export const Types = {
  Log: DI.Type<Log>('Log'),
  Repos: {
    Echo: DI.Type<EchoRepository>('Repos.Echo')
  },
  // External HTTP API clients (ApiFetch instances), registered by an Initializer.
  Api: {
    Github: DI.Type<Api>('Api.Github')
  },
  // Business services that wrap repositories / API clients.
  Services: {
    Github: DI.Type<GithubService>('Services.Github')
  },
}
