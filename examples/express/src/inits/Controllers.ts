import { app } from "@/app.ts";
import { EchoController } from "@/controllers/index.ts";
import { DI } from '@danielfroz/sloth';

export const init = async () => {
  app.Controllers
    .push(EchoController, { scope: DI.Scope.Transient })
}