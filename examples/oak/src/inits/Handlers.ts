import { app } from "@/app.ts";
import { EchoController } from "@/controllers/index.ts";
import { AuthMiddleware, NotFoundMiddleware } from "@/middlewares/index.ts";
import { MiddlewareCtx } from "@danielfroz/sloth";

/**
 * We must register all handlers; Controllers and Middlewares
 * Note that we need to register AuthMiddleware at the beginning of the stack
 * NotFoundMiddleware just at the end.
 * 
 * If you place NotFound at the beginning, since it is a catch all Middleware
 * then you will see NOT FOUND response everywhere
 */
export const init = async () => {
  app.Handlers.push(AuthMiddleware as MiddlewareCtx)
  app.Handlers.push(EchoController)
  app.Handlers.push(NotFoundMiddleware as MiddlewareCtx)
}