import { app } from '@/app.ts';
import { EchoMem } from "@/repositories/mem/index.ts";
import { Types } from "@/types.ts";
import { DI } from '@danielfroz/sloth';

export const init = async () => {
  app.Services.addClass(Types.Repos.Echo, EchoMem, { scope: DI.Scope.Singleton })
}