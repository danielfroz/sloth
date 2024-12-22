import { EchoGetHandler, EchoSaveHandler } from "@/handlers/cqrs/echo/index.ts";
import { Controller, DI } from "@danielfroz/sloth";

export const EchoController = new Controller('/echo')
  // you may want to register this handler at Transient scope... so we recreate this handler on every request 
  // default scope is Singleton
  .add({
    endpoint: '/get',
    handler: EchoGetHandler,
  }, { scope: DI.Scope.Transient })
  .add({
    endpoint: '/save',
    handler: EchoSaveHandler
  }, { scope: DI.Scope.Singleton })