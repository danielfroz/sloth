import { EchoRepository } from '@/repositories/index.ts';
import { Log } from '@danielfroz/slog';
import { DI } from "@danielfroz/sloth";

export const Types = {
  Log: DI.Type<Log>('Log'),
  Repos: {
    Echo: DI.Type<EchoRepository>('Repos.Echo')
  },
}