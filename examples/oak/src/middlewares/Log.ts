import { Types } from "@/types.ts";
import { container, Middleware } from "@danielfroz/sloth";
import { Context, Next } from "@oak/oak";

/**
 * A cross-cutting request logger used as a GLOBAL `before` middleware in the
 * pipeline — it runs ahead of every controller, times the request, and logs it.
 *
 * This is the canonical use of a global middleware (applies to all requests),
 * the complement to route-scoped middleware like Auth (see SaveHandler).
 */
export const LogMiddleware = async (ctxfn: Middleware.CtxFn<Context>, nextfn: Middleware.NextFn<Next>): Promise<void> => {
  const ctx = ctxfn()
  const next = nextfn()
  const log = container.resolve(Types.Log)

  const start = new Date().getTime()
  await next()
  const end = new Date().getTime()
  log.info({ msg: `request to ${ctx.request.url} served in ${end - start} ms` })
}
