import { app } from "@/app.ts";
import { EchoController } from "@/controllers/index.ts";
import { AuthMiddleware, NotFoundMiddleware } from "@/middlewares/index.ts";
import { MiddlewareReq } from "@danielfroz/sloth";

export const init = async () => {
  app.Handlers.push(AuthMiddleware as MiddlewareReq)
  app.Handlers.push(EchoController)
  app.Handlers.push(NotFoundMiddleware as MiddlewareReq)
}