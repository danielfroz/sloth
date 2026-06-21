import { auth, LogMiddleware, NotFoundMiddleware } from "@/middlewares/index.ts";
import { Application, container } from "@danielfroz/sloth";
import { OakFramework } from "@danielfroz/sloth/oak";
import { ApiInit, LogInit } from "./inits/index.ts";
import { Types } from "./types.ts";

// Side-effect imports: evaluating these barrels runs the @Route, @Repository and
// @Service decorators, populating the registries that discover()/pipeline() read.
import "@/handlers/cqrs/index.ts";
import "@/repositories/mem/index.ts";
import "@/services/index.ts";

try {
  const app = new Application({ framework: new OakFramework() })

  // 1) Register every @Repository/@Service class binding (order-free).
  app.Providers.discover()

  // 2) Ordered, imperative bootstrap — Log first, then the HTTP API clients
  //    (real services also chain Secret → Mongo → Events here).
  await app.Inits.run(LogInit, ApiInit)

  // 3) HTTP pipeline: before → @Route-discovered controllers → after.
  //    Auth is GLOBAL — every route requires a token — except the paths in
  //    `except`. So /echo/get and /echo/save are protected; /repo/get is public.
  app.Handlers.pipeline({
    before: [ LogMiddleware, auth({ except: [ '/repo/get' ] }) ],
    after: [ NotFoundMiddleware ],
  })

  // 4) start() runs warmup() by default — the whole graph is validated (and
  //    singletons built) before listening, so wiring mistakes fail here, not on
  //    the first request. Pass { warmup: false } to skip.
  await app.start({
    port: 4000,
    callback: ({ port }) => container.resolve(Types.Log).info(`listening on port ${port}`),
  })
}
catch(err: Error|any) {
  if(container.has(Types.Log))
    container.resolve(Types.Log).error({ msg: 'main error caught', error: err.message, stack: err.stack })
  else
    console.error('main error caught: %o', err.message)
  Deno.exit(1)
}
