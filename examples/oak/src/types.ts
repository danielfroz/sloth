import { EchoRepository } from '@/repositories/index.ts';
import { Type } from "@exuanbo/di-wise";

export const Types = {
  Repos: {
    Echo: Type<EchoRepository>('Repos.Echo')
  },
}