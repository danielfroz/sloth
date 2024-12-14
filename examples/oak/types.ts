import { Type } from "@exuanbo/di-wise";
import { EchoRepository } from './repositories/index.ts';

export const Types = {
  Repos: {
    Echo: Type<EchoRepository>('Repos.Echo')
  },
}