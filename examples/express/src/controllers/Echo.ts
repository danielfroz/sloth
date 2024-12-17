import { EchoGetHandler, EchoSaveHandler } from "@/handlers/cqrs/echo/index.ts";
import { Controller, DI } from "@danielfroz/sloth";

export const EchoController = new Controller('/echo')
  .add({
    endpoint: '/get',
    handler: EchoGetHandler,
  }, { scope: DI.Scope.Singleton })
  .add({
    endpoint: '/save',
    handler: EchoSaveHandler
  }, { scope: DI.Scope.Singleton })