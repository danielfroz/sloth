import { EchoGetHandler, EchoSaveHandler } from "@/handlers/cqrs/echo/index.ts";
import { Controller } from "@danielfroz/slothcore";

export const EchoController = new Controller('/echo')
  .add({
    endpoint: '/get',
    handler: EchoGetHandler,
  })
  .add({
    endpoint: '/save',
    handler: EchoSaveHandler
  })