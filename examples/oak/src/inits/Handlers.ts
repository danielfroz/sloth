import { app } from "@/app.ts";
// Side-effect import: evaluating the handlers barrel runs every @Route decorator,
// populating the route registry that pipeline()/routes() reads below.
import "@/handlers/cqrs/index.ts";
import { LogMiddleware, NotFoundMiddleware } from "@/middlewares/index.ts";

/**
 * The whole request pipeline declared in one structured call:
 *
 *   before → controllers (@Route-discovered) → after
 *
 * - `before`: LogMiddleware — cross-cutting, runs ahead of every controller.
 * - controllers: assembled automatically from every @Route handler (inserted
 *   between `before` and `after`); no controllers/Echo.ts to maintain.
 * - `after`: NotFoundMiddleware — catch-all, runs last.
 *
 * Auth is NOT global here — it's scoped to /echo/save via @Route({ use: [Auth] }),
 * so /echo/get is public. See handlers/cqrs/echo/SaveHandler.ts.
 */
export const init = async () => {
  app.Handlers.pipeline({
    before: [ LogMiddleware ],
    after: [ NotFoundMiddleware ],
  })
}
