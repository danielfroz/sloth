import { AuthMiddleware, LogMiddleware, NotFoundMiddleware } from "@/middlewares/index.ts";
import { Types } from "@/types.ts";
import { Application, container } from "@danielfroz/sloth";
import { OakFramework } from "@danielfroz/sloth/oak";
import { Application as OakApplication } from "@oak/oak";

// Side-effect import: evaluating the handlers barrel runs every @Route decorator,
// populating the route registry that pipeline()/routes() reads below.
import "@/handlers/cqrs/index.ts";

export const init = async () => {
  const log = container.resolve(Types.Log)

  const app = new Application({
    framework: new OakFramework(),
    log
  })

  /**
   * Accessing the framework Container.
   * In this example we're accessing the Oak server application directly — useful
   * for framework-native hooks that Sloth doesn't wrap.
   *
   * Note: request-timing logging used to live here as a raw oakapp.use(); it now
   * lives as a proper Sloth `before` middleware (middlewares/Log.ts), wired via
   * app.Handlers.pipeline() so its ordering relative to controllers is explicit.
   */
  const oakapp = app.app as OakApplication

  // hooking to Oak Event Listener
  oakapp.addEventListener('listen', ({ port }) => {
    log.info(`listening on port ${port}`)
  })

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
  app.Handlers.pipeline({
    before: [ LogMiddleware, AuthMiddleware ],
    after: [ NotFoundMiddleware ],
    discover: true,
  })

  await app.start({ port: 4000 })
}