import { EchoRepository } from '@/repositories/index.ts';
import { DI } from "@danielfroz/sloth";

export const Types = {
  Repos: {
    Echo: DI.Type<EchoRepository>('Repos.Echo')
  },
}