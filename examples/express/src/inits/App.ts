import { AuthMiddleware, LogMiddleware, NotFoundMiddleware } from "@/middlewares/index.ts";
import { Types } from "@/types.ts";
import { Application, container } from "@danielfroz/sloth";
import { ExpressFramework } from "@danielfroz/sloth/express";

// Side-effect import: evaluating the handlers barrel runs every @Route decorator,
// populating the route registry that pipeline() reads below.
import "@/handlers/cqrs/index.ts";

export const init = async () => {
  const log = container.resolve(Types.Log)

  const app = new Application({
    framework: new ExpressFramework(),
    log
  })

  /**
   * The whole request pipeline declared in one structured call:
   *
   *   before → controllers (@Route-discovered) → after
   *
   * - `before`: LogMiddleware (request stats) then AuthMiddleware (global auth).
   * - controllers: assembled automatically from every @Route handler (inserted
   *   between `before` and `after`); no controllers/*.ts to maintain.
   * - `after`: NotFoundMiddleware — catch-all, runs last.
   */
  app.Handlers.pipeline({
    before: [ LogMiddleware, AuthMiddleware ],
    after: [ NotFoundMiddleware ],
    discover: true,
  })

  await app.start({
    port: 4000,
    callback: ({ port }) => log.info(`listening on port ${port}`)
  })
}
